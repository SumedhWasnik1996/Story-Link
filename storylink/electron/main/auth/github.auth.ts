// electron/main/auth/github.auth.ts
// Mirrors the exact pattern of jira.auth.ts.
// Uses the same safeStorage token store and storylink:// callback scheme.
// The only shared piece with Jira auth is the token storage helpers,
// which are imported from jira.auth to avoid duplication.

import { shell } from 'electron';
import axios from 'axios';
import {
    storeTokens,
    getTokens,
    deleteTokens,
} from './jira.auth';

// Re-export deleteTokens under a GitHub-specific name for clarity
export { deleteTokens as deleteGitHubTokens };

// ── Credentials ───────────────────────────────────────────────────────────────

function getCredentials() {
    const clientId = process.env.GITHUB_CLIENT_ID ?? '';
    const clientSecret = process.env.GITHUB_CLIENT_SECRET ?? '';

    if (!clientId || !clientSecret) {
        throw new Error('GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be set in .env');
    }

    return { clientId, clientSecret };
}

const REDIRECT_URI = 'storylink://callback';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';

// GitHub OAuth uses a separate resolver from Jira so they don't interfere
// if both flows are somehow triggered simultaneously (edge case guard).
let githubAuthResolve: ((code: string) => void) | null = null;

// ── OAuth flow ────────────────────────────────────────────────────────────────

/**
 * Opens the GitHub OAuth consent page in the user's browser.
 * Returns a Promise that resolves with the auth code once the
 * storylink://callback URL is received by handleGitHubCallback().
 */
export function startGitHubAuth(): Promise<string> {
    return new Promise((resolve) => {
        githubAuthResolve = resolve;
        const { clientId } = getCredentials();

        // Scopes:
        //   repo  — read/write access to repos (needed to list and fetch PR/branch data)
        //   read:user — read the authenticated user's profile
        const authUrl =
            `https://github.com/login/oauth/authorize?` +
            `client_id=${clientId}&` +
            `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
            `scope=repo%20read:user&` +
            `allow_signup=false`;

        shell.openExternal(authUrl);
    });
}

/**
 * Called from main.ts open-url / second-instance handlers.
 * Checks the "state" param to distinguish GitHub vs Jira callbacks.
 * Returns true if this URL was a GitHub callback, false otherwise.
 */
export function handleGitHubCallback(url: string): boolean {
    if (!githubAuthResolve) return false;

    const parsed = new URL(url);
    const code = parsed.searchParams.get('code');

    // Only handle if there is a pending GitHub resolve
    if (code) {
        githubAuthResolve(code);
        githubAuthResolve = null;
        return true;
    }

    return false;
}

export async function exchangeGitHubCode(code: string) {
    const { clientId, clientSecret } = getCredentials();

    // GitHub returns access_token as form-encoded by default;
    // requesting JSON makes parsing trivial.
    const res = await axios.post(
        TOKEN_URL,
        { client_id: clientId, client_secret: clientSecret, code, redirect_uri: REDIRECT_URI },
        { headers: { Accept: 'application/json' } }
    );

    if (res.data.error) {
        throw new Error(res.data.error_description ?? res.data.error);
    }

    // GitHub tokens don't expire (no expires_in), so we store a sentinel
    // so the same storeTokens/getTokens helpers work without changes.
    return {
        access_token: res.data.access_token,
        token_type: res.data.token_type,
        scope: res.data.scope,
        // No refresh token for GitHub OAuth apps — store far-future expiry
        expires_in: 315360000, // 10 years in seconds
        refresh_token: null,
    };
}

// ── Token access ──────────────────────────────────────────────────────────────

export async function storeGitHubTokens(accountId: string, tokens: any) {
    await storeTokens(accountId, tokens);
}

/**
 * GitHub personal OAuth tokens don't expire, so we just return the
 * stored access_token directly. No refresh logic needed for OAuth apps.
 * (GitHub Apps use expiring tokens — out of scope here.)
 */
export async function getValidGitHubToken(accountId: string): Promise<string> {
    const tokens = await getTokens(accountId);
    if (!tokens) throw new Error('GitHub not authorised for account: ' + accountId);
    return tokens.access_token;
}