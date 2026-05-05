// shared/types/workspace.types.ts
// Single source of truth — imported by both Electron main and renderer.
// No Electron imports. No React imports. Pure TypeScript only.

// ── Workspace ─────────────────────────────────────────────────────────────────

/**
 * Full workspace record — only ever lives inside the Electron main process.
 * accountId and gitAccountId are secret token-store keys; never sent to renderer.
 */
export type Workspace = {
    id: string;
    name: string;
    // Jira
    accountId: string;        // Jira OAuth token key — never exposed to renderer
    projectKey: string;       // e.g. "MOB"
    projectName: string;      // e.g. "Mobile App"
    // GitHub
    gitAccountId: string;     // GitHub OAuth token key — never exposed to renderer
    gitRepoFullName: string;  // e.g. "acme/mobile-app"  (owner/repo)
    gitRepoId: number;        // GitHub repo numeric id — stable across renames
    createdAt: number;
};

/** Shape of workspaces.json on disk */
export type WorkspaceStoreShape = {
    workspaces: Workspace[];
    activeWorkspaceId: string | null;
};

/**
 * Safe view sent over IPC to the renderer.
 * Both accountId and gitAccountId are deliberately omitted.
 */
export type WorkspaceView = {
    id: string;
    name: string;
    // Jira
    projectKey: string;
    projectName: string;
    // GitHub
    gitRepoFullName: string;
    isActive: boolean;
};

/** Active workspace view — omits isActive (redundant) */
export type ActiveWorkspaceView = Omit<WorkspaceView, 'isActive'> | null;

// ── Jira ──────────────────────────────────────────────────────────────────────

export type JiraProject = {
    id: string;
    key: string;
    name: string;
};

export type Issue = {
    id: string;
    key: string;
    summary: string;
    status: string;
    priority: string;
    type: string;
};

// ── GitHub ────────────────────────────────────────────────────────────────────

export type GitRepo = {
    id: number;
    fullName: string;   // "owner/repo"
    name: string;       // short repo name
    private: boolean;
    url: string;        // html_url
};