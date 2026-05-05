// electron/main/services/workspace.service.ts
import { workspaceStore } from '../store/workspace.store';
import { deleteTokens } from '../auth/jira.auth';
import { deleteGitHubTokens } from '../auth/github.auth';
import type { WorkspaceView, ActiveWorkspaceView } from '@shared/types/workspace.types';

export const workspaceService = {

    list(): WorkspaceView[] {
        const store = workspaceStore.getAll();
        return store.workspaces.map(w => ({
            id: w.id,
            name: w.name,
            projectKey: w.projectKey,
            projectName: w.projectName,
            gitRepoFullName: w.gitRepoFullName,
            isActive: w.id === store.activeWorkspaceId,
        }));
    },

    getActive(): ActiveWorkspaceView {
        const ws = workspaceStore.getActive();
        if (!ws) return null;
        return {
            id: ws.id,
            name: ws.name,
            projectKey: ws.projectKey,
            projectName: ws.projectName,
            gitRepoFullName: ws.gitRepoFullName,
        };
    },

    setActive(id: string): void {
        const ws = workspaceStore.find(id);
        if (!ws) throw new Error(`Workspace not found: ${id}`);
        workspaceStore.setActive(id);
    },

    async remove(id: string): Promise<{ success: boolean }> {
        const store = workspaceStore.getAll();
        const ws = workspaceStore.find(id);
        if (!ws) return { success: true };

        // Only delete Jira token if no other workspace shares this Jira account
        const jiraUsedElsewhere = store.workspaces.some(
            w => w.id !== id && w.accountId === ws.accountId
        );
        if (!jiraUsedElsewhere) await deleteTokens(ws.accountId);

        // Only delete GitHub token if no other workspace shares this GitHub account
        const gitUsedElsewhere = store.workspaces.some(
            w => w.id !== id && w.gitAccountId === ws.gitAccountId
        );
        if (!gitUsedElsewhere) await deleteGitHubTokens(ws.gitAccountId);

        workspaceStore.remove(id);
        return { success: true };
    },

    create(data: {
        name: string;
        projectKey: string;
        projectName: string;
        accountId: string;       // Jira — from jiraOnboardingService.consumeAccountId()
        gitAccountId: string;    // GitHub — from githubOnboardingService.consumeAccountId()
        gitRepoFullName: string; // "owner/repo"
        gitRepoId: number;
    }): { workspaceId: string } {
        const ws = {
            id: `ws_${Date.now()}`,
            ...data,
            createdAt: Date.now(),
        };
        workspaceStore.add(ws);
        return { workspaceId: ws.id };
    },
};