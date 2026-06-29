import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Table, UploadCloud, FileText, Clock, TrendingUp, CheckCircle, FileCheck, Download, Activity } from 'lucide-react';
import logo from '../assets/logo.png';

const NAV_ITEMS = [
  { to: '/',               icon: <LayoutDashboard size={18} />, label: 'Workspace' },
  { to: '/grid',           icon: <Table size={18} />, label: 'Material Grid' },
  { to: '/upload',         icon: <UploadCloud size={18} />, label: 'Upload Center' },
  { to: '/documents',      icon: <FileText size={18} />, label: 'Documents' },
  { to: '/timeline',       icon: <Clock size={18} />, label: 'CO Timeline' },
  { to: '/progress',       icon: <TrendingUp size={18} />, label: 'Delivery Progress' },
  { to: '/reconciliation', icon: <CheckCircle size={18} />, label: 'Reconciliation' },
  { to: '/vpos',           icon: <FileCheck size={18} />, label: 'VPO Management' },
  { to: '/export',         icon: <Download size={18} />, label: 'Excel Export' },
  { to: '/activity',       icon: <Activity size={18} />, label: 'Activity Log' },
];

const Sidebar = () => {
  return (
    <div
      className="glass-panel"
      style={{
        width: '260px',
        display: 'flex',
        flexDirection: 'column',
        padding: '32px 20px',
        borderRight: '1px solid var(--glass-border)',
        flexShrink: 0,
        background: 'rgba(5, 5, 5, 0.4)',
        zIndex: 100,
        boxShadow: '4px 0 24px rgba(0,0,0,0.5)',
        borderTop: 'none',
        borderBottom: 'none',
        borderLeft: 'none',
        borderRadius: 0
      }}
    >
      {/* Logo */}
      <div style={{ marginBottom: '40px', paddingLeft: '8px', display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative' }}>
        <div style={{ position: 'absolute', width: '40px', height: '40px', background: 'var(--accent-purple)', filter: 'blur(20px)', opacity: 0.5, zIndex: 0 }}></div>
        <img src={logo} alt="KNCC Logo" style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'contain', zIndex: 1, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }} />
        <div style={{ zIndex: 1 }}>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff', fontFamily: 'Outfit', letterSpacing: '0.08em', textShadow: '0 0 10px rgba(255,255,255,0.3)' }}>
            KNCC
          </div>
          <div style={{ fontSize: '10px', color: 'var(--accent-cyan)', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 700, marginTop: '2px' }}>
            Enterprise
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', flex: 1 }}>
        {NAV_ITEMS.map(item => (
          <NavLink key={item.to} to={item.to === '/' ? '/dashboard' : item.to} style={navStyle}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'inherit' }}>{item.icon}</span>
            <span style={{ fontSize: '14px', fontFamily: 'Inter', fontWeight: 500 }}>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Quantum Pixel Footer */}
      <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          A Quantum Pixel Product
        </div>
      </div>
    </div>
  );
};

const navStyle = ({ isActive }) => ({
  padding: '14px 18px',
  textDecoration: 'none',
  color: isActive ? '#fff' : 'var(--text-secondary)',
  backgroundColor: isActive ? 'rgba(147, 51, 234, 0.15)' : 'transparent',
  borderRadius: '14px',
  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
  border: '1px solid',
  borderColor: isActive ? 'rgba(147, 51, 234, 0.4)' : 'transparent',
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
  boxShadow: isActive ? '0 4px 20px rgba(147, 51, 234, 0.2), inset 0 0 10px rgba(147, 51, 234, 0.1)' : 'none',
  transform: isActive ? 'scale(1.02)' : 'scale(1)',
});

export default Sidebar;
