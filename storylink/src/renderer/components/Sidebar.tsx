import { NavLink } from 'react-router-dom';
import { Home, Settings, Folder, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';

function Sidebar() {
    const { theme, toggleTheme } = useTheme();

    const linkStyle = ({ isActive }: { isActive: boolean }) => ({
        padding: '10px',
        margin: '6px 0',
        borderRadius: '8px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: isActive ? 'var(--text)' : 'var(--text-muted)',
        background: isActive ? 'var(--active)' : 'transparent',
        transition: 'all 0.2s ease'
    });

    return (
        <div
            style={{
                width: '60px',
                height: '100vh',
                background: 'var(--sidebar)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: '12px',
                borderRight: '1px solid rgba(255,255,255,0.05)'
            }}
        >
            {/* Top Navigation */}
            <nav
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                }}
            >
                <NavLink to="/" end style={linkStyle}>
                    <Home size={20} strokeWidth={1.5} />
                </NavLink>

                <NavLink to="/releases" style={linkStyle}>
                    <Folder size={20} strokeWidth={1.5} />
                </NavLink>

                <NavLink to="/settings" style={linkStyle}>
                    <Settings size={20} strokeWidth={1.5} />
                </NavLink>
            </nav>

            {/* Theme Toggle (Bottom) */}
            <button
                onClick={toggleTheme}
                style={{
                    marginTop: 'auto',
                    marginBottom: '12px',
                    padding: '10px',
                    borderRadius: '8px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                {theme === 'dark' ? (
                    <Sun size={20} strokeWidth={1.5} />
                ) : (
                    <Moon size={20} strokeWidth={1.5} />
                )}
            </button>
        </div>
    );
}

export default Sidebar;