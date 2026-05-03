// src/App.tsx
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useWorkspaceStore } from './store/Workspace.store';

import MainLayout from './renderer/layouts/MainLayout';
import Workspace from './renderer/pages/Workspace';
import Stories from './renderer/pages/Stories';
import Releases from './renderer/pages/Releases';
import Settings from './renderer/pages/Settings';

function App() {
    const loadWorkspaces = useWorkspaceStore(s => s.loadWorkspaces);

    // On startup, fetch workspaces from Electron.
    // loadWorkspaces() will automatically call loadIssues() if there is an active workspace.
    useEffect(() => {
        loadWorkspaces();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <BrowserRouter>
            <Routes>
                <Route element={<MainLayout />}>
                    <Route path="/" element={<Workspace />} />
                    <Route path="/stories" element={<Stories />} />
                    <Route path="/releases" element={<Releases />} />
                    <Route path="/settings" element={<Settings />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;