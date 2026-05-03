// src/renderer/pages/Workspaces.tsx
import { useState } from 'react';
import { useWorkspaceStore } from '../../store/Workspace.store';
import AddWorkspaceModal from '../components/WorkspaceModal';

export default function Workspaces() {
    const {
        workspaces,
        activeWorkspaceId,
        setActiveWorkspace,
        removeWorkspace,
    } = useWorkspaceStore();

    const [showModal, setShowModal] = useState(false);
    const [removingId, setRemovingId] = useState<string | null>(null);

    const handleRemove = async (id: string) => {
        setRemovingId(id);
        await removeWorkspace(id);
        setRemovingId(null);
    };

    return (
        <div style={{ padding: '24px', maxWidth: '640px' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ margin: '0 0 4px', color: 'var(--text)' }}>Workspaces</h2>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                        Each workspace links a Jira account to a specific project.
                        Only one is active at a time.
                    </p>
                </div>
                <button onClick={() => setShowModal(true)} style={addBtn}>
                    + Add Workspace
                </button>
            </div>

            {/* Empty state */}
            {workspaces.length === 0 && (
                <div style={emptyBox}>
                    <div style={{ fontSize: '32px', marginBottom: '12px' }}>🗂️</div>
                    <p style={{ color: 'var(--text)', fontWeight: 500, margin: '0 0 6px' }}>
                        No workspaces yet
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 20px' }}>
                        Add a workspace to connect a Jira account and start tracking issues.
                    </p>
                    <button onClick={() => setShowModal(true)} style={addBtn}>
                        + Add your first workspace
                    </button>
                </div>
            )}

            {/* Workspace cards */}
            {workspaces.map(ws => {
                const isActive = ws.id === activeWorkspaceId;
                const isRemoving = removingId === ws.id;

                return (
                    <div key={ws.id} style={{
                        ...card,
                        border: isActive
                            ? '1px solid rgba(0,82,204,0.6)'
                            : '1px solid rgba(255,255,255,0.07)',
                    }}>
                        {/* Active badge */}
                        {isActive && (
                            <div style={activeBadge}>Active</div>
                        )}

                        {/* Workspace info */}
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                <div style={{
                                    width: '36px', height: '36px',
                                    background: isActive ? '#0052CC' : 'rgba(255,255,255,0.08)',
                                    borderRadius: '8px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '16px', fontWeight: 700, color: '#fff',
                                    flexShrink: 0,
                                }}>
                                    {ws.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '15px' }}>
                                        {ws.name}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        {ws.projectName} · <span style={{ fontFamily: 'monospace' }}>{ws.projectKey}</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', opacity: 0.6 }}>
                                account: {ws.accountId}
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '16px' }}>
                            {!isActive && (
                                <button
                                    onClick={() => setActiveWorkspace(ws.id)}
                                    style={activateBtn}
                                >
                                    Set Active
                                </button>
                            )}
                            <button
                                onClick={() => handleRemove(ws.id)}
                                disabled={isRemoving}
                                style={removeBtn}
                            >
                                {isRemoving ? 'Removing...' : 'Remove'}
                            </button>
                        </div>
                    </div>
                );
            })}

            {showModal && <AddWorkspaceModal onClose={() => setShowModal(false)} />}
        </div>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
    background: 'var(--header)',
    borderRadius: '10px',
    padding: '18px',
    marginBottom: '12px',
    position: 'relative',
};

const activeBadge: React.CSSProperties = {
    position: 'absolute',
    top: '14px',
    right: '14px',
    background: 'rgba(0,82,204,0.2)',
    color: '#4d94ff',
    border: '1px solid rgba(0,82,204,0.4)',
    borderRadius: '20px',
    padding: '2px 10px',
    fontSize: '11px',
    fontWeight: 600,
};

const emptyBox: React.CSSProperties = {
    textAlign: 'center',
    padding: '48px 24px',
    background: 'var(--header)',
    borderRadius: '12px',
    border: '1px dashed rgba(255,255,255,0.1)',
};

const addBtn: React.CSSProperties = {
    padding: '9px 16px',
    background: '#0052CC',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
};

const activateBtn: React.CSSProperties = {
    padding: '7px 14px',
    background: 'transparent',
    color: '#4d94ff',
    border: '1px solid rgba(0,82,204,0.4)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
};

const removeBtn: React.CSSProperties = {
    padding: '7px 14px',
    background: 'transparent',
    color: '#f44336',
    border: '1px solid rgba(244,67,54,0.3)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
};