// electron/main/ipc/ipchandlers.ts
import { ipcMain } from 'electron';
import { workspaceService } from '../services/workspace.service';
import { jiraOnboardingService } from '../services/jiraOnboarding.service';
import { githubOnboardingService } from '../services/githubOnboarding.service';
import { getValidAccessToken, getCloudId, listAccounts } from '../auth/jira.auth';
import { getJiraIssues } from '../services/jira.services';
import { workspaceStore } from '../store/workspace.store';

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

    ipcMain.handle('workspace:list', () => workspaceService.list());
    ipcMain.handle('workspace:getActive', () => workspaceService.getActive());

    ipcMain.handle('workspace:setActive',
        handle((id: string) => workspaceService.setActive(id))
    );

    ipcMain.handle('workspace:remove',
        handle((id: string) => workspaceService.remove(id))
    );

    // Renderer sends only display data — both accountIds are resolved
    // server-side from the pending onboarding sessions.
    ipcMain.handle('workspace:create',
        handle((payload: {
            name: string;
            projectKey: string;
            projectName: string;
            gitRepoFullName: string;
            gitRepoId: number;
        }) => {
            const accountId = jiraOnboardingService.consumeAccountId();
            const gitAccountId = githubOnboardingService.consumeAccountId();

            return workspaceService.create({
                ...payload,
                accountId,
                gitAccountId,
            });
        })
    );

    // ── Jira onboarding ───────────────────────────────────────────────────────

    ipcMain.handle('jira:connect',
        handle(() => jiraOnboardingService.connect())
    );

    ipcMain.handle('jira:getProjectsForNewAccount',
        handle(() => jiraOnboardingService.getProjects())
    );

    // ── GitHub onboarding ─────────────────────────────────────────────────────

    ipcMain.handle('github:connect',
        handle(() => githubOnboardingService.connect())
    );

    ipcMain.handle('github:getReposForNewAccount',
        handle(() => githubOnboardingService.getRepos())
    );

    // ── Jira issues ───────────────────────────────────────────────────────────

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

    // ── Accounts / connection status ──────────────────────────────────────────

    ipcMain.handle('jira:listAccounts',
        handle(async () => ({ accounts: await listAccounts() }))
    );

    ipcMain.handle('jira:isConnected',
        handle(async () => {
            const accounts = await listAccounts();
            return { connected: accounts.length > 0 };
        })
    );
}