// src/shared/layouts/MainLayout.tsx
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function MainLayout() {
    return (
        <div style={{
            display: 'flex',
            height: '100vh' // IMPORTANT
        }}>
            <Sidebar />

            <div style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1
            }}>
                <Header />

                <div style={{
                    flex: 1,
                    padding: '16px',
                    overflow: 'auto'
                }}>
                    <Outlet />
                </div>

                <Footer />
            </div>
        </div>
    );
}