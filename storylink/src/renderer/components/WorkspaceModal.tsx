// src/renderer/components/AddWorkspaceModal.tsx
import { useState } from 'react';
import { useWorkspaceStore } from '../../store/Workspace.store';
import type { JiraProject } from '../../types/workspace.types';

type Step = 'connect' | 'pick-project' | 'name';

type Props = { onClose: () => void };

export default function AddWorkspaceModal({ onClose }: Props) {
    const { connectNewAccount, fetchProjectsForAccount, addWorkspace } = useWorkspaceStore();

    const [step, setStep] = useState<Step>('connect');
    const [accountId, setAccountId] = useState<string | null>(null);
    const [projects, setProjects] = useState<JiraProject[]>([]);
    const [selectedPrj, setSelectedPrj] = useState<JiraProject | null>(null);
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Step 1: OAuth

    const handleConnect = async () => {
        setLoading(true);
        setError(null);

        try {
            const id = await connectNewAccount();
            setAccountId(id);

            const prjs = await fetchProjectsForAccount(id);
            setLoading(false);

            if (!prjs.length) {
                setError('No Jira projects found for this account.');
                return;
            }

            setProjects(prjs);
            setStep('pick-project');
        } catch (err: any) {
            setLoading(false);
            setError(err.message);   // ← now shows the real error
        }
    };

    // Step 2: Pick project
    const handlePickProject = (prj: JiraProject) => {
        setSelectedPrj(prj);
        setName(prj.name);
        setStep('name');
    };

    // Step 3: Save
    const handleSave = () => {
        if (!accountId || !selectedPrj || !name.trim()) return;
        addWorkspace(name.trim(), selectedPrj.key, selectedPrj.name, accountId);
        onClose();
    };

    const steps: Step[] = ['connect', 'pick-project', 'name'];

    return (
        <div style={overlay}>
            <div style={modal}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, color: 'var(--text)' }}>Add Workspace</h3>
                    <button onClick={onClose} style={closeBtn}>✕</button>
                </div>

                {/* Step progress bar */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '24px' }}>
                    {steps.map((s, i) => (
                        <div key={s} style={{
                            height: '3px',
                            flex: 1,
                            borderRadius: '2px',
                            background: i <= steps.indexOf(step) ? '#0052CC' : 'rgba(255,255,255,0.1)',
                            transition: 'background 0.2s ease',
                        }} />
                    ))}
                </div>

                {/* Step 1 */}
                {step === 'connect' && (
                    <>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.6 }}>
                            Connect a Jira account. Your browser will open so you can
                            log in securely on Atlassian's website.
                        </p>
                        <button onClick={handleConnect} disabled={loading} style={primaryBtn}>
                            {loading ? '⏳ Waiting for browser...' : 'Connect Jira Account'}
                        </button>
                    </>
                )}

                {/* Step 2 */}
                {step === 'pick-project' && (
                    <>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '12px' }}>
                            Select which Jira project to track:
                        </p>
                        <div style={{ maxHeight: '280px', overflowY: 'auto', marginBottom: '8px' }}>
                            {projects.map(prj => (
                                <div key={prj.id} onClick={() => handlePickProject(prj)} style={projectRow}>
                                    <div>
                                        <div style={{ fontWeight: 500, color: 'var(--text)' }}>{prj.name}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{prj.key}</div>
                                    </div>
                                    <span style={{ color: 'var(--text-muted)' }}>›</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* Step 3 */}
                {step === 'name' && (
                    <>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '12px' }}>
                            Give this workspace a name:
                        </p>
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSave()}
                            placeholder="e.g. Work — Mobile App"
                            autoFocus
                            style={inputStyle}
                        />
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '8px 0 20px' }}>
                            Project: <strong style={{ color: 'var(--text)' }}>{selectedPrj?.name}</strong> ({selectedPrj?.key})
                        </p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={handleSave} disabled={!name.trim()} style={primaryBtn}>
                                Save Workspace
                            </button>
                            <button onClick={() => setStep('pick-project')} style={ghostBtn}>
                                Back
                            </button>
                        </div>
                    </>
                )}

                {error && <p style={{ color: '#f44336', marginTop: '14px', fontSize: '13px' }}>{error}</p>}
            </div>
        </div>
    );
}

const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.65)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100,
};
const modal: React.CSSProperties = {
    background: 'var(--header)', borderRadius: '12px',
    padding: '24px', width: '420px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
};
const projectRow: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px', borderRadius: '6px', cursor: 'pointer',
    marginBottom: '4px', background: 'var(--bg)',
    border: '1px solid rgba(255,255,255,0.05)',
};
const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    background: 'var(--bg)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '6px', color: 'var(--text)', fontSize: '14px',
    outline: 'none', boxSizing: 'border-box',
};
const primaryBtn: React.CSSProperties = {
    padding: '10px 18px', background: '#0052CC', color: '#fff',
    border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
};
const ghostBtn: React.CSSProperties = {
    padding: '10px 18px', background: 'transparent', color: 'var(--text-muted)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
    cursor: 'pointer', fontSize: '14px',
};
const closeBtn: React.CSSProperties = {
    background: 'transparent', border: 'none', color: 'var(--text-muted)',
    cursor: 'pointer', fontSize: '16px', padding: '4px',
};