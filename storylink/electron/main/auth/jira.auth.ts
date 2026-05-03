// electron/main/auth/jira.auth.ts
import { shell, safeStorage, app } from 'electron';
import axios from 'axios';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

// safeStorage encrypts with OS APIs (DPAPI on Windows, Keychain on macOS)
// Data is stored as encrypted files in the app's userData folder.
// No native addon needed — built into Electron.

function getStorePath(): string {
    const dir = path.join(app.getPath('userData'), 'tokens');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function tokenFilePath(accountId: string): string {
    // Sanitise accountId so it's safe as a filename
    const safe = accountId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(getStorePath(), `${safe}.enc`);
}

// ── Token storage ─────────────────────────────────────────────────────────────

export async function storeTokens(accountId: string, tokens: any) {
    const payload = JSON.stringify({
        ...tokens,
        expires_at: Date.now() + tokens.expires_in * 1000,
    });

    const encrypted = safeStorage.encryptString(payload);
    fs.writeFileSync(tokenFilePath(accountId), encrypted);
}

export async function getTokens(accountId: string) {
    const filePath = tokenFilePath(accountId);
    if (!fs.existsSync(filePath)) return null;

    try {
        const encrypted = fs.readFileSync(filePath);
        const decrypted = safeStorage.decryptString(encrypted);
        return JSON.parse(decrypted);
    } catch {
        return null;
    }
}

export async function deleteTokens(accountId: string) {
    const filePath = tokenFilePath(accountId);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

export async function listAccounts(): Promise<string[]> {
    const dir = getStorePath();
    if (!fs.existsSync(dir)) return [];

    return fs
        .readdirSync(dir)
        .filter(f => f.endsWith('.enc'))
        .map(f => f.replace('.enc', ''));
}

// ── Credentials ───────────────────────────────────────────────────────────────

function getCredentials() {
    const clientId = process.env.JIRA_CLIENT_ID ?? '';
    const clientSecret = process.env.JIRA_CLIENT_SECRET ?? '';

    if (!clientId || !clientSecret) {
        throw new Error('JIRA_CLIENT_ID and JIRA_CLIENT_SECRET must be set in .env');
    }

    return { clientId, clientSecret };
}

const REDIRECT_URI = 'storylink://callback';
const TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
const CLOUD_URL = 'https://api.atlassian.com/oauth/token/accessible-resources';

let authWindowResolve: ((code: string) => void) | null = null;

// ── OAuth flow ────────────────────────────────────────────────────────────────

export function startJiraAuth(): Promise<string> {
    return new Promise((resolve) => {
        authWindowResolve = resolve;
        const { clientId } = getCredentials();

        const authUrl =
            `https://auth.atlassian.com/authorize?` +
            `audience=api.atlassian.com&` +
            `client_id=${clientId}&` +
            `scope=read:jira-work%20offline_access&` +
            `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
            `response_type=code&` +
            `prompt=consent`;

        shell.openExternal(authUrl);
    });
}

export function handleCallback(url: string) {
    const parsed = new URL(url);
    const code = parsed.searchParams.get('code');

    if (code && authWindowResolve) {
        authWindowResolve(code);
        authWindowResolve = null;
    }
}

export async function exchangeCode(code: string) {
    const { clientId, clientSecret } = getCredentials();

    const res = await axios.post(TOKEN_URL, {
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: REDIRECT_URI,
    });
    return res.data;
}

// ── Token refresh ─────────────────────────────────────────────────────────────

export async function refreshAccessToken(accountId: string) {
    const { clientId, clientSecret } = getCredentials();
    const tokens = await getTokens(accountId);
    if (!tokens) throw new Error('No tokens found for account: ' + accountId);

    const res = await axios.post(TOKEN_URL, {
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokens.refresh_token,
    });

    await storeTokens(accountId, res.data);
    return res.data;
}

export async function getValidAccessToken(accountId: string): Promise<string> {
    const tokens = await getTokens(accountId);
    if (!tokens) throw new Error('Jira not authorised for account: ' + accountId);

    if (Date.now() > tokens.expires_at) {
        const refreshed = await refreshAccessToken(accountId);
        return refreshed.access_token;
    }

    return tokens.access_token;
}

// ── Cloud ID ──────────────────────────────────────────────────────────────────

export async function getCloudId(accessToken: string): Promise<string> {
    const res = await axios.get(CLOUD_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.data[0].id;
}