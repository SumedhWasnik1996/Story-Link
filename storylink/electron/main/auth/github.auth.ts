// electron/main/auth/github.auth.ts
import { shell } from 'electron';
import axios from 'axios';
import { storeTokens, getTokens, deleteTokens } from './jira.auth';

export { deleteTokens as deleteGitHubTokens };

export function getApiBase(host: string): string {
    return host === 'github.com'
        ? 'https://api.github.com'
        : `https://${host}/api/v3`;
}

function getCredentials() {
    const clientId = process.env.GITHUB_CLIENT_ID ?? '';
    const clientSecret = process.env.GITHUB_CLIENT_SECRET ?? '';
    if (!clientId || !clientSecret) {
        throw new Error('GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be set in .env');
    }
    return { clientId, clientSecret };
}

const REDIRECT_URI = 'storylink://callback';

let githubAuthResolve: ((code: string) => void) | null = null;

export function startGitHubAuth(): Promise<string> {
    return new Promise((resolve) => {
        githubAuthResolve = resolve;
        const { clientId } = getCredentials();
        const authUrl =
            `https://github.com/login/oauth/authorize?` +
            `client_id=${clientId}&` +
            `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
            `scope=repo%20read:org%20read:user&` +
            `allow_signup=false`;
        shell.openExternal(authUrl);
    });
}

export function handleGitHubCallback(url: string): boolean {
    if (!githubAuthResolve) return false;
    const parsed = new URL(url);
    const code = parsed.searchParams.get('code');
    if (code) {
        githubAuthResolve(code);
        githubAuthResolve = null;
        return true;
    }
    return false;
}

export async function exchangeGitHubCode(code: string) {
    const { clientId, clientSecret } = getCredentials();
    const res = await axios.post(
        'https://github.com/login/oauth/access_token',
        { client_id: clientId, client_secret: clientSecret, code, redirect_uri: REDIRECT_URI },
        { headers: { Accept: 'application/json' } }
    );
    if (res.data.error) throw new Error(res.data.error_description ?? res.data.error);
    return {
        access_token: res.data.access_token,
        token_type: res.data.token_type,
        scope: res.data.scope,
        expires_in: 315_360_000,
        refresh_token: null,
    };
}

export async function storeGitHubTokens(accountId: string, tokens: any, host = 'github.com') {
    await storeTokens(accountId, { ...tokens, host });
}

export async function getGitHubHost(accountId: string): Promise<string> {
    const tokens = await getTokens(accountId);
    if (!tokens) throw new Error('GitHub not authorised for account: ' + accountId);
    return tokens.host ?? 'github.com';
}

export async function getValidGitHubToken(accountId: string): Promise<string> {
    const tokens = await getTokens(accountId);
    if (!tokens) throw new Error('GitHub not authorised for account: ' + accountId);
    return tokens.access_token;
}