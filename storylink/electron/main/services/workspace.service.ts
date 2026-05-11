// electron/main/services/workspace.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// All reads/writes go through the SQLite db singleton.
// Tokens still live in safeStorage; account_id / git_account_id are
// just the filename keys used to look them up.
// ─────────────────────────────────────────────────────────────────────────────

import { db } from '../db/db';
import { deleteTokens } from '../auth/jira.auth';
import { deleteGitHubTokens } from '../auth/github.auth';
import type {
    Workspace,
    WorkspaceView,
    ActiveWorkspaceView,
} from '@shared/types/workspace.types';

// ── Row shape coming out of SQLite ────────────────────────────────────────────

type WorkspaceRow = {
    id: string;
    name: string;
    account_id: string;
    project_key: string;
    project_name: string;
    git_account_id: string;
    git_repo_full_name: string;
    git_repo_id: number;
    is_active: number;
    created_at: number;
};

function rowToWorkspace(row: WorkspaceRow): Workspace {
    return {
        id: row.id,
        name: row.name,
        accountId: row.account_id,
        projectKey: row.project_key,
        projectName: row.project_name,
        gitAccountId: row.git_account_id,
        gitRepoFullName: row.git_repo_full_name,
        gitRepoId: row.git_repo_id,
        isActive: row.is_active === 1,
        createdAt: row.created_at,
    };
}

function rowToView(row: WorkspaceRow): WorkspaceView {
    return {
        id: row.id,
        name: row.name,
        projectKey: row.project_key,
        projectName: row.project_name,
        gitRepoFullName: row.git_repo_full_name,
        isActive: row.is_active === 1,
    };
}

// ── Service ───────────────────────────────────────────────────────────────────

export const workspaceService = {

    list(): WorkspaceView[] {
        const rows = db()
            .prepare('SELECT * FROM workspaces ORDER BY created_at ASC')
            .all() as WorkspaceRow[];
        return rows.map(rowToView);
    },

    getActive(): ActiveWorkspaceView {
        const row = db()
            .prepare('SELECT * FROM workspaces WHERE is_active = 1 LIMIT 1')
            .get() as WorkspaceRow | undefined;
        if (!row) return null;
        return {
            id: row.id,
            name: row.name,
            projectKey: row.project_key,
            projectName: row.project_name,
            gitRepoFullName: row.git_repo_full_name,
        };
    },

    getActiveInternal(): Workspace | null {
        const row = db()
            .prepare('SELECT * FROM workspaces WHERE is_active = 1 LIMIT 1')
            .get() as WorkspaceRow | undefined;
        return row ? rowToWorkspace(row) : null;
    },

    findInternal(id: string): Workspace | null {
        const row = db()
            .prepare('SELECT * FROM workspaces WHERE id = ? LIMIT 1')
            .get(id) as WorkspaceRow | undefined;
        return row ? rowToWorkspace(row) : null;
    },

    setActive(id: string): void {
        const exists = db()
            .prepare('SELECT id FROM workspaces WHERE id = ?')
            .get(id);
        if (!exists) throw new Error(`Workspace not found: ${id}`);

        // Prepare statements OUTSIDE the transaction closure — better-sqlite3
        // requirement: don't call db() or prepare() inside a transaction callback.
        const clearAll = db().prepare('UPDATE workspaces SET is_active = 0');
        const setOne = db().prepare('UPDATE workspaces SET is_active = 1 WHERE id = ?');

        db().transaction(() => {
            clearAll.run();
            setOne.run(id);
        })();
    },

    async remove(id: string): Promise<{ success: boolean }> {
        const ws = workspaceService.findInternal(id);
        if (!ws) return { success: true };

        // Only delete Jira token if no other workspace shares it
        const jiraShared = db()
            .prepare('SELECT COUNT(*) as c FROM workspaces WHERE account_id = ? AND id != ?')
            .get(ws.accountId, id) as { c: number };
        if (jiraShared.c === 0) await deleteTokens(ws.accountId);

        // Only delete GitHub token if no other workspace shares it
        const gitShared = db()
            .prepare('SELECT COUNT(*) as c FROM workspaces WHERE git_account_id = ? AND id != ?')
            .get(ws.gitAccountId, id) as { c: number };
        if (gitShared.c === 0) await deleteGitHubTokens(ws.gitAccountId);

        // ON DELETE CASCADE handles pr_links, cached_issues, cached_prs
        db().prepare('DELETE FROM workspaces WHERE id = ?').run(id);

        // If this was active, promote the next oldest workspace
        const next = db()
            .prepare('SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1')
            .get() as { id: string } | undefined;
        if (next) {
            db().prepare('UPDATE workspaces SET is_active = 1 WHERE id = ?').run(next.id);
        }

        return { success: true };
    },

    create(data: {
        name: string;
        projectKey: string;
        projectName: string;
        accountId: string;
        gitAccountId: string;
        gitRepoFullName: string;
        gitRepoId: number;
    }): { workspaceId: string } {
        const id = `ws_${Date.now()}`;
        const now = Date.now();

        const count = (
            db().prepare('SELECT COUNT(*) as c FROM workspaces').get() as { c: number }
        ).c;

        db().prepare(`
            INSERT INTO workspaces
                (id, name, account_id, project_key, project_name,
                 git_account_id, git_repo_full_name, git_repo_id, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id,
            data.name,
            data.accountId,
            data.projectKey,
            data.projectName,
            data.gitAccountId,
            data.gitRepoFullName,
            data.gitRepoId,
            count === 0 ? 1 : 0,
            now,
        );

        return { workspaceId: id };
    },
};