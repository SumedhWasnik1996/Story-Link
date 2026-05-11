// electron/main/ipc/ipchandlers.ts
import { ipcMain } from 'electron';
import { workspaceService } from '../services/workspace.service';
import { jiraOnboardingService } from '../services/jiraOnboarding.service';
import { githubOnboardingService } from '../services/githubOnboarding.service';
import { storiesService } from '../services/stories.service';
import { getRepoByUrl } from '../services/github.services';
import { getValidAccessToken, getCloudId, listAccounts } from '../auth/jira.auth';
import { getValidGitHubToken } from '../auth/github.auth';
import { getJiraIssues } from '../services/jira.services';

function handle(fn: (...args: any[]) => any) {
    return async (_e: Electron.IpcMainInvokeEvent, ...args: any[]) => {
        try {
            const result = await fn(...args);
            return { success: true, data: result ?? null, error: null };
        } catch (err: any) {
            console.error('[ipc] Error:', err.message);
            return { success: false, data: null, error: err.message ?? String(err) };
        }
    };
}

export function registerIpcHandlers(): void {

    ipcMain.handle('ping', () => 'pong');

    // ── Workspace ─────────────────────────────────────────────────────────────

    ipcMain.handle('workspace:list',
        handle(() => workspaceService.list())
    );

    ipcMain.handle('workspace:getActive',
        handle(() => workspaceService.getActive())
    );

    ipcMain.handle('workspace:setActive',
        handle((id: string) => workspaceService.setActive(id))
    );

    ipcMain.handle('workspace:remove',
        handle((id: string) => workspaceService.remove(id))
    );

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
            return workspaceService.create({ ...payload, accountId, gitAccountId });
        })
    );

    // ── Jira onboarding ───────────────────────────────────────────────────────

    ipcMain.handle('jira:connect',
        handle(() => jiraOnboardingService.connect())
    );

    ipcMain.handle('jira:getProjectsForNewAccount',
        handle(() => jiraOnboardingService.getProjects())
    );

    // ── Jira issues ───────────────────────────────────────────────────────────

    ipcMain.handle('jira:getIssues',
        handle(async () => {
            const active = workspaceService.getActiveInternal();
            if (!active) throw new Error('No active workspace');
            const token = await getValidAccessToken(active.accountId);
            const cloudId = await getCloudId(token);
            return getJiraIssues(token, cloudId, active.projectKey);
        })
    );

    // ── Jira accounts / status ────────────────────────────────────────────────

    ipcMain.handle('jira:listAccounts',
        handle(() => listAccounts())
    );

    ipcMain.handle('jira:isConnected',
        handle(async () => {
            const accounts = await listAccounts();
            return accounts.length > 0;
        })
    );

    // ── GitHub onboarding ─────────────────────────────────────────────────────

    ipcMain.handle('github:connect',
        handle((hostname?: string) => githubOnboardingService.connect(hostname))
    );

    ipcMain.handle('github:getReposForNewAccount',
        handle(() => githubOnboardingService.getRepos())
    );

    ipcMain.handle('github:getRepoByUrl',
        handle(async (url: string) => {
            if (!url?.trim()) throw new Error('URL is required');
            const accountId = githubOnboardingService.peekAccountId();
            const token = await getValidGitHubToken(accountId);
            return getRepoByUrl(token, url);
        })
    );

    // ── Stories ───────────────────────────────────────────────────────────────

    ipcMain.handle('stories:sync',
        handle(() => storiesService.sync())
    );

    ipcMain.handle('stories:searchPRs',
        handle((query: string) => storiesService.searchPRs(query ?? ''))
    );

    ipcMain.handle('stories:getPRByUrl',
        handle((url: string) => storiesService.getPRByUrl(url))
    );

    ipcMain.handle('stories:linkPR',
        handle((issueKey: string, prNumber: number) => storiesService.linkPR(issueKey, prNumber))
    );

    ipcMain.handle('stories:unlinkPR',
        handle((issueKey: string, prNumber: number) => storiesService.unlinkPR(issueKey, prNumber))
    );
}