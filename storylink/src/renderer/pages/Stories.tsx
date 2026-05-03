// src/renderer/pages/Stories.tsx
import { useWorkspaceStore } from '../../store/Workspace.store';
import type { Issue } from '@shared/types/workspace.types';

export default function Stories() {
    const workspaces = useWorkspaceStore(s => s.workspaces);
    const activeWorkspace = useWorkspaceStore(s => s.activeWorkspace);  // fixed: no longer activeWorkspaceId
    const issues = useWorkspaceStore(s => s.issues);
    const issuesStatus = useWorkspaceStore(s => s.issuesStatus);
    const issuesError = useWorkspaceStore(s => s.issuesError);
    const loadIssues = useWorkspaceStore(s => s.loadIssues);

    if (workspaces.length === 0) {
        return (
            <div style={centred}>
                <p style={{ color: 'var(--text-muted)' }}>
                    No workspaces configured. Go to <strong>Workspaces</strong> to add one.
                </p>
            </div>
        );
    }

    if (!activeWorkspace) {
        return (
            <div style={centred}>
                <p style={{ color: 'var(--text-muted)' }}>
                    No active workspace. Go to <strong>Workspaces</strong> to activate one.
                </p>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px' }}>

            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '20px',
            }}>
                <div>
                    <h2 style={{ margin: '0 0 4px', color: 'var(--text)' }}>
                        {activeWorkspace.name}
                    </h2>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {activeWorkspace.projectName} · {activeWorkspace.projectKey}
                    </span>
                </div>
                <button
                    onClick={() => loadIssues({ forceRefresh: true })}
                    disabled={issuesStatus === 'loading'}
                    style={refreshBtn}
                >
                    {issuesStatus === 'loading' ? '…' : '↻ Refresh'}
                </button>
            </div>

            {issuesStatus === 'loading' && (
                <p style={{ color: 'var(--text-muted)' }}>Loading issues…</p>
            )}

            {issuesStatus === 'error' && issuesError && (
                <div style={errorBox}>
                    <p style={{ margin: 0, color: '#f44336' }}>{issuesError}</p>
                    <button
                        onClick={() => loadIssues({ forceRefresh: true })}
                        style={retryBtn}
                    >
                        Retry
                    </button>
                </div>
            )}

            {issuesStatus === 'idle' && issues.length === 0 && (
                <p style={{ color: 'var(--text-muted)' }}>
                    No issues found in {activeWorkspace.projectKey}.
                </p>
            )}

            {issues.map(issue => (
                <IssueCard key={issue.id} issue={issue} />
            ))}
        </div>
    );
}

function IssueCard({ issue }: { issue: Issue }) {
    return (
        <div style={card}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '6px',
            }}>
                <span style={{
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    fontFamily: 'monospace',
                }}>
                    {issue.key}
                </span>
                <Tag label={issue.type} color="#3a3a5c" />
                <Tag label={issue.priority} color="#4a3a3a" />
                <Tag label={issue.status} color="#003380" />
            </div>
            <p style={{
                margin: 0,
                color: 'var(--text)',
                fontWeight: 500,
                lineHeight: 1.5,
            }}>
                {issue.summary}
            </p>
        </div>
    );
}

function Tag({ label, color }: { label: string; color: string }) {
    return (
        <span style={{
            background: color,
            color: '#ccc',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '11px',
        }}>
            {label}
        </span>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const centred: React.CSSProperties = {
    padding: '48px 20px',
    textAlign: 'center',
};

const card: React.CSSProperties = {
    background: 'var(--header)',
    borderRadius: '8px',
    padding: '14px',
    marginBottom: '8px',
    border: '1px solid rgba(255,255,255,0.05)',
};

const refreshBtn: React.CSSProperties = {
    padding: '7px 14px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '6px',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '13px',
};

const errorBox: React.CSSProperties = {
    background: 'rgba(244,67,54,0.08)',
    border: '1px solid rgba(244,67,54,0.25)',
    borderRadius: '8px',
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
};

const retryBtn: React.CSSProperties = {
    padding: '6px 14px',
    background: '#f44336',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
};