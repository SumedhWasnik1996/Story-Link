// src/renderer/hooks/JiraConnection.ts
import { useEffect, useState, useCallback } from 'react';

export function JiraConnection() {
    const [connected, setConnected] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fixed: was window.jira.isConnected() which didn't exist.
    // Now uses the dedicated isConnected IPC call added to preload + ipchandlers.
    useEffect(() => {
        window.jira.isConnected().then(res => {
            setConnected(res.success ? (res.data ?? false) : false);
        });
    }, []);

    const handleConnect = useCallback(async () => {
        setLoading(true);
        setError(null);

        const result = await window.jira.connect();
        setLoading(false);

        if (result.success) {
            setConnected(true);
        } else {
            setError(result.error ?? 'Connection failed');
        }
    }, []);

    return { connected, loading, error, handleConnect };
}