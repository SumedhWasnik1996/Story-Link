// shared/types/workspace.types.ts
export type Workspace = {
    id: string;
    name: string;
    accountId: string;
    projectKey: string;
    projectName: string;
    gitAccountId: string;
    gitRepoFullName: string;
    gitRepoId: number;
    isActive: boolean;
    createdAt: number;
};

export type WorkspaceStoreShape = {
    workspaces: Workspace[];
    activeWorkspaceId: string | null;
};

export type WorkspaceView = {
    id: string;
    name: string;
    projectKey: string;
    projectName: string;
    gitRepoFullName: string;
    isActive: boolean;
};

export type ActiveWorkspaceView = Omit<WorkspaceView, 'isActive'> | null;

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
    parentKey?: string;
    epicLabel?: string;
    subtaskKeys: string[];
    jiraUrl: string;
};

export type GitRepo = {
    id: number;
    fullName: string;
    name: string;
    private: boolean;
    url: string;
};

export type GitHubPR = {
    number: number;
    title: string;
    state: 'open' | 'closed';
    merged: boolean;
    draft: boolean;
    branch: string;
    url: string;
};

export type PRSource = 'auto' | 'manual';
export type PRState = 'open' | 'merged' | 'closed';

export type LinkedPR = {
    prNumber: number;
    prTitle: string;
    state: PRState;
    draft: boolean;
    url: string;
    source: PRSource;
};

export type LinkedIssue = Issue & {
    linkedPRs: LinkedPR[];
    children: LinkedIssue[];
};

export type LinkedStoryGroup = {
    status: string;
    stories: LinkedIssue[];
};