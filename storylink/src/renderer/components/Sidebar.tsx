// src/renderer/components/Sidebar.tsx
import { NavLink } from 'react-router-dom';
import { Home, Layers, BookOpen, GitBranch, Settings, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';
import { useWorkspaceStore } from '../../store/Workspace.store';

function Sidebar() {
    const { theme, toggleTheme } = useTheme();
    const activeWorkspace = useWorkspaceStore(s => s.activeWorkspace());

    const linkStyle = ({ isActive }: { isActive: boolean }) => ({
        padding: '9px 12px',
        margin: '2px 0',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        color: isActive ? '#fff' : 'var(--text-muted)',
        background: isActive ? 'var(--active)' : 'transparent',
        textDecoration: 'none',
        fontSize: '13px',
        fontWeight: isActive ? 500 : 400,
        transition: 'all 0.15s ease',
    });

    return (
        <div style={{
            width: '200px',
            height: '100vh',
            background: 'var(--sidebar)',
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
        }}>
            {/* Logo */}
            <div style={{
                padding: '18px 14px 14px',
                fontWeight: 700,
                fontSize: '17px',
                color: 'var(--text)',
                letterSpacing: '-0.3px',
            }}>
                StoryLink
            </div>

            {/* Active workspace indicator */}
            {activeWorkspace && (
                <div style={{
                    margin: '0 8px 8px',
                    padding: '8px 10px',
                    background: 'rgba(0,82,204,0.12)',
                    border: '1px solid rgba(0,82,204,0.25)',
                    borderRadius: '8px',
                }}>
                    <div style={{ fontSize: '10px', color: '#4d94ff', fontWeight: 600, marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Active workspace
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {activeWorkspace.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {activeWorkspace.projectKey}
                    </div>
                </div>
            )}

            {/* Navigation */}
            <nav style={{ flex: 1, padding: '4px 8px', display: 'flex', flexDirection: 'column' }}>

                <NavLink to="/" end style={linkStyle}>
                    <Home size={15} strokeWidth={1.8} /> Workspace
                </NavLink>

                <NavLink to="/stories" style={linkStyle}>
                    <BookOpen size={15} strokeWidth={1.8} /> Stories
                </NavLink>

                <NavLink to="/releases" style={linkStyle}>
                    <GitBranch size={15} strokeWidth={1.8} /> Releases
                </NavLink>

                {/* Divider */}
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '8px 0' }} />

                <NavLink to="/workspaces" style={linkStyle}>
                    <Layers size={15} strokeWidth={1.8} /> Workspaces
                </NavLink>

                <NavLink to="/settings" style={linkStyle}>
                    <Settings size={15} strokeWidth={1.8} /> Settings
                </NavLink>
            </nav>

            {/* Theme toggle */}
            <button
                onClick={toggleTheme}
                style={{
                    margin: '0 8px 14px',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '13px',
                }}
            >
                {theme === 'dark'
                    ? <><Sun size={15} strokeWidth={1.8} /> Light mode</>
                    : <><Moon size={15} strokeWidth={1.8} /> Dark mode</>
                }
            </button>
        </div>
    );
}

export default Sidebar;