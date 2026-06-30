import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PlatformProvider, usePlatform } from './context/PlatformContext';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import LandingPage from './pages/LandingPage';
import ProductPage from './pages/ProductPage';
import ProjectOnboarding from './pages/ProjectOnboarding';
import ProjectDashboard from './pages/ProjectDashboard';
import Dashboard from './pages/Dashboard';
import MaterialGrid from './pages/MaterialGrid';
import UploadCenter from './pages/UploadCenter';
import DocumentViewer from './pages/DocumentViewer';
import COTimeline from './pages/COTimeline';
import DeliveryProgress from './pages/DeliveryProgress';
import Reconciliation from './pages/Reconciliation';
import VPOManagement from './pages/VPOManagement';
import ExcelExport from './pages/ExcelExport';
import ActivityLog from './pages/ActivityLog';
import Login from './pages/Login';
import Register from './pages/Register';

function ProtectedLayout() {
  const { user, loading: authLoading } = useAuth();
  const { activeProject, loading: platformLoading } = usePlatform();
  
  if (authLoading || platformLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#555', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ width: 36, height: 36, border: '2px solid #111', borderTop: '2px solid #3B82F6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <span style={{ fontSize: '13px', letterSpacing: '0.05em' }}>Loading workspace...</span>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  // If no project is active, they can only access the root (ProjectDashboard) or onboarding
  if (!activeProject && window.location.pathname !== '/' && window.location.pathname !== '/onboarding') {
    return <Navigate to="/" replace />;
  }

  return (
    <div style={{ display: 'flex', width: '100%', height: '100vh', background: '#000', overflow: 'hidden' }}>
      {activeProject && <Sidebar />}
      <div style={{
        flex: 1,
        marginLeft: activeProject ? '240px' : '0',
        display: 'flex',
        flexDirection: 'column',
        background: '#000',
        overflow: 'hidden',
      }}>
        {activeProject && <TopBar />}
        <div style={{
          flex: 1,
          marginTop: activeProject ? '60px' : '0',
          overflowY: 'auto',
          background: '#000',
        }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <>
      <Routes>
        {/* Public Routes */}
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/product" element={<ProductPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected Routes */}
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<ProjectDashboard />} />
          <Route path="/onboarding" element={<ProjectOnboarding />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/grid" element={<MaterialGrid />} />
          <Route path="/upload" element={<UploadCenter />} />
          <Route path="/documents" element={<DocumentViewer />} />
          <Route path="/timeline" element={<COTimeline />} />
          <Route path="/progress" element={<DeliveryProgress />} />
          <Route path="/reconciliation" element={<Reconciliation />} />
          <Route path="/vpos" element={<VPOManagement />} />
          <Route path="/export" element={<ExcelExport />} />
          <Route path="/activity" element={<ActivityLog />} />
        </Route>
      </Routes>
      <Analytics />
      <SpeedInsights />
    </>
  );
}

export default App;
