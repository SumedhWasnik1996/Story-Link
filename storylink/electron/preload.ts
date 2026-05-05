// electron/preload.ts
import { ipcRenderer, contextBridge } from 'electron';

contextBridge.exposeInMainWorld('ipcRenderer', {
    on(...args: Parameters<typeof ipcRenderer.on>) {
        const [channel, listener] = args;
        return ipcRenderer.on(channel, (event, ...a) => listener(event, ...a));
    },
    off(...args: Parameters<typeof ipcRenderer.off>) {
        const [channel, ...rest] = args;
        return ipcRenderer.off(channel, ...rest);
    },
    send(...args: Parameters<typeof ipcRenderer.send>) {
        const [channel, ...rest] = args;
        return ipcRenderer.send(channel, ...rest);
    },
    invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
        const [channel, ...rest] = args;
        return ipcRenderer.invoke(channel, ...rest);
    },
});

// ── Workspace ─────────────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('workspace', {
    list: () => ipcRenderer.invoke('workspace:list'),
    getActive: () => ipcRenderer.invoke('workspace:getActive'),
    setActive: (workspaceId: string) =>
        ipcRenderer.invoke('workspace:setActive', workspaceId),
    remove: (workspaceId: string) =>
        ipcRenderer.invoke('workspace:remove', workspaceId),
    create: (payload: {
        name: string;
        projectKey: string;
        projectName: string;
        gitRepoFullName: string;
        gitRepoId: number;
    }) => ipcRenderer.invoke('workspace:create', payload),
});

// ── Jira ──────────────────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('jira', {
    getIssues: () => ipcRenderer.invoke('jira:getIssues'),
    connect: () => ipcRenderer.invoke('jira:connect'),
    getProjectsForNewAccount: () => ipcRenderer.invoke('jira:getProjectsForNewAccount'),
    listAccounts: () => ipcRenderer.invoke('jira:listAccounts'),
    isConnected: () => ipcRenderer.invoke('jira:isConnected'),
});

// ── GitHub ────────────────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('github', {
    connect: () => ipcRenderer.invoke('github:connect'),
    getReposForNewAccount: () => ipcRenderer.invoke('github:getReposForNewAccount'),
});