import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Workspace from './renderer/pages/Workspace';
import Settings from './renderer/pages/Settings';
import Releases from './renderer/pages/Releases';
import MainLayout from './renderer/layouts/MainLayout';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<MainLayout />}>
                    <Route path="/" element={<Workspace />} />
                    <Route path="/releases" element={<Releases />} />
                    <Route path="/settings" element={<Settings />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;