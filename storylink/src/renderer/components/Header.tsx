// src/shared/components/Header.tsx
import { useLocation } from 'react-router-dom';

export default function Header() {
    const { pathname } = useLocation();

    const titles: Record<string, string> = {
        '/': 'Workspace',
        '/releases': 'Releases',
        '/settings': 'Settings'
    };

    return (
        <div style={{
            height: '50px',
            background: 'var(--header)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            color: 'var(--text)',
            borderBottom: '1px solid #444'
        }}>
            {titles[pathname] || 'App'}
        </div>
    );
}