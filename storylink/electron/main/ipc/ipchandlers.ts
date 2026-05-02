import { ipcMain } from 'electron';

export function registerIpcHandlers() {
    ipcMain.handle('ping', async () => {
        return 'pong'
    });
}