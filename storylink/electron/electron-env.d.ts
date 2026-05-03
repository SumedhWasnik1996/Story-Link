/// <reference types="vite-plugin-electron/electron-env" />

// shared types are pure TS — safe to import in .d.ts files
import type { WorkspaceView, ActiveWorkspaceView } from '@shared/types/workspace.types';

declare namespace NodeJS {
    interface ProcessEnv {
        APP_ROOT: string;
        VITE_PUBLIC: string;
    }
}

interface Window {
    ipcRenderer: import('electron').IpcRenderer;

    workspace: {
        /** Returns all workspaces as safe views (no accountId). */
        list(): Promise<WorkspaceView[]>;

        /** Returns the active workspace without isActive flag, or null. */
        getActive(): Promise<ActiveWorkspaceView>;

        setActive(workspaceId: string): Promise<{ success: boolean; error?: string }>;

        remove(workspaceId: string): Promise<{ success: boolean; error?: string }>;

        /** Renderer only sends display data — accountId is handled by Electron internally. */
        create(p: {
            name: string;
            projectKey: string;
            projectName: string;
        }): Promise<{ success: boolean; workspaceId?: string; error?: string }>;
    };

    jira: {
        getIssues(): Promise<{ success: boolean; issues?: any[]; error?: string }>;
        connect(): Promise<{ success: boolean; error?: string }>;
        getProjectsForNewAccount(): Promise<{ success: boolean; projects?: any[]; error?: string }>;
        listAccounts(): Promise<{ success: boolean; accounts: string[] }>;
        isConnected(): Promise<{ success: boolean; connected: boolean }>;
    };
}