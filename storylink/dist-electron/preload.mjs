"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(channel, (event, ...a) => listener(event, ...a));
  },
  off(...args) {
    const [channel, ...rest] = args;
    return electron.ipcRenderer.off(channel, ...rest);
  },
  send(...args) {
    const [channel, ...rest] = args;
    return electron.ipcRenderer.send(channel, ...rest);
  },
  invoke(...args) {
    const [channel, ...rest] = args;
    return electron.ipcRenderer.invoke(channel, ...rest);
  }
});
electron.contextBridge.exposeInMainWorld("workspace", {
  list: () => electron.ipcRenderer.invoke("workspace:list"),
  getActive: () => electron.ipcRenderer.invoke("workspace:getActive"),
  setActive: (workspaceId) => electron.ipcRenderer.invoke("workspace:setActive", workspaceId),
  remove: (workspaceId) => electron.ipcRenderer.invoke("workspace:remove", workspaceId),
  create: (payload) => electron.ipcRenderer.invoke("workspace:create", payload)
});
electron.contextBridge.exposeInMainWorld("jira", {
  getIssues: () => electron.ipcRenderer.invoke("jira:getIssues"),
  connect: () => electron.ipcRenderer.invoke("jira:connect"),
  getProjectsForNewAccount: () => electron.ipcRenderer.invoke("jira:getProjectsForNewAccount"),
  listAccounts: () => electron.ipcRenderer.invoke("jira:listAccounts"),
  isConnected: () => electron.ipcRenderer.invoke("jira:isConnected")
});
