// src/store/Workspace.store.ts
// ─────────────────────────────────────────────────────────────────────────────
// UI cache — a read-only mirror of Electron's workspace state.
// All mutations go through window.workspace.* IPC calls.
// No accountId ever lives here.
// ─────────────────────────────────────────────────────────────────────────────
import { create } from 'zustand';
import type { Issue, WorkspaceView } from '@shared/types/workspace.types';

export type { WorkspaceView };

// ── Issue cache ───────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = { issues: Issue[]; fetchedAt: number };
const issuesCache = new Map<string, CacheEntry>();

function getCached(wsId: string): Issue[] | null {
    const entry = issuesCache.get(wsId);
    if (!entry) return null;
    return Date.now() - entry.fetchedAt < CACHE_TTL_MS ? entry.issues : null;
}

function mapIssues(raw: any[]): Issue[] {
    return raw.map(i => ({
        id: i.id,
        key: i.key,
        summary: i.fields?.summary ?? '(no summary)',
        status: i.fields?.status?.name ?? 'Unknown',
        priority: i.fields?.priority?.name ?? 'Unknown',
        type: i.fields?.issuetype?.name ?? 'Unknown',
    }));
}

// ── Store shape ───────────────────────────────────────────────────────────────

type Status = 'idle' | 'loading' | 'error';

type WorkspaceStore = {
    // Workspace list + active workspace (both sourced from Electron)
    workspaces: WorkspaceView[];
    activeWorkspace: WorkspaceView | null;   // use .id where you need the id
    workspacesStatus: Status;

    // Issues for the currently active workspace
    issues: Issue[];
    issuesStatus: Status;
    issuesError: string | null;

    // Actions
    loadWorkspaces: () => Promise<void>;
    setActive: (workspaceId: string) => Promise<void>;
    removeWorkspace: (workspaceId: string) => Promise<void>;
    loadIssues: (opts?: { forceRefresh?: boolean }) => Promise<void>;
    invalidateCache: (workspaceId: string) => void;
};

// ── Store implementation ──────────────────────────────────────────────────────

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({

    workspaces: [],
    activeWorkspace: null,
    workspacesStatus: 'idle',
    issues: [],
    issuesStatus: 'idle',
    issuesError: null,

    // ── Load workspace list from Electron ────────────────────────────────────
    loadWorkspaces: async () => {
        set({ workspacesStatus: 'loading' });

        const result = await window.workspace.list();
        const list = result.data ?? [];
        const active = list.find(w => w.isActive) ?? null;

        set({ workspaces: list, activeWorkspace: active, workspacesStatus: 'idle' });

        if (active) get().loadIssues();
    },

    // ── Switch active workspace ───────────────────────────────────────────────
    setActive: async (workspaceId) => {
        await window.workspace.setActive(workspaceId);

        const result = await window.workspace.list();
        const list = result.data ?? [];
        const active = list.find(w => w.isActive) ?? null;
        const cached = active ? getCached(active.id) : null;

        set({
            workspaces: list,
            activeWorkspace: active,
            issues: cached ?? [],
            issuesStatus: cached ? 'idle' : 'loading',
            issuesError: null,
        });

        if (!cached) get().loadIssues();
    },

    // ── Remove workspace ──────────────────────────────────────────────────────
    removeWorkspace: async (workspaceId) => {
        issuesCache.delete(workspaceId);
        await window.workspace.remove(workspaceId);
        await get().loadWorkspaces();   // Electron picks new active workspace
    },

    // ── Load issues for the active workspace ─────────────────────────────────
    loadIssues: async ({ forceRefresh = false } = {}) => {
        const active = get().activeWorkspace;
        if (!active) return;

        if (!forceRefresh) {
            const cached = getCached(active.id);
            if (cached) {
                set({ issues: cached, issuesStatus: 'idle' });
                return;
            }
        }

        set({ issuesStatus: 'loading', issuesError: null });

        const result = await window.jira.getIssues();

        if (!result.success || !result.data) {
            set({
                issuesStatus: 'error',
                issuesError: result.error ?? 'Failed to load issues',
            });
            return;
        }

        const issues = mapIssues(result.data);
        issuesCache.set(active.id, { issues, fetchedAt: Date.now() });
        set({ issues, issuesStatus: 'idle' });
    },

    invalidateCache: (workspaceId) => {
        issuesCache.delete(workspaceId);
    },
}));