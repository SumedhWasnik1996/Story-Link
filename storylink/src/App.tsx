// src/App.tsx
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useWorkspaceStore } from './store/Workspace.store';

import MainLayout from './renderer/layouts/MainLayout';
import Workspace from './renderer/pages/Workspace';
import Stories from './renderer/pages/Stories';
import Workspaces from './renderer/pages/Workspace';
import Releases from './renderer/pages/Releases';
import Settings from './renderer/pages/Settings';

function App() {
    const { activeWorkspaceId, loadIssues } = useWorkspaceStore();

    // On startup: if a workspace was rehydrated from localStorage, load its issues.
    // setActiveWorkspace (called in onRehydrateStorage) already told the main
    // process which workspace is active — here we just trigger the data fetch.
    useEffect(() => {
        if (activeWorkspaceId) loadIssues();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <BrowserRouter>
            <Routes>
                <Route element={<MainLayout />}>
                    <Route path="/" element={<Workspace />} />
                    <Route path="/stories" element={<Stories />} />
                    <Route path="/workspaces" element={<Workspaces />} />
                    <Route path="/releases" element={<Releases />} />
                    <Route path="/settings" element={<Settings />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;