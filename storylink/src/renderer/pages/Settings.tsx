// src/renderer/pages/Settings.tsx
import { JiraConnection } from '../hooks/JiraConnection';

export default function Settings() {
    const { connected, loading, error, handleConnect } = JiraConnection();

    return (
        <div style={{ padding: '12px' }}>
            <div style={{
                background: 'var(--header)',
                borderRadius: '8px',
                padding: '20px',
            }}>
                {/* Fixed typo: "Integartion" → "Integration" */}
                <h3 style={{ margin: '0 0 12px' }}>Jira Integration</h3>

                {connected === null && (
                    <p style={{ color: 'var(--text-muted)' }}>Checking connection…</p>
                )}

                {connected === false && (
                    <>
                        <p style={{ color: 'var(--text-muted)', margin: '0 0 12px' }}>
                            Connect your Jira account to sync issues and releases.
                        </p>
                        {/* Fixed label: was "Jira connected" when not yet connected */}
                        <button
                            onClick={handleConnect}
                            disabled={loading}
                            style={btnStyle}
                        >
                            {loading ? 'Connecting…' : 'Connect Jira'}
                        </button>
                    </>
                )}

                {connected === true && (
                    <p style={{ color: '#4caf50' }}>✓ Jira connected</p>
                )}

                {error && (
                    <p style={{ color: '#f44336', marginTop: '12px' }}>{error}</p>
                )}
            </div>
        </div>
    );
}

const btnStyle: React.CSSProperties = {
    padding: '10px 20px',
    background: '#0052CC',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
};