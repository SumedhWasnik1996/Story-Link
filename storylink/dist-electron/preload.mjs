"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(channel, (event, ...args2) => listener(event, ...args2));
  },
  off(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.off(channel, ...omit);
  },
  send(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.invoke(channel, ...omit);
  }
});
electron.contextBridge.exposeInMainWorld("workspace", {
  activate: (ws) => electron.ipcRenderer.invoke("workspace:activate", ws),
  deactivate: () => electron.ipcRenderer.invoke("workspace:deactivate")
});
electron.contextBridge.exposeInMainWorld("jira", {
  // Zero-param data calls
  getIssues: () => electron.ipcRenderer.invoke("jira:getIssues"),
  getProjects: () => electron.ipcRenderer.invoke("jira:getProjects"),
  // Add Workspace wizard — explicit accountId needed (no workspace active yet)
  connect: (accountId) => electron.ipcRenderer.invoke("jira:connect", accountId),
  getProjectsForAccount: (accountId) => electron.ipcRenderer.invoke("jira:getProjectsForAccount", accountId),
  // Account management
  isConnected: (accountId) => electron.ipcRenderer.invoke("jira:isConnected", accountId),
  disconnect: (accountId) => electron.ipcRenderer.invoke("jira:disconnect", accountId),
  listAccounts: () => electron.ipcRenderer.invoke("jira:listAccounts")
});
