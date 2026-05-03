// shared/types/workspace.types.ts
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for all workspace-related types.
// No Electron imports. No React imports. Pure TypeScript only.
// Imported by both the Electron main process and the renderer.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full workspace record.
 * Only ever lives inside the Electron main process.
 * Never sent to the renderer — accountId must stay secret.
 */
export type Workspace = {
    id: string;
    name: string;
    accountId: string;       // keychain key — never exposed to renderer
    projectKey: string;      // Jira project key e.g. "MOB"
    projectName: string;     // Jira project name e.g. "Mobile App"
    createdAt: number;
};

/**
 * Shape of the persisted JSON file on disk.
 * Used internally by WorkspaceStoreManager.
 */
export type WorkspaceStoreShape = {
    workspaces: Workspace[];
    activeWorkspaceId: string | null;
};

/**
 * Safe read-only view sent over IPC to the renderer.
 * accountId is deliberately omitted.
 */
export type WorkspaceView = {
    id: string;
    name: string;
    projectKey: string;
    projectName: string;
    isActive: boolean;
};

/**
 * The single active workspace sent to the renderer.
 * Omits isActive (redundant when it is the active one).
 */
export type ActiveWorkspaceView = Omit<WorkspaceView, 'isActive'> | null;

/**
 * Jira project returned during onboarding.
 */
export type JiraProject = {
    id: string;
    key: string;
    name: string;
};

/**
 * Normalised Jira issue used throughout the UI.
 */
export type Issue = {
    id: string;
    key: string;
    summary: string;
    status: string;
    priority: string;
    type: string;
};