/// <reference types="vite-plugin-electron/electron-env" />

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
        list(): Promise<WorkspaceView[]>;
        getActive(): Promise<ActiveWorkspaceView>;
        setActive(workspaceId: string): Promise<{ success: boolean; error?: string }>;
        remove(workspaceId: string): Promise<{ success: boolean; error?: string }>;
        /** Renderer sends display data only — both accountIds resolved by Electron */
        create(p: {
            name: string;
            projectKey: string;
            projectName: string;
            gitRepoFullName: string;
            gitRepoId: number;
        }): Promise<{ success: boolean; workspaceId?: string; error?: string }>;
    };

    jira: {
        getIssues(): Promise<{ success: boolean; issues?: any[]; error?: string }>;
        connect(): Promise<{ success: boolean; error?: string }>;
        getProjectsForNewAccount(): Promise<{ success: boolean; projects?: any[]; error?: string }>;
        listAccounts(): Promise<{ success: boolean; accounts: string[] }>;
        isConnected(): Promise<{ success: boolean; connected: boolean }>;
    };

    github: {
        connect(): Promise<{ success: boolean; login?: string; error?: string }>;
        getReposForNewAccount(): Promise<{ success: boolean; repos?: any[]; error?: string }>;
    };
}