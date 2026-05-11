// src/renderer/components/WorkspaceModal.tsx
import { useState } from 'react';
import { useWorkspaceStore } from '../../store/Workspace.store';
import type { JiraProject, GitRepo } from '@shared/types/workspace.types';

// ── Step definitions ──────────────────────────────────────────────────────────

type Step =
    | 'jira-connect'    // Step 1 — Jira OAuth
    | 'jira-pick'       // Step 2 — Pick Jira project
    | 'github-connect'  // Step 3 — GitHub OAuth
    | 'github-pick'     // Step 4 — Pick GitHub repo
    | 'name';           // Step 5 — Name + save

const STEPS: Step[] = [
    'jira-connect',
    'jira-pick',
    'github-connect',
    'github-pick',
    'name',
];

const STEP_LABELS: Record<Step, string> = {
    'jira-connect': 'Jira account',
    'jira-pick': 'Jira project',
    'github-connect': 'GitHub account',
    'github-pick': 'GitHub repo',
    'name': 'Name',
};

// ── Component ─────────────────────────────────────────────────────────────────

type Props = { onClose: () => void };

export default function AddWorkspaceModal({ onClose }: Props) {
    const [step, setStep] = useState<Step>('jira-connect');

    // Jira state
    const [jiraProjects, setJiraProjects] = useState<JiraProject[]>([]);
    const [selectedPrj, setSelectedPrj] = useState<JiraProject | null>(null);

    // GitHub state
    const [githubLogin, setGithubLogin] = useState<string>('');
    const [githubRepos, setGithubRepos] = useState<GitRepo[]>([]);
    const [repoFilter, setRepoFilter] = useState('');
    const [selectedRepo, setSelectedRepo] = useState<GitRepo | null>(null);

    // Workspace name
    const [name, setName] = useState('');

    // UI state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const stepIndex = STEPS.indexOf(step);

    // ── Step 1: Jira OAuth ────────────────────────────────────────────────────

    const handleJiraConnect = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await window.jira.connect();
            if (!result.success) throw new Error(result.error ?? 'Jira connection failed');

            const prjResult = await window.jira.getProjectsForNewAccount();
            if (!prjResult.success) throw new Error(prjResult.error ?? 'Failed to load projects');

            setJiraProjects(
                prjResult.data?.projects?.map((p: any) => ({
                    id: p.id, key: p.key, name: p.name,
                })) ?? []
            );
            setStep('jira-pick');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // ── Step 2: Pick Jira project ─────────────────────────────────────────────

    const handlePickProject = (prj: JiraProject) => {
        setSelectedPrj(prj);
        setName(prj.name);   // pre-fill workspace name; user can change in step 5
        setStep('github-connect');
    };

    // ── Step 3: GitHub OAuth ──────────────────────────────────────────────────

    const handleGitHubConnect = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await window.github.connect();
            if (!result.success) throw new Error(result.error ?? 'GitHub connection failed');

            setGithubLogin(result.data?.login ?? '');

            const repoResult = await window.github.getReposForNewAccount();
            if (!repoResult.success) throw new Error(repoResult.error ?? 'Failed to load repos');

            setGithubRepos(
                repoResult.data?.repos?.map((r: any): GitRepo => ({
                    id: r.id,
                    fullName: r.fullName,
                    name: r.name,
                    private: r.private,
                    url: r.url,
                })) ?? []
            );
            setStep('github-pick');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // ── Step 4: Pick GitHub repo ──────────────────────────────────────────────

    const handlePickRepo = (repo: GitRepo) => {
        setSelectedRepo(repo);
        setStep('name');
    };

    const filteredRepos = githubRepos.filter(r =>
        r.fullName.toLowerCase().includes(repoFilter.toLowerCase())
    );

    // ── Step 5: Name + save ───────────────────────────────────────────────────

    const handleSave = async () => {
        if (!selectedPrj || !selectedRepo || !name.trim()) return;
        setLoading(true);
        setError(null);

        const result = await window.workspace.create({
            name: name.trim(),
            projectKey: selectedPrj.key,
            projectName: selectedPrj.name,
            gitRepoFullName: selectedRepo.fullName,
            gitRepoId: selectedRepo.id,
            // Both accountIds resolved by Electron from pending onboarding sessions
        });

        setLoading(false);

        if (!result.success) {
            setError(result.error ?? 'Failed to save workspace');
            return;
        }

        await useWorkspaceStore.getState().loadWorkspaces();
        onClose();
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div style={overlay}>
            <div style={modal}>

                {/* Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                }}>
                    <h3 style={{ margin: 0, color: 'var(--text)' }}>Add Workspace</h3>
                    <button onClick={onClose} style={closeBtn}>✕</button>
                </div>

                {/* Step progress */}
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                        {STEPS.map((s, i) => (
                            <div key={s} style={{
                                height: '3px',
                                flex: 1,
                                borderRadius: '2px',
                                background: i <= stepIndex
                                    ? (i < 2 ? '#0052CC' : '#238636')   // blue = Jira, green = GitHub
                                    : 'rgba(255,255,255,0.1)',
                                transition: 'background 0.2s ease',
                            }} />
                        ))}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Step {stepIndex + 1} of {STEPS.length} — {STEP_LABELS[step]}
                    </div>
                </div>

                {/* ── Step 1: Jira connect ── */}
                {step === 'jira-connect' && (
                    <StepShell
                        icon="🔵"
                        title="Connect Jira"
                        description="Your browser will open so you can log in securely on Atlassian's website."
                    >
                        <button onClick={handleJiraConnect} disabled={loading} style={primaryBtn('#0052CC')}>
                            {loading ? '⏳ Waiting for browser…' : 'Connect Jira Account'}
                        </button>
                    </StepShell>
                )}

                {/* ── Step 2: Pick Jira project ── */}
                {step === 'jira-pick' && (
                    <StepShell title="Select Jira project">
                        <div style={scrollList}>
                            {jiraProjects.map(prj => (
                                <div
                                    key={prj.id}
                                    onClick={() => handlePickProject(prj)}
                                    style={listRow}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,82,204,0.08)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg)')}
                                >
                                    <div>
                                        <div style={{ fontWeight: 500, color: 'var(--text)' }}>{prj.name}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{prj.key}</div>
                                    </div>
                                    <span style={{ color: 'var(--text-muted)' }}>›</span>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setStep('jira-connect')} style={ghostBtn}>← Back</button>
                    </StepShell>
                )}

                {/* ── Step 3: GitHub connect ── */}
                {step === 'github-connect' && (
                    <StepShell
                        icon="⬛"
                        title="Connect GitHub"
                        description="Your browser will open so you can authorise StoryLink to read your repositories."
                    >
                        <div style={{ marginBottom: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                            ✓ Jira project: <strong style={{ color: 'var(--text)' }}>{selectedPrj?.name}</strong>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={handleGitHubConnect} disabled={loading} style={primaryBtn('#238636')}>
                                {loading ? '⏳ Waiting for browser…' : 'Connect GitHub Account'}
                            </button>
                            <button onClick={() => setStep('jira-pick')} style={ghostBtn}>← Back</button>
                        </div>
                    </StepShell>
                )}

                {/* ── Step 4: Pick GitHub repo ── */}
                {step === 'github-pick' && (
                    <StepShell title={`Repositories for ${githubLogin}`}>
                        {/* Filter input */}
                        <input
                            value={repoFilter}
                            onChange={e => setRepoFilter(e.target.value)}
                            placeholder="Filter repositories…"
                            autoFocus
                            style={{ ...inputStyle, marginBottom: '8px' }}
                        />
                        <div style={scrollList}>
                            {filteredRepos.length === 0 && (
                                <p style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '8px' }}>
                                    No repositories match.
                                </p>
                            )}
                            {filteredRepos.map(repo => (
                                <div
                                    key={repo.id}
                                    onClick={() => handlePickRepo(repo)}
                                    style={listRow}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(35,134,54,0.08)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg)')}
                                >
                                    <div>
                                        <div style={{ fontWeight: 500, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {repo.name}
                                            {repo.private && (
                                                <span style={privateBadge}>private</span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{repo.fullName}</div>
                                    </div>
                                    <span style={{ color: 'var(--text-muted)' }}>›</span>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setStep('github-connect')} style={ghostBtn}>← Back</button>
                    </StepShell>
                )}

                {/* ── Step 5: Name + save ── */}
                {step === 'name' && (
                    <StepShell title="Name your workspace">
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSave()}
                            placeholder="e.g. Work — Mobile App"
                            autoFocus
                            style={{ ...inputStyle, marginBottom: '12px' }}
                        />

                        {/* Summary card */}
                        <div style={summaryCard}>
                            <SummaryRow label="Jira project" value={`${selectedPrj?.name} (${selectedPrj?.key})`} color="#0052CC" />
                            <SummaryRow label="GitHub repo" value={selectedRepo?.fullName ?? ''} color="#238636" />
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                            <button
                                onClick={handleSave}
                                disabled={loading || !name.trim()}
                                style={primaryBtn('#0052CC')}
                            >
                                {loading ? 'Saving…' : 'Save Workspace'}
                            </button>
                            <button onClick={() => setStep('github-pick')} style={ghostBtn}>← Back</button>
                        </div>
                    </StepShell>
                )}

                {/* Error */}
                {error && (
                    <p style={{ color: '#f44336', marginTop: '14px', fontSize: '13px' }}>
                        {error}
                    </p>
                )}
            </div>
        </div>
    );
}

// ── Small sub-components ──────────────────────────────────────────────────────

function StepShell({
    icon, title, description, children,
}: {
    icon?: string;
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <>
            {icon && <div style={{ fontSize: '28px', marginBottom: '10px' }}>{icon}</div>}
            <p style={{ fontWeight: 600, color: 'var(--text)', margin: '0 0 6px', fontSize: '15px' }}>{title}</p>
            {description && (
                <p style={{ color: 'var(--text-muted)', margin: '0 0 18px', lineHeight: 1.6, fontSize: '13px' }}>
                    {description}
                </p>
            )}
            {children}
        </>
    );
}

function SummaryRow({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</span>
            <span style={{
                fontSize: '12px',
                color,
                fontWeight: 500,
                maxWidth: '220px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
            }}>
                {value}
            </span>
        </div>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.65)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100,
};

const modal: React.CSSProperties = {
    background: 'var(--header)',
    borderRadius: '12px',
    padding: '24px',
    width: '440px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
    maxHeight: '90vh',
    overflowY: 'auto',
};

const scrollList: React.CSSProperties = {
    maxHeight: '260px',
    overflowY: 'auto',
    marginBottom: '12px',
};

const listRow: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    marginBottom: '4px',
    background: 'var(--bg)',
    border: '1px solid rgba(255,255,255,0.05)',
    transition: 'background 0.1s ease',
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--bg)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '6px',
    color: 'var(--text)',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
};

const summaryCard: React.CSSProperties = {
    background: 'var(--bg)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    padding: '4px 14px',
};

const privateBadge: React.CSSProperties = {
    fontSize: '10px',
    padding: '1px 6px',
    borderRadius: '4px',
    background: 'rgba(255,255,255,0.08)',
    color: 'var(--text-muted)',
    border: '1px solid rgba(255,255,255,0.1)',
};

const primaryBtn = (bg: string): React.CSSProperties => ({
    padding: '10px 18px',
    background: bg,
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    opacity: 1,
});

const ghostBtn: React.CSSProperties = {
    padding: '10px 18px',
    background: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
};

const closeBtn: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px',
};