"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [c, l] = args;
    return electron.ipcRenderer.on(c, (e, ...a) => l(e, ...a));
  },
  off(...args) {
    const [c, ...o] = args;
    return electron.ipcRenderer.off(c, ...o);
  },
  send(...args) {
    const [c, ...o] = args;
    return electron.ipcRenderer.send(c, ...o);
  },
  invoke(...args) {
    const [c, ...o] = args;
    return electron.ipcRenderer.invoke(c, ...o);
  }
});
electron.contextBridge.exposeInMainWorld("workspace", {
  list: () => electron.ipcRenderer.invoke("workspace:list"),
  getActive: () => electron.ipcRenderer.invoke("workspace:getActive"),
  setActive: (id) => electron.ipcRenderer.invoke("workspace:setActive", id),
  remove: (id) => electron.ipcRenderer.invoke("workspace:remove", id),
  create: (payload) => electron.ipcRenderer.invoke("workspace:create", payload)
});
electron.contextBridge.exposeInMainWorld("jira", {
  getIssues: () => electron.ipcRenderer.invoke("jira:getIssues"),
  connect: () => electron.ipcRenderer.invoke("jira:connect"),
  getProjectsForNewAccount: () => electron.ipcRenderer.invoke("jira:getProjectsForNewAccount"),
  listAccounts: () => electron.ipcRenderer.invoke("jira:listAccounts"),
  isConnected: () => electron.ipcRenderer.invoke("jira:isConnected")
});
electron.contextBridge.exposeInMainWorld("github", {
  connect: (hostname) => electron.ipcRenderer.invoke("github:connect", hostname),
  getReposForNewAccount: () => electron.ipcRenderer.invoke("github:getReposForNewAccount"),
  getRepoByUrl: (url) => electron.ipcRenderer.invoke("github:getRepoByUrl", url)
});
electron.contextBridge.exposeInMainWorld("stories", {
  sync: () => electron.ipcRenderer.invoke("stories:sync"),
  searchPRs: (query) => electron.ipcRenderer.invoke("stories:searchPRs", query),
  getPRByUrl: (url) => electron.ipcRenderer.invoke("stories:getPRByUrl", url),
  linkPR: (issueKey, prNumber) => electron.ipcRenderer.invoke("stories:linkPR", issueKey, prNumber),
  unlinkPR: (issueKey, prNumber) => electron.ipcRenderer.invoke("stories:unlinkPR", issueKey, prNumber)
});
