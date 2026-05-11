// electron/preload.ts
import { ipcRenderer, contextBridge } from 'electron';

contextBridge.exposeInMainWorld('ipcRenderer', {
    on(...args: Parameters<typeof ipcRenderer.on>) {
        const [c, l] = args;
        return ipcRenderer.on(c, (e, ...a) => l(e, ...a));
    },
    off(...args: Parameters<typeof ipcRenderer.off>) {
        const [c, ...o] = args;
        return ipcRenderer.off(c, ...o);
    },
    send(...args: Parameters<typeof ipcRenderer.send>) {
        const [c, ...o] = args;
        return ipcRenderer.send(c, ...o);
    },
    invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
        const [c, ...o] = args;
        return ipcRenderer.invoke(c, ...o);
    },
});

// ── Workspace ─────────────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('workspace', {
    list     : ()           => ipcRenderer.invoke('workspace:list'),
    getActive: ()           => ipcRenderer.invoke('workspace:getActive'),
    setActive: (id: string) => ipcRenderer.invoke('workspace:setActive', id),
    remove   : (id: string) => ipcRenderer.invoke('workspace:remove', id),
    create   : (payload: {
        name: string;
        projectKey: string;
        projectName: string;
        gitRepoFullName: string;
        gitRepoId: number;
    })                      => ipcRenderer.invoke('workspace:create', payload),
});

// ── Jira ──────────────────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('jira', {
    getIssues:                () => ipcRenderer.invoke('jira:getIssues'),
    connect:                  () => ipcRenderer.invoke('jira:connect'),
    getProjectsForNewAccount: () => ipcRenderer.invoke('jira:getProjectsForNewAccount'),
    listAccounts:             () => ipcRenderer.invoke('jira:listAccounts'),
    isConnected:              () => ipcRenderer.invoke('jira:isConnected'),
});

// ── GitHub ────────────────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('github', {
    connect:               (hostname?: string) => ipcRenderer.invoke('github:connect', hostname),
    getReposForNewAccount: ()                  => ipcRenderer.invoke('github:getReposForNewAccount'),
    getRepoByUrl:          (url: string)       => ipcRenderer.invoke('github:getRepoByUrl', url),
});

// ── Stories ───────────────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('stories', {
    sync:       ()                                   => ipcRenderer.invoke('stories:sync'),
    searchPRs:  (query: string)                      => ipcRenderer.invoke('stories:searchPRs', query),
    getPRByUrl: (url: string)                        => ipcRenderer.invoke('stories:getPRByUrl', url),
    linkPR:     (issueKey: string, prNumber: number) => ipcRenderer.invoke('stories:linkPR', issueKey, prNumber),
    unlinkPR:   (issueKey: string, prNumber: number) => ipcRenderer.invoke('stories:unlinkPR', issueKey, prNumber),
});