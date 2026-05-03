/* eslint-disable @typescript-eslint/no-explicit-any */
// electron/main/ipc/ipchandlers.ts
import { ipcMain } from 'electron';
import {
    startJiraAuth,
    exchangeCode,
    storeTokens,
    getValidAccessToken,
    getCloudId,
    getTokens,
    deleteTokens,
    listAccounts,
} from '../auth/jira.auth';
import {
    getJiraIssues,
    getProjects,
} from '../services/jira.services';

// ── Active workspace ──────────────────────────────────────────────────────────
// The main process owns this. Set once when user activates a workspace.
// All data handlers derive what they need from here — callers pass zero params.

type ActiveWorkspace = {
    id: string;
    name: string;
    accountId: string;
    projectKey: string;
    projectName: string;
};

let activeWorkspace: ActiveWorkspace | null = null;

function requireActiveWorkspace(): ActiveWorkspace {
    if (!activeWorkspace) throw new Error('No active workspace. Activate one first.');
    return activeWorkspace;
}

const log = {
    info: (...args: any[]) => process.env.NODE_ENV !== 'production' && console.log('[IPC]', ...args),
    error: (...args: any[]) => process.env.NODE_ENV !== 'production' && console.error('[IPC]', ...args),
};

// ── Handlers ──────────────────────────────────────────────────────────────────

export function registerIpcHandlers() {

    ipcMain.handle('ping', async () => 'pong');

    // ── Workspace activation — the one call that carries data ─────────────────
    // After this, all data calls are zero-param.
    ipcMain.handle('workspace:activate', (_event, workspace: ActiveWorkspace) => {
        activeWorkspace = workspace;
    });

    ipcMain.handle('workspace:deactivate', () => {
        activeWorkspace = null;
    });

    // ── Zero-param data calls — everything resolved from activeWorkspace ───────

    ipcMain.handle('jira:getIssues', async () => {
        try {
            const { accountId, projectKey } = requireActiveWorkspace();
            log.info('getIssues → accountId:', accountId, 'projectKey:', projectKey);

            const token = await getValidAccessToken(accountId);
            const cloudId = await getCloudId(token);
            log.info('getIssues → cloudId:', cloudId);

            const issues = await getJiraIssues(token, cloudId, projectKey);
            log.info('getIssues → returned', issues.length, 'issues');

            return { success: true, issues };
        } catch (err: any) {
            log.error('getIssues failed:', err.message);
            log.error('getIssues stack:', err.stack);
            return { success: false, error: err.message };
        }
    });

    // Used when the active workspace is set and user navigates to project list
    ipcMain.handle('jira:getProjects', async () => {
        try {
            const { accountId } = requireActiveWorkspace();
            const token = await getValidAccessToken(accountId);
            const cloudId = await getCloudId(token);
            const projects = await getProjects(token, cloudId);
            return { success: true, projects };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    // ── Account management — explicit accountId required ──────────────────────
    // These deal with accounts that may not be active yet (setup wizard, removal)

    // Step 1 of Add Workspace: OAuth for a brand-new account
    ipcMain.handle('jira:connect', async (_event, accountId: string) => {
        try {
            const code = await startJiraAuth();
            const tokens = await exchangeCode(code);
            await storeTokens(accountId, tokens);
            return { success: true };
        } catch (err: any) {
            console.error('[jira:connect] failed:', err.message);
            return { success: false, error: err.message };
        }
    });

    // Step 2 of Add Workspace: fetch projects for the newly authed account.
    // A separate handler from jira:getProjects because no workspace is active yet.
    ipcMain.handle('jira:getProjectsForAccount', async (_event, accountId: string) => {
        try {
            const token = await getValidAccessToken(accountId);
            const cloudId = await getCloudId(token);
            const projects = await getProjects(token, cloudId);
            return { success: true, projects };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('jira:isConnected', async (_event, accountId: string) => {
        const tokens = await getTokens(accountId);
        return !!tokens;
    });

    ipcMain.handle('jira:disconnect', async (_event, accountId: string) => {
        try {
            await deleteTokens(accountId);
            if (activeWorkspace?.accountId === accountId) activeWorkspace = null;
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('jira:listAccounts', async () => {
        try {
            return { success: true, accounts: await listAccounts() };
        } catch (err: any) {
            return { success: false, error: err.message, accounts: [] };
        }
    });
}