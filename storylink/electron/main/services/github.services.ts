// electron/main/services/github.services.ts
import axios, { AxiosRequestConfig } from 'axios';
import { getApiBase } from '../auth/github.auth';
import type { GitRepo, GitHubPR } from '@shared/types/workspace.types';

const isDev = process.env.NODE_ENV !== 'production';

function authHeaders(token: string) {
    return {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    };
}

async function ghGet<T>(token: string, host: string, path: string, params?: Record<string, string | number>): Promise<T> {
    const url = `${getApiBase(host)}${path}`;
    const config: AxiosRequestConfig = { headers: authHeaders(token), params };
    const res = await axios.get(url, config);
    return res.data as T;
}

function mapRepo(r: any): GitRepo {
    return { id: r.id, fullName: r.full_name, name: r.name, private: r.private, url: r.html_url };
}

function mapPR(r: any): GitHubPR {
    return {
        number: r.number, title: r.title, state: r.state,
        merged: !!r.merged_at, draft: r.draft ?? false,
        branch: r.head?.ref ?? '', url: r.html_url,
    };
}

// ── URL parser ────────────────────────────────────────────────────────────────

type ParsedRepoUrl = { host: string; ownerRepo: string };

export function parseRepoUrl(input: string): ParsedRepoUrl {
    const raw = input.trim().replace(/\/$/, ''); // strip trailing slash

    // SSH: git@hostname:owner/repo[.git]
    const ssh = raw.match(/^git@([^:]+):([^/]+\/[^/]+?)(?:\.git)?$/);
    if (ssh) return { host: ssh[1], ownerRepo: ssh[2] };

    // HTTPS — parse as URL then extract first two path segments
    // This handles .git suffix, trailing slashes, and extra path segments
    // like /tree/main or /blob/main/README.md gracefully.
    try {
        const u = new URL(raw.endsWith('.git') ? raw.slice(0, -4) : raw);
        const parts = u.pathname.replace(/^\//, '').split('/');
        if (parts.length >= 2 && parts[0] && parts[1]) {
            return { host: u.hostname, ownerRepo: `${parts[0]}/${parts[1]}` };
        }
    } catch {
        // not a valid URL — fall through to shorthand
    }

    // Shorthand: owner/repo
    const short = raw.match(/^([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)$/);
    if (short) return { host: 'github.com', ownerRepo: short[1] };

    throw new Error(
        `Could not parse GitHub repo URL: "${raw}". ` +
        `Expected: https://github.com/owner/repo, git@github.com:owner/repo.git, or owner/repo`
    );
}

export async function getAllRepos(accessToken: string, host: string): Promise<GitRepo[]> {
    if (isDev) console.log('[github.services] getAllRepos host:', host);

    const seen = new Set<number>();
    const repos: GitRepo[] = [];

    function addRepo(raw: any) {
        if (seen.has(raw.id)) return;
        seen.add(raw.id);
        repos.push(mapRepo(raw));
    }

    async function fetchAllUserRepos() {
        let page = 1;
        while (true) {
            const data = await ghGet<any[]>(accessToken, host, '/user/repos', {
                visibility: 'all',
                per_page: 100,
                page,
            }).catch(err => {
                if (isDev) console.error('[github.services] /user/repos failed:', err.response?.status);
                return [] as any[];
            });
            data.forEach(addRepo);
            if (data.length < 100) break;
            page++;
        }
    }

    async function fetchCollaboratorRepos() {
        let page = 1;
        while (true) {
            const data = await ghGet<any[]>(accessToken, host, '/user/repos', {
                affiliation: 'collaborator',
                per_page: 100,
                page,
            }).catch(err => {
                if (isDev) console.error('[github.services] /user/repos (collaborator) failed:', err.response?.status);
                return [] as any[];
            });
            data.forEach(addRepo);
            if (data.length < 100) break;
            page++;
        }
    }

    async function fetchAllOrgRepos() {
        const orgs = await ghGet<any[]>(accessToken, host, '/user/orgs', { per_page: 100 })
            .catch(err => {
                if (isDev) console.error('[github.services] /user/orgs failed:', err.response?.status);
                return [] as any[];
            });
        console.log('Org', orgs);
        if (isDev) console.log('[github.services] orgs found:', orgs.length);
        await Promise.allSettled(
            orgs.map(org =>
                ghGet<any[]>(accessToken, host, `/orgs/${org.login}/repos`, {
                    type: 'all', per_page: 100,
                }).then(data => data.forEach(addRepo))
                    .catch(err => {
                        if (isDev) console.warn(`[github.services] /orgs/${org.login}/repos failed:`, err.response?.status);
                    })
            )
        );
    }

    await Promise.all([fetchAllUserRepos(), fetchCollaboratorRepos(), fetchAllOrgRepos()]);

    if (isDev) console.log('[github.services] total unique repos:', repos.length);
    repos.sort((a, b) => a.fullName.localeCompare(b.fullName));
    return repos;
}

export async function getGitHubPRs(accessToken: string, repoFullName: string, host = 'github.com'): Promise<GitHubPR[]> {
    if (isDev) console.log('[github.services] getPRs:', repoFullName, 'host:', host);
    const data = await ghGet<any[]>(accessToken, host, `/repos/${repoFullName}/pulls`, {
        state: 'all', per_page: 100, sort: 'updated', direction: 'desc',
    });
    return data.map(mapPR);
}

export async function getPRByUrl(accessToken: string, url: string, expectedRepoFullName: string, host = 'github.com'): Promise<GitHubPR> {
    const match = url.match(/github[^/]*\/([^/]+\/[^/]+)\/pull\/(\d+)/);
    if (!match) throw new Error('Invalid GitHub PR URL');
    const [, repoFullName, numberStr] = match;
    if (repoFullName.toLowerCase() !== expectedRepoFullName.toLowerCase()) {
        throw new Error(`PR belongs to ${repoFullName}, not the linked repo ${expectedRepoFullName}`);
    }
    const data = await ghGet<any>(accessToken, host, `/repos/${repoFullName}/pulls/${numberStr}`);
    return mapPR(data);
}

export async function getGitHubUser(accessToken: string, host = 'github.com'): Promise<string> {
    const data = await ghGet<any>(accessToken, host, '/user');
    return data.login;
}

export async function getGitHubRepos(accessToken: string): Promise<GitRepo[]> {
    return getAllRepos(accessToken, 'github.com');
}

export async function getRepoByUrl(accessToken: string, url: string): Promise<GitRepo & { host: string }> {
    const { host, ownerRepo } = parseRepoUrl(url);
    console.log('Owner Repo ',ownerRepo);
    if (isDev) console.log('[github.services] getRepoByUrl host:', host, 'repo:', ownerRepo);
    try {
        const data = await ghGet<any>(accessToken, host, `/repos/${ownerRepo}`);
        return { ...mapRepo(data), host };
    } catch (err: any) {
        console.log('Get Repo by URL ', err);
        const status = err.response?.status;
        if (status === 404) throw new Error(`Repository "${ownerRepo}" not found on ${host}.`);
        if (status === 401 || status === 403) throw new Error(`Access denied to "${ownerRepo}" on ${host}.`);
        throw err;
    }
}