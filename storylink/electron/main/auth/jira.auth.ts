// electron/main/auth/jira.auth.ts
// ─────────────────────────────────────────────────────────────────────────────
// Jira OAuth 2.0 (3-LO) flow + safeStorage-backed token persistence.
// Also owns the generic storeTokens / getTokens / deleteTokens helpers
// that github.auth.ts re-uses for GitHub token storage.
// ─────────────────────────────────────────────────────────────────────────────

import { shell, safeStorage, app } from 'electron';
import axios from 'axios';
import path from 'node:path';
import fs from 'node:fs';

// ── Token file helpers ────────────────────────────────────────────────────────

function tokenDir(): string {
    return path.join(app.getPath('userData'), 'tokens');
}

function tokenPath(accountId: string): string {
    return path.join(tokenDir(), `${accountId}.enc`);
}

/**
 * Encrypts and persists a token payload for the given accountId.
 * Uses Electron safeStorage (OS keychain-backed AES) when available,
 * falls back to plain JSON in dev if safeStorage is unavailable.
 */
export async function storeTokens(accountId: string, tokens: Record<string, any>): Promise<void> {
    fs.mkdirSync(tokenDir(), { recursive: true });
    const json = JSON.stringify(tokens);

    if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(json);
        fs.writeFileSync(tokenPath(accountId), encrypted);
    } else {
        // Dev fallback — write plain JSON with a .json extension
        fs.writeFileSync(tokenPath(accountId) + '.plain', json, 'utf-8');
    }
}

/**
 * Reads and decrypts the stored token payload for the given accountId.
 * Returns null if no token exists.
 */
export async function getTokens(accountId: string): Promise<Record<string, any> | null> {
    if (safeStorage.isEncryptionAvailable()) {
        const file = tokenPath(accountId);
        if (!fs.existsSync(file)) return null;
        const encrypted = fs.readFileSync(file);
        const json = safeStorage.decryptString(encrypted);
        return JSON.parse(json);
    } else {
        const file = tokenPath(accountId) + '.plain';
        if (!fs.existsSync(file)) return null;
        return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
}

/**
 * Deletes stored tokens for the given accountId (both encrypted and plain).
 */
export async function deleteTokens(accountId: string): Promise<void> {
    const enc = tokenPath(accountId);
    const plain = enc + '.plain';
    if (fs.existsSync(enc)) fs.unlinkSync(enc);
    if (fs.existsSync(plain)) fs.unlinkSync(plain);
}

/**
 * Returns all accountIds that have stored tokens.
 */
export async function listAccounts(): Promise<string[]> {
    const dir = tokenDir();
    if (!fs.existsSync(dir)) return [];

    return fs
        .readdirSync(dir)
        .filter(f => f.endsWith('.enc') || f.endsWith('.enc.plain'))
        .map(f => f.replace(/\.enc(\.plain)?$/, ''));
}

// ── Jira credentials ──────────────────────────────────────────────────────────

function getCredentials() {
    const clientId = process.env.JIRA_CLIENT_ID ?? '';
    const clientSecret = process.env.JIRA_CLIENT_SECRET ?? '';
    if (!clientId || !clientSecret) {
        throw new Error('JIRA_CLIENT_ID and JIRA_CLIENT_SECRET must be set in .env');
    }
    return { clientId, clientSecret };
}

const REDIRECT_URI = 'storylink://callback';
const JIRA_AUTH_URL = 'https://auth.atlassian.com/authorize';
const JIRA_TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
const JIRA_CLOUD_URL = 'https://api.atlassian.com/oauth/token/accessible-resources';

// ── Jira OAuth flow ───────────────────────────────────────────────────────────

let jiraAuthResolve: ((code: string) => void) | null = null;

/**
 * Opens the Atlassian OAuth consent page in the browser and waits for
 * the storylink://callback deep link to deliver the auth code.
 */
export function startJiraAuth(): Promise<string> {
    return new Promise((resolve) => {
        jiraAuthResolve = resolve;
        const { clientId } = getCredentials();

        const authUrl =
            `${JIRA_AUTH_URL}?` +
            `audience=api.atlassian.com&` +
            `client_id=${clientId}&` +
            `scope=${encodeURIComponent('read:jira-work read:jira-user offline_access')}&` +
            `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
            `response_type=code&` +
            `prompt=consent`;

        shell.openExternal(authUrl);
    });
}

/**
 * Called from main.ts routeCallback after GitHub has already declined the URL.
 * Resolves the pending startJiraAuth() promise with the auth code.
 */
export function handleCallback(url: string): void {
    if (!jiraAuthResolve) return;

    const parsed = new URL(url);
    const code = parsed.searchParams.get('code');

    if (code) {
        jiraAuthResolve(code);
        jiraAuthResolve = null;
    }
}

/**
 * Exchanges an auth code for access + refresh tokens.
 */
export async function exchangeCode(code: string): Promise<Record<string, any>> {
    const { clientId, clientSecret } = getCredentials();

    const res = await axios.post(
        JIRA_TOKEN_URL,
        {
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: REDIRECT_URI,
        },
        { headers: { 'Content-Type': 'application/json' } }
    );

    return {
        access_token: res.data.access_token,
        refresh_token: res.data.refresh_token,
        expires_in: res.data.expires_in,
        token_type: res.data.token_type,
        issued_at: Date.now(),
    };
}

/**
 * Refreshes an expired access token using the stored refresh token.
 */
async function refreshAccessToken(accountId: string, tokens: Record<string, any>): Promise<Record<string, any>> {
    const { clientId, clientSecret } = getCredentials();

    const res = await axios.post(
        JIRA_TOKEN_URL,
        {
            grant_type: 'refresh_token',
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: tokens.refresh_token,
        },
        { headers: { 'Content-Type': 'application/json' } }
    );

    const refreshed = {
        ...tokens,
        access_token: res.data.access_token,
        refresh_token: res.data.refresh_token ?? tokens.refresh_token,
        expires_in: res.data.expires_in,
        issued_at: Date.now(),
    };

    await storeTokens(accountId, refreshed);
    return refreshed;
}

/**
 * Returns a valid (non-expired) Jira access token, refreshing if needed.
 */
export async function getValidAccessToken(accountId: string): Promise<string> {
    const tokens = await getTokens(accountId);
    if (!tokens) throw new Error('Jira not authorised for account: ' + accountId);

    const expiresAt = (tokens.issued_at ?? 0) + (tokens.expires_in ?? 0) * 1000;
    const isExpired = Date.now() > expiresAt - 60_000; // refresh 1 min early

    if (isExpired && tokens.refresh_token) {
        const refreshed = await refreshAccessToken(accountId, tokens);
        return refreshed.access_token;
    }

    return tokens.access_token;
}

/**
 * Fetches the Atlassian Cloud ID for the first accessible site.
 * Required for all Jira API v3 calls.
 */
export async function getCloudId(accessToken: string): Promise<string> {
    const res = await axios.get(JIRA_CLOUD_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    const sites: any[] = res.data;
    if (!sites.length) throw new Error('No accessible Jira sites found for this account.');

    return sites[0].id;
}