// electron/main/db/migrations.ts
// ─────────────────────────────────────────────────────────────────────────────
// Versioned migrations run automatically on app startup via db.ts open().
// To add a new migration:
//   1. Add a new SQL string to the MIGRATIONS array below.
//   2. That's it. The runner compares user_version to the array length and
//      runs only the entries that are newer than the stored version.
// Never modify existing entries — add new ones.
// ─────────────────────────────────────────────────────────────────────────────

import {
    CREATE_WORKSPACES,
    CREATE_PR_LINKS,
    CREATE_CACHED_ISSUES,
    CREATE_CACHED_PRS,
    CREATE_INDEXES,
} from './schema';
import type Database from 'better-sqlite3';

// Each entry is one migration version.
// Version 1 = MIGRATIONS[0], version 2 = MIGRATIONS[1], etc.
const MIGRATIONS: string[] = [
    // Version 1 — initial schema
    [
        CREATE_WORKSPACES,
        CREATE_PR_LINKS,
        CREATE_CACHED_ISSUES,
        CREATE_CACHED_PRS,
        CREATE_INDEXES,
    ].join('\n'),

    // Version 2 — example future migration (add a column):
    // `ALTER TABLE workspaces ADD COLUMN display_color TEXT`,
];

/**
 * Runs all pending migrations in a single transaction.
 * Called once by db.ts immediately after the database is opened.
 */
export function runMigrations(db: Database.Database): void {
    // SQLite stores user_version as a special PRAGMA integer (default 0)
    const currentVersion = (
        db.prepare('PRAGMA user_version').get() as { user_version: number }
    ).user_version;

    const pending = MIGRATIONS.slice(currentVersion);

    if (pending.length === 0) return;

    console.log(
        `[db] Running ${pending.length} migration(s) ` +
        `(schema v${currentVersion} → v${MIGRATIONS.length})`
    );

    // Run all pending migrations atomically — if any step fails the whole
    // transaction rolls back and the user_version stays unchanged.
    const runAll = db.transaction(() => {
        for (const sql of pending) {
            db.exec(sql);
        }
        // Update user_version — must use exec, PRAGMA can't be parameterised
        db.exec(`PRAGMA user_version = ${MIGRATIONS.length}`);
    });

    runAll();

    console.log(`[db] Migrations complete. Schema now at v${MIGRATIONS.length}`);
}