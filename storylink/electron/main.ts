// electron/main.ts
import { app, BrowserWindow } from 'electron';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { open as openDb, close as closeDb } from './main/db/db';
import { registerIpcHandlers } from './main/ipc/ipchandlers';
import { handleCallback as handleJiraCallback } from './main/auth/jira.auth';
import { handleGitHubCallback } from './main/auth/github.auth';
import dotenv from 'dotenv';

dotenv.config();

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, '..');

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
    ? path.join(process.env.APP_ROOT, 'public')
    : RENDERER_DIST;

if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('storylink', process.execPath, [path.resolve(process.argv[1])]);
    }
} else {
    app.setAsDefaultProtocolClient('storylink');
}

let win: BrowserWindow | null;

function createWindow() {
    win = new BrowserWindow({
        icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
        webPreferences: { preload: path.join(__dirname, 'preload.mjs') },
    });
    win.webContents.openDevTools();
    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', new Date().toLocaleString());
    });
    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL);
    } else {
        win.loadFile(path.join(RENDERER_DIST, 'index.html'));
    }
}

// Route storylink:// callbacks — GitHub checks first, falls through to Jira
function routeCallback(url: string) {
    if (!handleGitHubCallback(url)) handleJiraCallback(url);
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') { closeDb(); app.quit(); win = null; }
});
app.on('before-quit', () => closeDb());
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('open-url', (event, url) => { event.preventDefault(); routeCallback(url); });

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (_event, commandLine) => {
        const url = commandLine.find(arg => arg.startsWith('storylink://'));
        if (url) routeCallback(url);
        if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
    });
}

app.whenReady().then(() => {
    openDb();               // 1. Open SQLite DB and run migrations
    registerIpcHandlers();  // 2. Register all IPC handlers
    createWindow();         // 3. Show the window
});