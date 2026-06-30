import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { usePlatform } from '../context/PlatformContext';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Table, UploadCloud, FileText,
  Clock, TrendingUp, CheckCircle, FileCheck, Download, Activity
} from 'lucide-react';
import logo from '../assets/logo.png';

const NAV_ITEMS = [
  { to: '/dashboard',      icon: <LayoutDashboard size={18} />, label: 'Workspace' },
  { to: '/grid',           icon: <Table size={18} />,           label: 'Material Grid' },
  { to: '/upload',         icon: <UploadCloud size={18} />,     label: 'Upload Center' },
  { to: '/documents',      icon: <FileText size={18} />,        label: 'Documents' },
  { to: '/timeline',       icon: <Clock size={18} />,           label: 'CO Timeline' },
  { to: '/progress',       icon: <TrendingUp size={18} />,      label: 'Delivery Progress' },
  { to: '/reconciliation', icon: <CheckCircle size={18} />,     label: 'Reconciliation' },
  { to: '/vpos',           icon: <FileCheck size={18} />,       label: 'VPO Management' },
  { to: '/export',         icon: <Download size={18} />,        label: 'Excel Export' },
  { to: '/activity',       icon: <Activity size={18} />,        label: 'Activity Log' },
];

const sidebarStyle = {
  width: '240px',
  minWidth: '240px',
  display: 'flex',
  flexDirection: 'column',
  padding: '24px 16px',
  borderRight: '1px solid #111',
  flexShrink: 0,
  background: '#000',
  zIndex: 100,
  height: '100vh',
  position: 'fixed',
  top: 0,
  left: 0,
  overflowY: 'auto',
};

const navStyle = ({ isActive }) => ({
  padding: '11px 14px',
  textDecoration: 'none',
  color: isActive ? '#fff' : '#555',
  backgroundColor: isActive ? '#111' : 'transparent',
  borderRadius: '10px',
  border: '1px solid',
  borderColor: isActive ? '#222' : 'transparent',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  fontSize: '14px',
  fontFamily: 'Inter',
  fontWeight: isActive ? 600 : 400,
  transition: 'all 0.15s ease',
  letterSpacing: '-0.01em',
});

const containerVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { staggerChildren: 0.05, delayChildren: 0.2 } }
};

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0 }
};

const Sidebar = () => {
  const navigate = useNavigate();
  const { clearActiveProject } = usePlatform();
  
  const handleExitProject = () => {
    clearActiveProject();
    navigate('/');
  };

  return (
  <div style={sidebarStyle}>
    {/* Logo */}
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }} 
      animate={{ opacity: 1, scale: 1 }} 
      transition={{ duration: 0.5 }}
      style={{ marginBottom: '32px', paddingLeft: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}
    >
      <img src={logo} alt="KNCC Logo" style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'contain' }} />
      <div>
        <div style={{ fontSize: '17px', fontWeight: 800, color: '#fff', fontFamily: 'Outfit', letterSpacing: '0.06em', lineHeight: 1 }}>KNCC</div>
        <div style={{ fontSize: '9px', color: '#3B82F6', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 700, marginTop: '3px' }}>Enterprise</div>
      </div>
    </motion.div>

    {/* Nav */}
    <motion.nav 
      variants={containerVariants} 
      initial="hidden" 
      animate="visible" 
      style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}
    >
      {NAV_ITEMS.map(item => (
        <motion.div key={item.to} variants={itemVariants}>
          <NavLink to={item.to} style={navStyle}
            onMouseEnter={e => { if (!e.currentTarget.style.backgroundColor || e.currentTarget.style.backgroundColor === 'transparent') { e.currentTarget.style.background = '#0a0a0a'; e.currentTarget.style.color = '#ccc'; }}}
            onMouseLeave={e => { if (e.currentTarget.style.background === '#0a0a0a') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#555'; }}}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'inherit' }}>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </NavLink>
        </motion.div>
      ))}
    </motion.nav>

    {/* Footer */}
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} style={{ paddingTop: '16px', borderTop: '1px solid #111', textAlign: 'center' }}>
      <button 
        onClick={handleExitProject}
        style={{
          background: 'rgba(255,255,255,0.05)',
          color: '#ccc',
          border: '1px solid #222',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '12px',
          cursor: 'pointer',
          width: '100%',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#222'; e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#ccc'; }}
      >
        <LayoutDashboard size={14} /> Switch Project
      </button>
      <div style={{ fontSize: '10px', color: '#222', textTransform: 'uppercase', letterSpacing: '1px' }}>
        A Quantum Pixel Product
      </div>
    </motion.div>
  </div>
  );
};

export default Sidebar;
