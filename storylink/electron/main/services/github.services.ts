// electron/main/services/github.services.ts
import axios from 'axios';
import type { GitRepo } from '@shared/types/workspace.types';

const isDev = process.env.NODE_ENV !== 'production';

const BASE = 'https://api.github.com';

function headers(token: string) {
    return {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    };
}

/**
 * Returns all repos the authenticated user has access to
 * (own repos + org repos), sorted by last push, max 100.
 */
export async function getGitHubRepos(accessToken: string): Promise<GitRepo[]> {
    if (isDev) console.log('[github.services] getRepos');

    try {
        const res = await axios.get(`${BASE}/user/repos`, {
            headers: headers(accessToken),
            params: {
                sort: 'pushed',
                per_page: 100,
                affiliation: 'owner,collaborator,organization_member',
            },
        });

        return res.data.map((r: any): GitRepo => ({
            id: r.id,
            fullName: r.full_name,
            name: r.name,
            private: r.private,
            url: r.html_url,
        }));

    } catch (err: any) {
        if (isDev) {
            console.error('[github.services] getRepos FAILED');
            console.error('[github.services] status:', err.response?.status);
            console.error('[github.services] data  :', JSON.stringify(err.response?.data, null, 2));
        }
        throw err;
    }
}

/**
 * Returns the authenticated user's GitHub login name.
 * Used for display purposes only.
 */
export async function getGitHubUser(accessToken: string): Promise<string> {
    const res = await axios.get(`${BASE}/user`, {
        headers: headers(accessToken),
    });
    return res.data.login;
}