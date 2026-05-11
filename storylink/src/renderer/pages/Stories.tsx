// src/renderer/pages/Stories.tsx
import { useState, useCallback, useEffect } from 'react';
import { useWorkspaceStore } from '../../store/Workspace.store';
import type {
    LinkedStoryGroup,
    LinkedIssue,
    LinkedPR,
    GitHubPR,
} from '@shared/types/workspace.types';

// ── Top-level page ────────────────────────────────────────────────────────────

export default function Stories() {
    const activeWorkspace = useWorkspaceStore(s => s.activeWorkspace);
    const workspaces = useWorkspaceStore(s => s.workspaces);

    const [groups, setGroups] = useState<LinkedStoryGroup[]>([]);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'error'>('idle');
    const [syncError, setSyncError] = useState<string | null>(null);
    const [lastSynced, setLastSynced] = useState<Date | null>(null);

    // Link PR modal state — null = closed
    const [linkTarget, setLinkTarget] = useState<{ issueKey: string; summary: string } | null>(null);

    const sync = useCallback(async () => {
        setSyncStatus('loading');
        setSyncError(null);
        const result = await window.stories.sync();
        if (!result.success || !result.data) {
            setSyncStatus('error');
            setSyncError(result.error ?? 'Sync failed');
            return;
        }
        setGroups(result.data);
        setSyncStatus('idle');
        setLastSynced(new Date());
    }, []);

    // Auto-sync on mount when there is an active workspace
    useEffect(() => {
        if (activeWorkspace) sync();
    }, [activeWorkspace?.id]); // re-sync if workspace switches

    // Update a single issue in state after link/unlink without full re-sync
    const updateIssue = useCallback((updated: LinkedIssue) => {
        setGroups(prev => prev.map(group => ({
            ...group,
            stories: group.stories.map(s =>
                s.key === updated.key ? updated : {
                    ...s,
                    children: s.children.map(c => c.key === updated.key ? updated : c),
                }
            ),
        })));
    }, []);

    // ── Empty states ──────────────────────────────────────────────────────────

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
                    No active workspace selected.
                </p>
            </div>
        );
    }

    // ── Main layout ───────────────────────────────────────────────────────────

    return (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%' }}>

            {/* Toolbar */}
            <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: '16px', flexShrink: 0,
            }}>
                <div>
                    <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '16px' }}>
                        Stories
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '13px', marginLeft: '10px' }}>
                        {activeWorkspace.projectKey} · {activeWorkspace.gitRepoFullName}
                    </span>
                    {lastSynced && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: '12px' }}>
                            Last synced {formatRelative(lastSynced)}
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={sync}
                        disabled={syncStatus === 'loading'}
                        style={toolbarBtn}
                    >
                        {syncStatus === 'loading' ? '⏳ Syncing…' : '↻ Sync'}
                    </button>
                    <button
                        onClick={() => setLinkTarget({ issueKey: '', summary: 'a story' })}
                        style={{ ...toolbarBtn, color: '#4d94ff', borderColor: 'rgba(0,82,204,0.4)' }}
                    >
                        + Link PR
                    </button>
                </div>
            </div>

            {/* Error banner */}
            {syncStatus === 'error' && syncError && (
                <div style={errorBanner}>
                    <span>{syncError}</span>
                    <button onClick={sync} style={retryBtn}>Retry</button>
                </div>
            )}

            {/* Status columns */}
            {syncStatus === 'loading' && groups.length === 0 ? (
                <div style={centred}>
                    <p style={{ color: 'var(--text-muted)' }}>Loading stories…</p>
                </div>
            ) : (
                <div style={{
                    display: 'flex', gap: '14px',
                    overflowX: 'auto', flex: 1, alignItems: 'flex-start',
                }}>
                    {groups.map(group => (
                        <StatusColumn
                            key={group.status}
                            group={group}
                            onLinkPR={(issueKey, summary) => setLinkTarget({ issueKey, summary })}
                            onUpdateIssue={updateIssue}
                        />
                    ))}
                    {groups.length === 0 && syncStatus === 'idle' && (
                        <div style={centred}>
                            <p style={{ color: 'var(--text-muted)' }}>No stories found.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Link PR modal */}
            {linkTarget !== null && (
                <LinkPRModal
                    issueKey={linkTarget.issueKey}
                    issueSummary={linkTarget.summary}
                    onClose={() => setLinkTarget(null)}
                    onLinked={updateIssue}
                />
            )}
        </div>
    );
}

// ── Status column ─────────────────────────────────────────────────────────────

function StatusColumn({
    group, onLinkPR, onUpdateIssue,
}: {
    group: LinkedStoryGroup;
    onLinkPR: (issueKey: string, summary: string) => void;
    onUpdateIssue: (issue: LinkedIssue) => void;
}) {
    return (
        <div style={column}>
            <div style={columnHeader}>
                <span>{group.status}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    {group.stories.length}
                </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {group.stories.map(story => (
                    <StoryCard
                        key={story.key}
                        story={story}
                        onLinkPR={onLinkPR}
                        onUpdateIssue={onUpdateIssue}
                    />
                ))}
            </div>
        </div>
    );
}

// ── Story card ────────────────────────────────────────────────────────────────

function StoryCard({
    story, onLinkPR, onUpdateIssue,
}: {
    story: LinkedIssue;
    onLinkPR: (issueKey: string, summary: string) => void;
    onUpdateIssue: (issue: LinkedIssue) => void;
}) {
    const [expanded, setExpanded] = useState(true);
    const hasChildren = story.children.length > 0;

    const handleUnlink = async (pr: LinkedPR) => {
        const result = await window.stories.unlinkPR(story.key, pr.prNumber);
        if (result.success && result.data) onUpdateIssue(result.data);
    };

    return (
        <div style={card}>
            {/* Epic badge */}
            {story.epicLabel && (
                <div style={epicBadge}>{story.epicLabel}</div>
            )}

            {/* Story header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '8px' }}>
                {hasChildren && (
                    <button
                        onClick={() => setExpanded(e => !e)}
                        style={chevronBtn}
                    >
                        {expanded ? '▾' : '▸'}
                    </button>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={issueKey}>{story.key}</span>
                        <TypeBadge type={story.type} />
                        <PriorityDot priority={story.priority} />
                    </div>
                    <div style={{
                        fontSize: '13px', color: 'var(--text)',
                        fontWeight: 500, marginTop: '4px', lineHeight: 1.4,
                    }}>
                        {story.summary}
                    </div>
                </div>
                <button
                    onClick={() => onLinkPR(story.key, story.summary)}
                    style={linkBtn}
                    title="Link a PR to this story"
                >
                    + PR
                </button>
            </div>

            {/* PRs on the story itself */}
            {story.linkedPRs.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                    {story.linkedPRs.map(pr => (
                        <PRBadge
                            key={pr.prNumber}
                            pr={pr}
                            onUnlink={pr.source === 'manual' ? () => handleUnlink(pr) : undefined}
                        />
                    ))}
                </div>
            )}

            {/* Children */}
            {expanded && story.children.length > 0 && (
                <div style={{ marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
                    {story.children.map(child => (
                        <ChildRow
                            key={child.key}
                            child={child}
                            onLinkPR={onLinkPR}
                            onUpdateIssue={onUpdateIssue}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Child row ─────────────────────────────────────────────────────────────────

function ChildRow({
    child, onLinkPR, onUpdateIssue,
}: {
    child: LinkedIssue;
    onLinkPR: (issueKey: string, summary: string) => void;
    onUpdateIssue: (issue: LinkedIssue) => void;
}) {
    const handleUnlink = async (pr: LinkedPR) => {
        const result = await window.stories.unlinkPR(child.key, pr.prNumber);
        if (result.success && result.data) onUpdateIssue(result.data);
    };

    return (
        <div style={childRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={{ ...issueKey, fontSize: '11px', opacity: 0.8 }}>{child.key}</span>
                <TypeBadge type={child.type} />
                <PriorityDot priority={child.priority} />
                <span style={{ flex: 1, fontSize: '12px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {child.summary}
                </span>
                <button
                    onClick={() => onLinkPR(child.key, child.summary)}
                    style={linkBtn}
                    title="Link a PR"
                >
                    + PR
                </button>
            </div>
            {child.linkedPRs.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', paddingLeft: '4px' }}>
                    {child.linkedPRs.map(pr => (
                        <PRBadge
                            key={pr.prNumber}
                            pr={pr}
                            onUnlink={pr.source === 'manual' ? () => handleUnlink(pr) : undefined}
                        />
                    ))}
                </div>
            ) : (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', paddingLeft: '4px' }}>
                    No PRs linked
                </span>
            )}
        </div>
    );
}

// ── PR badge ──────────────────────────────────────────────────────────────────

function PRBadge({ pr, onUnlink }: { pr: LinkedPR; onUnlink?: () => void }) {
    const { bg, color } = prStateStyle(pr.state);

    return (
        <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '2px 8px', borderRadius: '12px', fontSize: '11px',
            background: bg, color, border: `1px solid ${color}33`,
            cursor: 'pointer', maxWidth: '220px',
        }}
            onClick={() => window.open(pr.url, '_blank')}
            title={`Open PR #${pr.prNumber} in browser`}
        >
            <span style={{ opacity: 0.7 }}>#{pr.prNumber}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                {pr.prTitle}
            </span>
            <span style={{ opacity: 0.6, fontSize: '10px' }}>
                {pr.draft ? 'draft' : pr.state}
            </span>
            {onUnlink && (
                <button
                    onClick={e => { e.stopPropagation(); onUnlink(); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color, padding: '0 0 0 2px', fontSize: '11px', lineHeight: 1 }}
                    title="Unlink this PR"
                >
                    ×
                </button>
            )}
        </div>
    );
}

// ── Link PR modal ─────────────────────────────────────────────────────────────

function LinkPRModal({
    issueKey, issueSummary, onClose, onLinked,
}: {
    issueKey: string;
    issueSummary: string;
    onClose: () => void;
    onLinked: (issue: LinkedIssue) => void;
}) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<GitHubPR[]>([]);
    const [pasteUrl, setPasteUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load PR list on mount
    useEffect(() => {
        window.stories.searchPRs('').then(res => {
            if (res.success && res.data) setResults(res.data);
        });
    }, []);

    // Filter as user types
    useEffect(() => {
        window.stories.searchPRs(query).then(res => {
            if (res.success && res.data) setResults(res.data);
        });
    }, [query]);

    const handleLink = async (prNumber: number) => {
        if (!issueKey) { setError('No issue key selected'); return; }
        setLoading(true);
        setError(null);
        const result = await window.stories.linkPR(issueKey, prNumber);
        setLoading(false);
        if (!result.success || !result.data) {
            setError(result.error ?? 'Failed to link PR');
            return;
        }
        onLinked(result.data);
        onClose();
    };

    const handlePaste = async () => {
        if (!pasteUrl.trim()) return;
        setLoading(true);
        setError(null);
        const prResult = await window.stories.getPRByUrl(pasteUrl.trim());
        if (!prResult.success || !prResult.data) {
            setLoading(false);
            setError(prResult.error ?? 'Could not fetch PR');
            return;
        }
        await handleLink(prResult.data.number);
    };

    return (
        <div style={overlay}>
            <div style={modalBox}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                            Link a PR {issueKey ? `to ${issueKey}` : ''}
                        </div>
                        {issueSummary && (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {issueSummary}
                            </div>
                        )}
                    </div>
                    <button onClick={onClose} style={closeBtnStyle}>✕</button>
                </div>

                {/* Search */}
                <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search by PR title or #number…"
                    autoFocus
                    style={inputStyle}
                />

                {/* Results */}
                <div style={{ maxHeight: '200px', overflowY: 'auto', margin: '8px 0' }}>
                    {results.length === 0 && (
                        <p style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '8px' }}>
                            No PRs found. Run a sync first.
                        </p>
                    )}
                    {results.map(pr => {
                        const { bg, color } = prStateStyle(
                            pr.merged ? 'merged' : pr.state === 'closed' ? 'closed' : 'open'
                        );
                        return (
                            <div
                                key={pr.number}
                                style={{
                                    display: 'flex', justifyContent: 'space-between',
                                    alignItems: 'center', padding: '8px 10px',
                                    borderRadius: '6px', marginBottom: '4px',
                                    background: 'var(--bg)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    cursor: 'pointer',
                                }}
                                onClick={() => handleLink(pr.number)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>#{pr.number}</span>
                                    <span style={{ fontSize: '13px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {pr.title}
                                    </span>
                                </div>
                                <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '8px', background: bg, color, flexShrink: 0, marginLeft: '8px' }}>
                                    {pr.merged ? 'merged' : pr.state}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '10px 0' }}>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>or paste a GitHub PR URL</span>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                </div>

                {/* Paste URL */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                        value={pasteUrl}
                        onChange={e => setPasteUrl(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handlePaste()}
                        placeholder="https://github.com/owner/repo/pull/123"
                        style={{ ...inputStyle, flex: 1 }}
                    />
                    <button
                        onClick={handlePaste}
                        disabled={loading || !pasteUrl.trim()}
                        style={{ ...toolbarBtn, background: '#0052CC', color: '#fff', borderColor: '#0052CC' }}
                    >
                        {loading ? '…' : 'Link'}
                    </button>
                </div>

                {error && (
                    <p style={{ color: '#f44336', fontSize: '12px', marginTop: '10px' }}>{error}</p>
                )}
            </div>
        </div>
    );
}

// ── Small components ──────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
    const colors: Record<string, string> = {
        Story: '#0052CC', Task: '#3a3a5c', Bug: '#8B0000', Epic: '#6B46C1',
    };
    return (
        <span style={{
            fontSize: '10px', padding: '1px 6px', borderRadius: '4px',
            background: colors[type] ?? '#3a3a5c', color: '#ccc',
        }}>
            {type}
        </span>
    );
}

function PriorityDot({ priority }: { priority: string }) {
    const colors: Record<string, string> = {
        Highest: '#f44336', High: '#ff7043', Medium: '#ffa726',
        Low: '#66bb6a', Lowest: '#78909c',
    };
    return (
        <span
            title={priority}
            style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background: colors[priority] ?? '#78909c',
                display: 'inline-block', flexShrink: 0,
            }}
        />
    );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function prStateStyle(state: string): { bg: string; color: string } {
    if (state === 'open') return { bg: 'rgba(35,134,54,0.15)', color: '#3fb950' };
    if (state === 'merged') return { bg: 'rgba(163,113,247,0.15)', color: '#a371f7' };
    return { bg: 'rgba(139,148,158,0.15)', color: '#8b949e' }; // closed
}

function formatRelative(date: Date): string {
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const centred: React.CSSProperties = { padding: '48px 20px', textAlign: 'center', width: '100%' };

const column: React.CSSProperties = {
    minWidth: '280px', maxWidth: '320px', flex: '0 0 300px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '10px', padding: '10px',
    maxHeight: 'calc(100vh - 160px)', overflowY: 'auto',
};

const columnHeader: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '10px', padding: '4px 2px',
    fontWeight: 600, fontSize: '13px', color: 'var(--text)',
    borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px',
};

const card: React.CSSProperties = {
    background: 'var(--header)', borderRadius: '8px',
    padding: '12px', position: 'relative',
    border: '1px solid rgba(255,255,255,0.06)',
};

const childRow: React.CSSProperties = {
    padding: '6px 0 6px 8px',
    borderLeft: '2px solid rgba(255,255,255,0.08)',
    marginBottom: '6px',
};

const epicBadge: React.CSSProperties = {
    position: 'absolute', top: '8px', right: '8px',
    fontSize: '10px', padding: '2px 8px', borderRadius: '10px',
    background: 'rgba(107,70,193,0.2)', color: '#a78bfa',
    border: '1px solid rgba(107,70,193,0.3)',
};

const issueKey: React.CSSProperties = {
    fontSize: '12px', color: 'var(--text-muted)',
    fontFamily: 'monospace', fontWeight: 600,
};

const linkBtn: React.CSSProperties = {
    fontSize: '11px', padding: '2px 6px',
    background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '4px', color: 'var(--text-muted)',
    cursor: 'pointer', flexShrink: 0,
};

const chevronBtn: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted)', padding: '0', fontSize: '12px',
    lineHeight: 1, flexShrink: 0,
};

const toolbarBtn: React.CSSProperties = {
    padding: '7px 14px', background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '6px', color: 'var(--text-muted)',
    cursor: 'pointer', fontSize: '13px',
};

const errorBanner: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: 'rgba(244,67,54,0.08)', border: '1px solid rgba(244,67,54,0.25)',
    borderRadius: '6px', padding: '8px 12px', marginBottom: '12px',
    color: '#f44336', fontSize: '13px',
};

const retryBtn: React.CSSProperties = {
    padding: '4px 10px', background: '#f44336', color: '#fff',
    border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px',
};

const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
};

const modalBox: React.CSSProperties = {
    background: 'var(--header)', borderRadius: '12px',
    padding: '20px', width: '460px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
    maxHeight: '90vh', overflowY: 'auto',
};

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px',
    background: 'var(--bg)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '6px', color: 'var(--text)', fontSize: '13px',
    outline: 'none', boxSizing: 'border-box',
};

const closeBtnStyle: React.CSSProperties = {
    background: 'transparent', border: 'none',
    color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', padding: '4px',
};