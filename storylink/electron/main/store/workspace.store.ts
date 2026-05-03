// electron/main/store/workspace.store.ts
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import type { Workspace, WorkspaceStoreShape } from '@shared/types/workspace.types';

// Re-export Workspace so other electron-side files can import from here
// instead of reaching into shared directly (optional convenience).
export type { Workspace };

function getPath(): string {
    return path.join(app.getPath('userData'), 'workspaces.json');
}

function load(): WorkspaceStoreShape {
    const file = getPath();
    if (!fs.existsSync(file)) return { workspaces: [], activeWorkspaceId: null };
    try {
        return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
        return { workspaces: [], activeWorkspaceId: null };
    }
}

function persist(store: WorkspaceStoreShape): void {
    fs.writeFileSync(getPath(), JSON.stringify(store, null, 2));
}

class WorkspaceStoreManager {
    private store: WorkspaceStoreShape = load();

    getAll(): WorkspaceStoreShape {
        return this.store;
    }

    save(): void {
        persist(this.store);
    }

    setActive(id: string): void {
        this.store.activeWorkspaceId = id;
        this.save();
    }

    add(workspace: Workspace): void {
        this.store.workspaces.push(workspace);
        // Auto-activate the first workspace added
        if (!this.store.activeWorkspaceId) {
            this.store.activeWorkspaceId = workspace.id;
        }
        this.save();
    }

    remove(id: string): void {
        this.store.workspaces = this.store.workspaces.filter(w => w.id !== id);
        if (this.store.activeWorkspaceId === id) {
            this.store.activeWorkspaceId = this.store.workspaces[0]?.id ?? null;
        }
        this.save();
    }

    getActive(): Workspace | null {
        return (
            this.store.workspaces.find(w => w.id === this.store.activeWorkspaceId) ?? null
        );
    }

    find(id: string): Workspace | undefined {
        return this.store.workspaces.find(w => w.id === id);
    }
}

export const workspaceStore = new WorkspaceStoreManager();