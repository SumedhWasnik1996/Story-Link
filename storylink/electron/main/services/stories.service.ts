// electron/main/services/stories.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// Owns the full stories feature:
//   - sync()        fetch Jira + GitHub, run link algorithm, cache in DB
//   - getStories()  return cached LinkedStoryGroup[] (no API calls)
//   - linkPR()      add a manual pr_link row
//   - unlinkPR()    remove a manual pr_link row
//   - searchPRs()   filter cached PRs by query string
//   - getPRByUrl()  fetch a single PR from GitHub by URL, validate repo
// ─────────────────────────────────────────────────────────────────────────────

import { db } from '../db/db';
import { getValidAccessToken, getCloudId } from '../auth/jira.auth';
import { getValidGitHubToken } from '../auth/github.auth';
import { getJiraIssues } from './jira.services';
import { getGitHubPRs, getPRByUrl as fetchPRByUrl } from './github.services';
import { workspaceService } from './workspace.service';
import type {
    Issue,
    GitHubPR,
    LinkedPR,
    LinkedIssue,
    LinkedStoryGroup,
    PRState,
} from '@shared/types/workspace.types';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Raw Jira issue → Issue type ───────────────────────────────────────────────

function mapJiraIssue(raw: any, cloudId: string): Issue {
    const key = raw.key as string;

    return {
        id: raw.id,
        key,
        summary: raw.fields?.summary ?? '(no summary)',
        status: raw.fields?.status?.name ?? 'Unknown',
        priority: raw.fields?.priority?.name ?? 'Unknown',
        type: raw.fields?.issuetype?.name ?? 'Unknown',
        parentKey: raw.fields?.parent?.key,
        epicLabel: undefined,
        subtaskKeys: (raw.fields?.subtasks ?? []).map((s: any) => s.key),
        jiraUrl: `https://api.atlassian.com/ex/jira/${cloudId}/browse/${key}`,
    };
}

// ── PR linking algorithm ──────────────────────────────────────────────────────

const ISSUE_KEY_REGEX = /\b([A-Z]+-\d+)\b/gi;

function extractKeys(text: string): string[] {
    const matches = [...text.matchAll(ISSUE_KEY_REGEX)];
    return [...new Set(matches.map(m => m[1].toUpperCase()))];
}

function buildAutoLinks(
    prs: GitHubPR[],
    knownKeys: Set<string>,
): Map<string, number[]> {
    const links = new Map<string, number[]>();

    for (const pr of prs) {
        const candidates = [
            ...extractKeys(pr.title),
            ...extractKeys(pr.branch),
        ];

        for (const key of candidates) {
            if (!knownKeys.has(key)) continue;
            if (!links.has(key)) links.set(key, []);
            links.get(key)!.push(pr.number);
        }
    }

    return links;
}

// ── Assemble LinkedIssue ──────────────────────────────────────────────────────

function prStatefromRaw(pr: GitHubPR): PRState {
    if (pr.merged) return 'merged';
    if (pr.state === 'closed') return 'closed';
    return 'open';
}

function assembleLinkedIssues(
    issues: Issue[],
    prs: GitHubPR[],
    workspaceId: string,
): LinkedIssue[] {
    const prMap = new Map(prs.map(p => [p.number, p]));
    const issueMap = new Map(issues.map(i => [i.key, i]));

    // Resolve epicLabel
    for (const issue of issues) {
        if (issue.type === 'Story' && issue.parentKey) {
            const parent = issueMap.get(issue.parentKey);
            if (parent?.type === 'Epic') {
                issue.epicLabel = parent.summary;
            }
        }
    }

    type LinkRow = { issue_key: string; pr_number: number; pr_title: string; source: string };
    const manualRows = db()
        .prepare(`
            SELECT issue_key, pr_number, pr_title, source
            FROM pr_links
            WHERE workspace_id = ?
        `)
        .all(workspaceId) as LinkRow[];

    const manualLinks = new Map<string, Set<number>>();
    for (const row of manualRows) {
        if (!manualLinks.has(row.issue_key)) manualLinks.set(row.issue_key, new Set());
        manualLinks.get(row.issue_key)!.add(row.pr_number);
    }

    const knownKeys = new Set(issues.map(i => i.key));
    const autoLinks = buildAutoLinks(prs, knownKeys);

    function getLinkedPRs(issueKey: string): LinkedPR[] {
        const result: LinkedPR[] = [];
        const seen = new Set<number>();

        for (const prNum of autoLinks.get(issueKey) ?? []) {
            const pr = prMap.get(prNum);
            if (!pr) continue;
            seen.add(prNum);
            result.push({
                prNumber: pr.number,
                prTitle: pr.title,
                state: prStatefromRaw(pr),
                draft: pr.draft,
                url: pr.url,
                source: 'auto',
            });
        }

        for (const prNum of manualLinks.get(issueKey) ?? []) {
            const pr = prMap.get(prNum);
            if (!pr) continue;
            if (seen.has(prNum)) {
                const existing = result.find(r => r.prNumber === prNum);
                if (existing) existing.source = 'manual';
                continue;
            }
            seen.add(prNum);
            result.push({
                prNumber: pr.number,
                prTitle: pr.title,
                state: prStatefromRaw(pr),
                draft: pr.draft,
                url: pr.url,
                source: 'manual',
            });
        }

        return result;
    }

    function toLinkedIssue(issue: Issue): LinkedIssue {
        const children: LinkedIssue[] = issues
            .filter(i => i.parentKey === issue.key && i.type !== 'Epic')
            .map(toLinkedIssue);

        return {
            ...issue,
            linkedPRs: getLinkedPRs(issue.key),
            children,
        };
    }

    return issues.map(toLinkedIssue);
}

// ── Group by status ───────────────────────────────────────────────────────────

const STATUS_ORDER = ['To Do', 'In Progress', 'In Review', 'Done'];

function groupByStatus(stories: LinkedIssue[]): LinkedStoryGroup[] {
    const map = new Map<string, LinkedIssue[]>();

    for (const story of stories) {
        const s = story.status;
        if (!map.has(s)) map.set(s, []);
        map.get(s)!.push(story);
    }

    return [...map.entries()]
        .sort(([a], [b]) => {
            const ai = STATUS_ORDER.indexOf(a);
            const bi = STATUS_ORDER.indexOf(b);
            if (ai === -1 && bi === -1) return a.localeCompare(b);
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
        })
        .map(([status, stories]) => ({ status, stories }));
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

function isCacheStale(fetchedAt: number): boolean {
    return Date.now() - fetchedAt > CACHE_TTL_MS;
}

function getCachedIssues(workspaceId: string): Issue[] | null {
    type Row = { data: string; fetched_at: number };
    const rows = db()
        .prepare('SELECT data, fetched_at FROM cached_issues WHERE workspace_id = ?')
        .all(workspaceId) as Row[];

    if (rows.length === 0) return null;
    if (rows.some(r => isCacheStale(r.fetched_at))) return null;

    return rows.map(r => JSON.parse(r.data) as Issue);
}

function setCachedIssues(workspaceId: string, issues: Issue[]): void {
    const upsert = db().prepare(`
        INSERT INTO cached_issues (workspace_id, issue_key, data, fetched_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(workspace_id, issue_key) DO UPDATE SET
            data       = excluded.data,
            fetched_at = excluded.fetched_at
    `);

    const now = Date.now();
    db().transaction(() => {
        for (const issue of issues) {
            upsert.run(workspaceId, issue.key, JSON.stringify(issue), now);
        }
    })();
}

function getCachedPRs(workspaceId: string): GitHubPR[] | null {
    type Row = { data: string; fetched_at: number };
    const rows = db()
        .prepare('SELECT data, fetched_at FROM cached_prs WHERE workspace_id = ?')
        .all(workspaceId) as Row[];

    if (rows.length === 0) return null;
    if (rows.some(r => isCacheStale(r.fetched_at))) return null;

    return rows.map(r => JSON.parse(r.data) as GitHubPR);
}

function setCachedPRs(workspaceId: string, prs: GitHubPR[]): void {
    const upsert = db().prepare(`
        INSERT INTO cached_prs (workspace_id, pr_number, data, fetched_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(workspace_id, pr_number) DO UPDATE SET
            data       = excluded.data,
            fetched_at = excluded.fetched_at
    `);

    const now = Date.now();
    db().transaction(() => {
        for (const pr of prs) {
            upsert.run(workspaceId, pr.number, JSON.stringify(pr), now);
        }
    })();
}

// ── Public service API ────────────────────────────────────────────────────────

export const storiesService = {

    async sync(): Promise<LinkedStoryGroup[]> {
        const ws = workspaceService.getActiveInternal();
        if (!ws) throw new Error('No active workspace');

        const fetchIssues = async (): Promise<Issue[]> => {
            const cached = getCachedIssues(ws.id);
            if (cached) return cached;

            const jiraToken = await getValidAccessToken(ws.accountId);
            const cloudId = await getCloudId(jiraToken);
            const rawIssues = await getJiraIssues(jiraToken, cloudId, ws.projectKey);

            const issues: Issue[] = rawIssues.map((r: any) => mapJiraIssue(r, cloudId));
            setCachedIssues(ws.id, issues);
            return issues;
        };

        const fetchPRs = async (): Promise<GitHubPR[]> => {
            const cached = getCachedPRs(ws.id);
            if (cached) return cached;

            const gitToken = await getValidGitHubToken(ws.gitAccountId);
            const prs = await getGitHubPRs(gitToken, ws.gitRepoFullName);
            setCachedPRs(ws.id, prs);
            return prs;
        };

        const [issues, prs] = await Promise.all([fetchIssues(), fetchPRs()]);

        storiesService._rebuildAutoLinks(ws.id, issues, prs);

        const stories = assembleLinkedIssues(issues, prs, ws.id)
            .filter(i => i.type === 'Story');

        return groupByStatus(stories);
    },

    /**
     * Rebuilds auto-detected pr_links rows for the workspace atomically.
     * The delete and all inserts run in a single transaction so a failure
     * never leaves the table in a partially-cleared state.
     * Manual rows (source='manual') are never touched.
     */
    _rebuildAutoLinks(
        workspaceId: string,
        issues: Issue[],
        prs: GitHubPR[],
    ): void {
        const knownKeys = new Set(issues.map(i => i.key));
        const autoLinks = buildAutoLinks(prs, knownKeys);
        const prMap = new Map(prs.map(p => [p.number, p]));
        const now = Date.now();

        const deleteAuto = db().prepare(
            `DELETE FROM pr_links WHERE workspace_id = ? AND source = 'auto'`
        );

        const insert = db().prepare(`
            INSERT OR IGNORE INTO pr_links
                (workspace_id, issue_key, pr_number, pr_title, source, added_at)
            VALUES (?, ?, ?, ?, 'auto', ?)
        `);

        // Single transaction — delete + all inserts are atomic.
        // If any insert fails, the delete is also rolled back.
        db().transaction(() => {
            deleteAuto.run(workspaceId);
            for (const [issueKey, prNumbers] of autoLinks) {
                for (const prNum of prNumbers) {
                    const pr = prMap.get(prNum);
                    if (!pr) continue;
                    insert.run(workspaceId, issueKey, prNum, pr.title, now);
                }
            }
        })();
    },

    async linkPR(issueKey: string, prNumber: number): Promise<LinkedIssue> {
        const ws = workspaceService.getActiveInternal();
        if (!ws) throw new Error('No active workspace');

        type Row = { data: string };
        const row = db()
            .prepare('SELECT data FROM cached_prs WHERE workspace_id = ? AND pr_number = ?')
            .get(ws.id, prNumber) as Row | undefined;

        if (!row) throw new Error(`PR #${prNumber} not found in cache. Run a sync first.`);

        const pr = JSON.parse(row.data) as GitHubPR;

        db().prepare(`
            INSERT OR REPLACE INTO pr_links
                (workspace_id, issue_key, pr_number, pr_title, source, added_at)
            VALUES (?, ?, ?, ?, 'manual', ?)
        `).run(ws.id, issueKey, prNumber, pr.title, Date.now());

        return storiesService._getLinkedIssue(ws.id, issueKey);
    },

    async unlinkPR(issueKey: string, prNumber: number): Promise<LinkedIssue> {
        const ws = workspaceService.getActiveInternal();
        if (!ws) throw new Error('No active workspace');

        db().prepare(`
            DELETE FROM pr_links
            WHERE workspace_id = ? AND issue_key = ? AND pr_number = ? AND source = 'manual'
        `).run(ws.id, issueKey, prNumber);

        return storiesService._getLinkedIssue(ws.id, issueKey);
    },

    searchPRs(query: string): GitHubPR[] {
        const ws = workspaceService.getActiveInternal();
        if (!ws) throw new Error('No active workspace');

        type Row = { data: string };
        const rows = db()
            .prepare('SELECT data FROM cached_prs WHERE workspace_id = ?')
            .all(ws.id) as Row[];

        const prs = rows.map(r => JSON.parse(r.data) as GitHubPR);
        const q = query.toLowerCase().trim();

        if (!q) return prs;

        return prs.filter(pr =>
            pr.title.toLowerCase().includes(q) ||
            String(pr.number).includes(q)
        );
    },

    async getPRByUrl(url: string): Promise<GitHubPR> {
        const ws = workspaceService.getActiveInternal();
        if (!ws) throw new Error('No active workspace');

        const token = await getValidGitHubToken(ws.gitAccountId);
        const pr = await fetchPRByUrl(token, url, ws.gitRepoFullName);

        const now = Date.now();
        db().prepare(`
            INSERT OR REPLACE INTO cached_prs
                (workspace_id, pr_number, data, fetched_at)
            VALUES (?, ?, ?, ?)
        `).run(ws.id, pr.number, JSON.stringify(pr), now);

        return pr;
    },

    // ── Internal helper ───────────────────────────────────────────────────────

    _getLinkedIssue(workspaceId: string, issueKey: string): LinkedIssue {
        type IRow = { data: string };
        const issueRow = db()
            .prepare('SELECT data FROM cached_issues WHERE workspace_id = ? AND issue_key = ?')
            .get(workspaceId, issueKey) as IRow | undefined;

        if (!issueRow) throw new Error(`Issue ${issueKey} not in cache`);

        type PRow = { data: string };
        const allPRRows = db()
            .prepare('SELECT data FROM cached_prs WHERE workspace_id = ?')
            .all(workspaceId) as PRow[];

        const issue = JSON.parse(issueRow.data) as Issue;
        const allPRs = allPRRows.map(r => JSON.parse(r.data) as GitHubPR);
        const allIssueRows = db()
            .prepare('SELECT data FROM cached_issues WHERE workspace_id = ?')
            .all(workspaceId) as IRow[];
        const allIssues = allIssueRows.map(r => JSON.parse(r.data) as Issue);

        const linked = assembleLinkedIssues(allIssues, allPRs, workspaceId);
        const found = linked.find(i => i.key === issueKey);

        if (!found) throw new Error(`Could not assemble LinkedIssue for ${issueKey}`);
        return found;
    },
};