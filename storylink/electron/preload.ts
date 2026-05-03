// electron/preload.ts
import { ipcRenderer, contextBridge } from 'electron';

contextBridge.exposeInMainWorld('ipcRenderer', {
    on(...args: Parameters<typeof ipcRenderer.on>) {
        const [channel, listener] = args;
        return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args));
    },
    off(...args: Parameters<typeof ipcRenderer.off>) {
        const [channel, ...omit] = args;
        return ipcRenderer.off(channel, ...omit);
    },
    send(...args: Parameters<typeof ipcRenderer.send>) {
        const [channel, ...omit] = args;
        return ipcRenderer.send(channel, ...omit);
    },
    invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
        const [channel, ...omit] = args;
        return ipcRenderer.invoke(channel, ...omit);
    },
});

// ── Workspace API ─────────────────────────────────────────────────────────────
// Activate sends the full workspace object once.
// All subsequent data calls are zero-param.
contextBridge.exposeInMainWorld('workspace', {
    activate: (ws: any) => ipcRenderer.invoke('workspace:activate', ws),
    deactivate: () => ipcRenderer.invoke('workspace:deactivate'),
});

// ── Jira API ──────────────────────────────────────────────────────────────────
// Data calls (getIssues, getProjects) have no params — main resolves from active workspace.
// Account management calls (connect, disconnect, etc.) still carry an accountId
// because they deal with accounts that may not be active yet.
contextBridge.exposeInMainWorld('jira', {
    // Zero-param data calls
    getIssues: () => ipcRenderer.invoke('jira:getIssues'),
    getProjects: () => ipcRenderer.invoke('jira:getProjects'),

    // Add Workspace wizard — explicit accountId needed (no workspace active yet)
    connect: (accountId: string) => ipcRenderer.invoke('jira:connect', accountId),
    getProjectsForAccount: (accountId: string) => ipcRenderer.invoke('jira:getProjectsForAccount', accountId),

    // Account management
    isConnected: (accountId: string) => ipcRenderer.invoke('jira:isConnected', accountId),
    disconnect: (accountId: string) => ipcRenderer.invoke('jira:disconnect', accountId),
    listAccounts: () => ipcRenderer.invoke('jira:listAccounts'),
});