// electron/electron-env.d.ts
/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
    interface ProcessEnv {
        APP_ROOT: string;
        VITE_PUBLIC: string;
    }
}

interface Window {
    ipcRenderer: import('electron').IpcRenderer;

    // Workspace activation — send the full object once when switching.
    // After this, all data calls are zero-param.
    workspace: {
        activate(ws: {
            id: string;
            name: string;
            accountId: string;
            projectKey: string;
            projectName: string;
        }): Promise<void>;
        deactivate(): Promise<void>;
    };

    jira: {
        // ── Zero-param data calls ──────────────────────────────────────────
        // Main process resolves accountId + projectKey from active workspace.
        getIssues(): Promise<{ success: boolean; issues?: any[]; error?: string }>;
        getProjects(): Promise<{ success: boolean; projects?: any[]; error?: string }>;

        // ── Add Workspace wizard ───────────────────────────────────────────
        // Explicit accountId because no workspace is active yet.
        connect(accountId: string): Promise<{ success: boolean; error?: string }>;
        getProjectsForAccount(accountId: string): Promise<{ success: boolean; projects?: any[]; error?: string }>;

        // ── Account management ─────────────────────────────────────────────
        isConnected(accountId: string): Promise<boolean>;
        disconnect(accountId: string): Promise<{ success: boolean; error?: string }>;
        listAccounts(): Promise<{ success: boolean; accounts: string[]; error?: string }>;
    };
}