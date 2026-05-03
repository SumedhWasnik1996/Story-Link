// src/types/workspace.types.ts
// ─────────────────────────────────────────────────────────────────────────────
// Re-exports from shared so all existing renderer imports continue to work
// without changes. The real definitions live in shared/types/workspace.types.ts.
// ─────────────────────────────────────────────────────────────────────────────
export type {
    Workspace,
    WorkspaceView,
    ActiveWorkspaceView,
    JiraProject,
    Issue,
} from '@shared/types/workspace.types';