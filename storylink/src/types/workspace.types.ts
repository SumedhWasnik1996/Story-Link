// src/types/workspace.types.ts

export type Workspace = {
    id: string;   // local uid e.g.  "ws_1720000000000"
    name: string;   // user label e.g. "Work — Mobile App"
    accountId: string;   // keychain key    "jira_account_1720000000000"
    projectKey: string;   // Jira key        "MOB"
    projectName: string;   // Jira name       "Mobile App"
    createdAt: number;
};

export type Issue = {
    id: string;
    key: string;
    summary: string;
    status: string;
    priority: string;
    type: string;
};

export type JiraProject = {
    id: string;
    key: string;
    name: string;
};