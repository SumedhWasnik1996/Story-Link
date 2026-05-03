import { useEffect, useState, useCallback } from 'react';

export function JiraConnection() {
    const [connected, setConnected] = useState<boolean | null>(null);
    const [loading, setLoading]     = useState(false);
    const [error, setError]         = useState<string | null>(null);

    useEffect(() => {
        window.jira.isConnected().then(setConnected);
    }, []);

    const handleConnect = useCallback(async () => {
        setLoading(true);
        setError(null);

        const result = await window.jira.connect();
        setLoading(false);

        if (result.success) {
            setConnected(true);
        } else {
            setError(result.error || 'Connection failed');
        }
    }, []);

    return {
        connected,
        loading,
        error,
        handleConnect,
    };
}
