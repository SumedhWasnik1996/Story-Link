// electron/main/db/schema.ts
// ─────────────────────────────────────────────────────────────────────────────
// Pure SQL CREATE TABLE statements.
// Each string is idempotent (IF NOT EXISTS) so they are safe to re-run.
// The migrations array in migrations.ts references these.
// ─────────────────────────────────────────────────────────────────────────────

export const CREATE_WORKSPACES = `
    CREATE TABLE IF NOT EXISTS workspaces (
        id                  TEXT    PRIMARY KEY,
        name                TEXT    NOT NULL,
        account_id          TEXT    NOT NULL,
        project_key         TEXT    NOT NULL,
        project_name        TEXT    NOT NULL,
        git_account_id      TEXT    NOT NULL,
        git_repo_full_name  TEXT    NOT NULL,
        git_repo_id         INTEGER NOT NULL,
        is_active           INTEGER NOT NULL DEFAULT 0,
        created_at          INTEGER NOT NULL
    );
`;

// pr_links stores both auto-detected and manually added PR↔issue associations.
// Manual links (source = 'manual') survive every sync.
// Auto links (source = 'auto') are rebuilt on every sync.
// UNIQUE constraint prevents duplicate rows for the same workspace+issue+PR.
export const CREATE_PR_LINKS = `
    CREATE TABLE IF NOT EXISTS pr_links (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id    TEXT    NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        issue_key       TEXT    NOT NULL,
        pr_number       INTEGER NOT NULL,
        pr_title        TEXT    NOT NULL,
        source          TEXT    NOT NULL CHECK(source IN ('auto','manual')),
        added_at        INTEGER NOT NULL,
        UNIQUE(workspace_id, issue_key, pr_number)
    );
`;

// cached_issues stores the full raw Jira issue JSON per workspace.
// Keyed by workspace_id + issue_key so upserts are simple.
export const CREATE_CACHED_ISSUES = `
    CREATE TABLE IF NOT EXISTS cached_issues (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id    TEXT    NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        issue_key       TEXT    NOT NULL,
        data            TEXT    NOT NULL,
        fetched_at      INTEGER NOT NULL,
        UNIQUE(workspace_id, issue_key)
    );
`;

// cached_prs stores the full raw GitHub PR JSON per workspace.
// Keyed by workspace_id + pr_number.
export const CREATE_CACHED_PRS = `
    CREATE TABLE IF NOT EXISTS cached_prs (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id    TEXT    NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        pr_number       INTEGER NOT NULL,
        data            TEXT    NOT NULL,
        fetched_at      INTEGER NOT NULL,
        UNIQUE(workspace_id, pr_number)
    );
`;

// Indexes for the most common query patterns
export const CREATE_INDEXES = `
    CREATE INDEX IF NOT EXISTS idx_pr_links_workspace     ON pr_links(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_pr_links_issue_key     ON pr_links(workspace_id, issue_key);
    CREATE INDEX IF NOT EXISTS idx_cached_issues_workspace ON cached_issues(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_cached_prs_workspace   ON cached_prs(workspace_id);
`;