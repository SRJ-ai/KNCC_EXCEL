import React from 'react';
import { usePlatform } from '../context/PlatformContext';
import { useAuth } from '../context/AuthContext';
import { Bell, Search, Settings, LogOut, User } from 'lucide-react';

const TopBar = () => {
  const { projects, activeProject, isDemoMode, switchProject } = usePlatform();
  const { user, logout } = useAuth();

  return (
    <div style={{
      height: '60px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      borderBottom: '1px solid #111',
      flexShrink: 0,
      background: '#000',
      position: 'fixed',
      top: 0,
      left: '240px',
      right: 0,
      zIndex: 90,
    }}>
      {/* Left — Project */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: '#0a0a0a', padding: '5px 12px',
          borderRadius: '8px', border: '1px solid #1a1a1a'
        }}>
          <span style={{ color: '#333', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
            Project
          </span>
          {projects && projects.length > 1 ? (
            <select
              value={activeProject?.id || ''}
              onChange={e => switchProject(e.target.value)}
              style={{
                background: 'transparent', color: '#e4e4e7', border: 'none',
                outline: 'none', fontWeight: 600, fontSize: '13px',
                cursor: 'pointer', fontFamily: 'Inter', appearance: 'none',
                paddingRight: '10px'
              }}
            >
              {projects.map(p => (
                <option key={p.id} value={p.id} style={{ background: '#0a0a0a', color: '#e4e4e7' }}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : (
            <span style={{ color: '#e4e4e7', fontWeight: 600, fontSize: '13px' }}>
              {activeProject?.name || 'No Project'}
            </span>
          )}
          {isDemoMode && (
            <span style={{
              background: 'rgba(245,158,11,0.1)', color: '#F59E0B',
              borderRadius: '6px', padding: '1px 6px',
              fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em'
            }}>DEMO</span>
          )}
        </div>
        {activeProject?.status && (
          <span style={{
            fontSize: '11px',
            background: activeProject.status === 'In Progress' ? 'rgba(16,185,129,0.1)' : 'rgba(100,100,100,0.1)',
            padding: '3px 10px', borderRadius: '20px',
            color: activeProject.status === 'In Progress' ? '#10B981' : '#666'
          }}>
            {activeProject.status}
          </span>
        )}
      </div>

      {/* Right — Search + Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          background: '#0a0a0a', padding: '7px 14px',
          borderRadius: '8px', border: '1px solid #1a1a1a', gap: '8px'
        }}>
          <Search size={14} style={{ color: '#333' }} />
          <input
            type="text"
            placeholder="Search workspace..."
            style={{
              background: 'transparent', border: 'none', color: '#aaa',
              outline: 'none', fontSize: '13px', width: '180px'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '14px', color: '#333', cursor: 'pointer', alignItems: 'center' }}>
          <Bell size={18} style={{ transition: 'color 0.15s' }}
            onMouseOver={e => e.currentTarget.style.color = '#fff'}
            onMouseOut={e => e.currentTarget.style.color = '#333'}
          />
          <Settings size={18} style={{ transition: 'color 0.15s' }}
            onMouseOver={e => e.currentTarget.style.color = '#fff'}
            onMouseOut={e => e.currentTarget.style.color = '#333'}
          />
        </div>

        {/* User + Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#0a0a0a', padding: '5px 10px',
            borderRadius: '8px', border: '1px solid #1a1a1a'
          }}>
            <User size={14} style={{ color: '#555' }} />
            <span style={{ fontSize: '12px', color: '#aaa', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name || user?.email || 'User'}
            </span>
          </div>
          <button
            onClick={logout}
            title="Logout"
            style={{
              background: '#0a0a0a', border: '1px solid #1a1a1a',
              borderRadius: '8px', padding: '7px 10px',
              color: '#555', cursor: 'pointer', display: 'flex',
              alignItems: 'center', transition: 'all 0.15s ease'
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = '#EF4444'; e.currentTarget.style.color = '#EF4444'; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = '#1a1a1a'; e.currentTarget.style.color = '#555'; }}
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopBar;
