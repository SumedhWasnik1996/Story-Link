// electron/main/ipc/ipchandlers.ts
import { ipcMain } from 'electron';
import { workspaceService } from '../services/workspace.service';
import { jiraOnboardingService } from '../services/jiraOnboarding.service';
import { getValidAccessToken, getCloudId, listAccounts } from '../auth/jira.auth';
import { getJiraIssues } from '../services/jira.services';
import { workspaceStore } from '../store/workspace.store';

/** Wraps a handler so it always returns { success, ...result } or { success: false, error }. */
function handle(fn: (...args: any[]) => any) {
    return async (_e: Electron.IpcMainInvokeEvent, ...args: any[]) => {
        try {
            const result = await fn(...args);
            return { success: true, ...(result ?? {}) };
        } catch (err: any) {
            return { success: false, error: err.message ?? String(err) };
        }
    };
}

export function registerIpcHandlers(): void {

    ipcMain.handle('ping', () => 'pong');

    // ── Workspace ─────────────────────────────────────────────────────────────

    // Returns WorkspaceView[]  — no accountId
    ipcMain.handle('workspace:list', () => workspaceService.list());

    // Returns ActiveWorkspaceView | null — no accountId
    ipcMain.handle('workspace:getActive', () => workspaceService.getActive());

    ipcMain.handle('workspace:setActive',
        handle((id: string) => workspaceService.setActive(id))
    );

    ipcMain.handle('workspace:remove',
        handle((id: string) => workspaceService.remove(id))
    );

    // payload: { name, projectKey, projectName }  — renderer never sends accountId
    ipcMain.handle('workspace:create',
        handle((payload: { name: string; projectKey: string; projectName: string }) => {
            // accountId is fetched from the pending onboarding session — never from renderer
            const accountId = jiraOnboardingService.consumeAccountId();
            return workspaceService.create({ ...payload, accountId });
        })
    );

    // ── Jira onboarding ───────────────────────────────────────────────────────

    ipcMain.handle('jira:connect',
        handle(() => jiraOnboardingService.connect())
    );

    ipcMain.handle('jira:getProjectsForNewAccount',
        handle(() => jiraOnboardingService.getProjects())
    );

    // ── Issues ────────────────────────────────────────────────────────────────

    ipcMain.handle('jira:getIssues',
        handle(async () => {
            const ws = workspaceStore.getActive();
            if (!ws) throw new Error('No active workspace');

            const token = await getValidAccessToken(ws.accountId);
            const cloudId = await getCloudId(token);
            const issues = await getJiraIssues(token, cloudId, ws.projectKey);

            return { issues };
        })
    );

    // ── Accounts ──────────────────────────────────────────────────────────────

    ipcMain.handle('jira:listAccounts',
        handle(async () => ({ accounts: await listAccounts() }))
    );

    // ── Connection check ──────────────────────────────────────────────────────
    // Derived from whether any accounts exist in the token store.

    ipcMain.handle('jira:isConnected',
        handle(async () => {
            const accounts = await listAccounts();
            return { connected: accounts.length > 0 };
        })
    );
}