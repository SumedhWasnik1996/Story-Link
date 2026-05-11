/// <reference types="vite-plugin-electron/electron-env" />

import type {
    WorkspaceView,
    ActiveWorkspaceView,
    LinkedStoryGroup,
    LinkedIssue,
    GitHubPR,
    GitRepo,
} from '@shared/types/workspace.types';

declare namespace NodeJS {
    interface ProcessEnv {
        APP_ROOT: string;
        VITE_PUBLIC: string;
    }
}

// Consistent IPC envelope — every call returns one of these two shapes.
type IpcResult<T> =
    | { success: true; data: T; error: null }
    | { success: false; data: null; error: string };

// Shape returned by githubOnboardingService.connect()
type GitHubConnectData = { login: string; host: string };

// Shape returned by githubOnboardingService.getRepos()
type GitHubReposData = {
    repos: GitRepo[];
    mine: GitRepo[];
    orgs: GitRepo[];
    login: string;
    host: string;
};

// Shape returned by workspaceService.create()
type CreateWorkspaceData = { workspaceId: string };

// Shape returned by jiraOnboardingService.getProjects()
type JiraProjectsData = { projects: JiraProject[] };

interface Window {
    ipcRenderer: import('electron').IpcRenderer;

    workspace: {
        list(): Promise<IpcResult<WorkspaceView[]>>;
        getActive(): Promise<IpcResult<ActiveWorkspaceView>>;
        setActive(id: string): Promise<IpcResult<void>>;
        remove(id: string): Promise<IpcResult<{ success: boolean }>>;
        create(p: {
            name: string;
            projectKey: string;
            projectName: string;
            gitRepoFullName: string;
            gitRepoId: number;
        }): Promise<IpcResult<CreateWorkspaceData>>;
    };

    jira: {
        getIssues(): Promise<IpcResult<any[]>>;
        connect(): Promise<IpcResult<void>>;
        getProjectsForNewAccount(): Promise<IpcResult<JiraProjectsData>>;
        listAccounts(): Promise<IpcResult<string[]>>;
        isConnected(): Promise<IpcResult<boolean>>;
    };

    github: {
        connect(hostname?: string): Promise<IpcResult<GitHubConnectData>>;
        getReposForNewAccount(): Promise<IpcResult<GitHubReposData>>;
        getRepoByUrl(url: string): Promise<IpcResult<GitRepo & { host: string }>>;
    };

    stories: {
        sync(): Promise<IpcResult<LinkedStoryGroup[]>>;
        searchPRs(query: string): Promise<IpcResult<GitHubPR[]>>;
        getPRByUrl(url: string): Promise<IpcResult<GitHubPR>>;
        linkPR(issueKey: string, prNumber: number): Promise<IpcResult<LinkedIssue>>;
        unlinkPR(issueKey: string, prNumber: number): Promise<IpcResult<LinkedIssue>>;
    };
}