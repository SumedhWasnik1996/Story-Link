// electron/main/db/db.ts
// ─────────────────────────────────────────────────────────────────────────────
// Single SQLite connection for the entire Electron main process.
// Call open() once in main.ts before registerIpcHandlers().
// All services import { db } and use it directly — synchronous API.
// ─────────────────────────────────────────────────────────────────────────────

import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'node:path';
import { runMigrations } from './migrations';

let _db: Database.Database | null = null;

/**
 * Opens (or creates) the SQLite database, applies pending migrations,
 * and stores the connection as a module-level singleton.
 * Must be called before any service that uses db is imported or invoked.
 */
export function open(): void {
    if (_db) return; // already open

    const dbPath = path.join(app.getPath('userData'), 'storylink.db');

    _db = new Database(dbPath);

    // WAL mode: reads don't block writes, better performance for Electron
    _db.pragma('journal_mode = WAL');

    // Enforce foreign key constraints (OFF by default in SQLite)
    _db.pragma('foreign_keys = ON');

    runMigrations(_db);

    console.log(`[db] Opened: ${dbPath}`);
}

/**
 * Returns the open database connection.
 * Throws if open() has not been called — this is intentional so startup
 * order mistakes surface immediately rather than silently failing.
 */
export function db(): Database.Database {
    if (!_db) throw new Error('[db] Database is not open. Call open() first.');
    return _db;
}

/**
 * Closes the database. Called on app quit (optional but clean).
 */
export function close(): void {
    _db?.close();
    _db = null;
}