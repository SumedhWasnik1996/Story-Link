// src/store/Workspace.store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Workspace, Issue, JiraProject } from '../types/workspace.types';

// ── In-memory issue cache ─────────────────────────────────────────────────────
// Keyed by workspace id. Resets on app restart (intentional — never show
// stale issues from a previous session).

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type CacheEntry = { issues: Issue[]; fetchedAt: number };

const issuesCache = new Map<string, CacheEntry>();

function getCached(wsId: string): Issue[] | null {
    const entry = issuesCache.get(wsId);
    if (!entry) return null;
    return Date.now() - entry.fetchedAt < CACHE_TTL_MS ? entry.issues : null;
}

function setCache(wsId: string, issues: Issue[]) {
    issuesCache.set(wsId, { issues, fetchedAt: Date.now() });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(prefix: string) {
    return `${prefix}_${Date.now()}`;
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

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = 'idle' | 'loading' | 'error';

type WorkspaceStore = {
    // Persisted
    workspaces: Workspace[];
    activeWorkspaceId: string | null;

    // In-memory
    issues: Issue[];
    issuesStatus: Status;
    issuesError: string | null;

    // Used only during Add Workspace wizard
    availableProjects: JiraProject[];
    projectsStatus: Status;
    projectsError: string | null;

    // ── Computed ──
    activeWorkspace: () => Workspace | null;

    // ── Actions ──
    setActiveWorkspace: (workspaceId: string) => void;
    loadIssues: (opts?: { forceRefresh?: boolean }) => Promise<void>;
    invalidateCache: (workspaceId: string) => void;
    invalidateAllCache: () => void;

    // Add Workspace wizard
    connectNewAccount: () => Promise<string | null>;
    fetchProjectsForAccount: (accountId: string) => Promise<JiraProject[]>;
    addWorkspace: (name: string, projectKey: string, projectName: string, accountId: string) => void;

    removeWorkspace: (workspaceId: string) => Promise<void>;
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const useWorkspaceStore = create<WorkspaceStore>()(
    persist(
        (set, get) => ({

            workspaces: [],
            activeWorkspaceId: null,
            issues: [],
            issuesStatus: 'idle',
            issuesError: null,
            availableProjects: [],
            projectsStatus: 'idle',
            projectsError: null,

            // ── Computed ──────────────────────────────────────────────────────
            activeWorkspace: () => {
                const { workspaces, activeWorkspaceId } = get();
                return workspaces.find(w => w.id === activeWorkspaceId) ?? null;
            },

            // ── Switch workspace ──────────────────────────────────────────────
            // Sends the full workspace object to the main process ONCE.
            // All subsequent data calls (getIssues, getProjects) carry zero params.
            setActiveWorkspace: (workspaceId) => {
                const workspace = get().workspaces.find(w => w.id === workspaceId);
                if (!workspace) return;

                // Tell main process which workspace is active.
                // From here, main knows accountId + projectKey for all data calls.
                window.workspace.activate({
                    id: workspace.id,
                    name: workspace.name,
                    accountId: workspace.accountId,
                    projectKey: workspace.projectKey,
                    projectName: workspace.projectName,
                });

                const cached = getCached(workspaceId);

                if (cached) {
                    // Instant — no API call, no loading state
                    set({
                        activeWorkspaceId: workspaceId,
                        issues: cached,
                        issuesStatus: 'idle',
                        issuesError: null,
                    });
                } else {
                    set({
                        activeWorkspaceId: workspaceId,
                        issues: [],
                        issuesStatus: 'loading',
                        issuesError: null,
                    });
                    get().loadIssues();
                }
            },

            // ── Load issues — zero IPC params ─────────────────────────────────
            // Main process resolves accountId + projectKey from active workspace.
            // The store only decides whether to use cache or fetch.
            loadIssues: async ({ forceRefresh = false } = {}) => {
                const workspace = get().activeWorkspace();
                if (!workspace) return;

                if (!forceRefresh) {
                    const cached = getCached(workspace.id);
                    if (cached) {
                        set({ issues: cached, issuesStatus: 'idle', issuesError: null });
                        return;
                    }
                }

                set({ issuesStatus: 'loading', issuesError: null });

                // Zero params — main already knows the account and project
                const result = await window.jira.getIssues();

                if (!result.success || !result.issues) {
                    set({
                        issuesStatus: 'error',
                        issuesError: result.error ?? 'Failed to load issues',
                    });
                    return;
                }

                const issues = mapIssues(result.issues);
                setCache(workspace.id, issues);
                set({ issues, issuesStatus: 'idle' });
            },

            // ── Cache control ─────────────────────────────────────────────────
            invalidateCache: (workspaceId) => {
                issuesCache.delete(workspaceId);
            },

            invalidateAllCache: () => {
                issuesCache.clear();
            },

            // ── Add Workspace: Step 1 — OAuth ─────────────────────────────────
            // Generates a unique accountId, opens browser OAuth.
            // accountId is only needed here (setting up a new account).
            connectNewAccount: async () => {
                const accountId = uid('jira_account');
                const result = await window.jira.connect(accountId);

                if (!result.success) {
                    throw new Error(result.error ?? 'Jira connection failed');
                }

                return accountId;
            },

            // ── Add Workspace: Step 2 — fetch projects for NEW account ─────────
            // Uses jira:getProjectsForAccount (not jira:getProjects) because
            // no workspace is active yet during the wizard.
            fetchProjectsForAccount: async (accountId) => {
                set({ projectsStatus: 'loading', projectsError: null, availableProjects: [] });

                const result = await window.jira.getProjectsForAccount(accountId);

                if (!result.success || !result.projects) {
                    set({
                        projectsStatus: 'error',
                        projectsError: result.error ?? 'Failed to load projects',
                    });
                    return [];
                }

                const projects: JiraProject[] = result.projects.map((p: any) => ({
                    id: p.id,
                    key: p.key,
                    name: p.name,
                }));

                set({ availableProjects: projects, projectsStatus: 'idle' });
                return projects;
            },

            // ── Add Workspace: Step 3 — save ──────────────────────────────────
            addWorkspace: (name, projectKey, projectName, accountId) => {
                const newWorkspace: Workspace = {
                    id: uid('ws'),
                    name,
                    accountId,
                    projectKey,
                    projectName,
                    createdAt: Date.now(),
                };

                set(state => ({ workspaces: [...state.workspaces, newWorkspace] }));

                // Auto-activate if it's the first workspace
                if (!get().activeWorkspaceId) {
                    get().setActiveWorkspace(newWorkspace.id);
                }
            },

            // ── Remove workspace ──────────────────────────────────────────────
            removeWorkspace: async (workspaceId) => {
                const { workspaces, activeWorkspaceId } = get();
                const workspace = workspaces.find(w => w.id === workspaceId);
                if (!workspace) return;

                // Only revoke tokens if no other workspace shares this account
                const accountUsedElsewhere = workspaces.some(
                    w => w.id !== workspaceId && w.accountId === workspace.accountId
                );
                if (!accountUsedElsewhere) {
                    await window.jira.disconnect(workspace.accountId);
                }

                issuesCache.delete(workspaceId);

                const remaining = workspaces.filter(w => w.id !== workspaceId);
                const newActiveId = activeWorkspaceId === workspaceId
                    ? (remaining[0]?.id ?? null)
                    : activeWorkspaceId;

                set({ workspaces: remaining, activeWorkspaceId: newActiveId, issues: [] });

                if (newActiveId) {
                    get().setActiveWorkspace(newActiveId);
                } else {
                    window.workspace.deactivate();
                }
            },
        }),

        {
            name: 'storylink-workspaces',
            // Only persist workspace definitions and which is active.
            // Issues always come fresh (or from in-memory cache).
            partialize: (state) => ({
                workspaces: state.workspaces,
                activeWorkspaceId: state.activeWorkspaceId,
            }),
            // After rehydration, re-activate the workspace in the main process
            // and load its issues.
            onRehydrateStorage: () => (state) => {
                if (state?.activeWorkspaceId) {
                    setTimeout(() => state.setActiveWorkspace(state.activeWorkspaceId!), 0);
                }
            },
        }
    )
);