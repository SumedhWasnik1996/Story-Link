// electron/main/services/workspace.service.ts
import { workspaceStore } from '../store/workspace.store';
import { deleteTokens } from '../auth/jira.auth';
import type { WorkspaceView, ActiveWorkspaceView } from '@shared/types/workspace.types';

export const workspaceService = {

    /** Returns all workspaces as safe views (no accountId). */
    list(): WorkspaceView[] {
        const store = workspaceStore.getAll();
        return store.workspaces.map(w => ({
            id: w.id,
            name: w.name,
            projectKey: w.projectKey,
            projectName: w.projectName,
            isActive: w.id === store.activeWorkspaceId,
        }));
    },

    /** Returns the active workspace as a safe view, or null. */
    getActive(): ActiveWorkspaceView {
        const ws = workspaceStore.getActive();
        if (!ws) return null;
        return {
            id: ws.id,
            name: ws.name,
            projectKey: ws.projectKey,
            projectName: ws.projectName,
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

        // Only delete the token if no other workspace shares the same account
        const usedElsewhere = store.workspaces.some(
            w => w.id !== id && w.accountId === ws.accountId
        );
        if (!usedElsewhere) {
            await deleteTokens(ws.accountId);
        }

        workspaceStore.remove(id);
        return { success: true };
    },

    create(data: {
        name: string;
        projectKey: string;
        projectName: string;
        accountId: string;        // supplied by ipcHandlers from jiraOnboardingService
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