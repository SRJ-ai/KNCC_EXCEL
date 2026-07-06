import React, { useState, useEffect, useCallback } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import {
  Activity, RefreshCw, Upload, FileText, Edit3,
  Trash2, CheckCircle2, Clock, Zap
} from 'lucide-react';

// ── Action metadata: maps action strings to icon / color / label ─────────────
const ACTION_META = {
  'Document Processed: PO':  { icon: Upload,       color: '#3B82F6', label: 'PO Uploaded' },
  'Document Processed: INV': { icon: FileText,      color: '#10B981', label: 'Invoice Uploaded' },
  'Document Processed: CO':  { icon: Edit3,         color: '#F59E0B', label: 'Change Order' },
  'Project Created':         { icon: CheckCircle2,  color: '#8B5CF6', label: 'Project Created' },
  'Project Deleted':         { icon: Trash2,        color: '#EF4444', label: 'Project Deleted' },
};

function getActionMeta(action) {
  for (const key of Object.keys(ACTION_META)) {
    if (action && action.includes(key)) {
      const m = ACTION_META[key];
      return { ...m, IconComp: m.icon };
    }
  }
  return { IconComp: Activity, color: '#71717a', label: action || 'Activity' };
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ── Feed item component ───────────────────────────────────────────────────────
function FeedItem({ act, isNew }) {
  const { IconComp, color, label } = getActionMeta(act.action);
  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '12px',
        padding: '12px 14px', borderRadius: '10px', marginBottom: '4px',
        background: isNew ? 'rgba(16,185,129,0.07)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${isNew ? 'rgba(16,185,129,0.28)' : '#1c1c1e'}`,
        transition: 'background 0.8s ease, border-color 0.8s ease',
        animation: isNew ? 'slideInRow 0.3s ease' : 'none',
      }}
    >
      {/* Icon */}
      <div style={{
        width: '30px', height: '30px', borderRadius: '8px',
        background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, flexShrink: 0, marginTop: '1px',
      }}>
        <IconComp size={14} />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e4e4e7' }}>{label}</span>
          {isNew && (
            <span style={{
              fontSize: '0.65rem', background: 'rgba(16,185,129,0.2)', color: '#10B981',
              padding: '1px 6px', borderRadius: '10px', fontWeight: 700,
            }}>NEW</span>
          )}
        </div>
        {act.detail && (
          <p style={{
            fontSize: '0.8rem', color: '#71717a', margin: '2px 0 0 0',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {act.detail}
          </p>
        )}
      </div>

      {/* Timestamp */}
      <span style={{ fontSize: '0.72rem', color: '#52525b', whiteSpace: 'nowrap', paddingTop: '3px' }}>
        {timeAgo(act.created_at)}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ActivityLog() {
  const { activeProject } = usePlatform();
  const { user } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [newIds, setNewIds]         = useState(new Set());
  const [liveCount, setLiveCount]   = useState(0);
  const [connected, setConnected]   = useState(false);

  const backendUrl = (
    import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? 'http://localhost:8000' : '')
  ).replace(/\/$/, '');

  // ── Fetch from backend ──────────────────────────────────────────────────────
  const fetchActivities = useCallback(async () => {
    if (!activeProject?.id) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${backendUrl}/api/activity/${activeProject.id}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setActivities(data);
    } catch (e) {
      console.warn('Activity fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [activeProject, backendUrl]);

  // Initial load + 30s polling fallback
  useEffect(() => {
    setLoading(true);
    setActivities([]);
    fetchActivities();
    const interval = setInterval(fetchActivities, 30000);
    return () => clearInterval(interval);
  }, [fetchActivities]);

  // ── Supabase Realtime subscription ─────────────────────────────────────────
  useEffect(() => {
    if (!activeProject?.id) return;

    const channel = supabase
      .channel(`activity-log-${activeProject.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activities', filter: `project_id=eq.${activeProject.id}` },
        (payload) => {
          const newItem = payload.new;
          setActivities(prev => [newItem, ...prev]);
          setNewIds(prev => new Set([...prev, newItem.id]));
          setLiveCount(c => c + 1);
          // Remove "NEW" badge after 3 seconds
          setTimeout(() => {
            setNewIds(prev => {
              const s = new Set(prev);
              s.delete(newItem.id);
              return s;
            });
          }, 3000);
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
      setConnected(false);
    };
  }, [activeProject?.id]);

  // ── Group by day ────────────────────────────────────────────────────────────
  const grouped = activities.reduce((acc, act) => {
    const day = act.created_at
      ? new Date(act.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
      : 'Unknown';
    if (!acc[day]) acc[day] = [];
    acc[day].push(act);
    return acc;
  }, {});

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '2rem', maxWidth: '820px', margin: '0 auto' }}>
      <style>{`
        @keyframes slideInRow {
          from { opacity: 0; transform: translateX(-10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f4f4f5', margin: 0 }}>
            Activity Feed
          </h1>
          <p style={{ color: '#71717a', margin: '4px 0 0 0', fontSize: '0.875rem' }}>
            {activeProject ? `Live feed · ${activeProject.name}` : 'Select a project to see activity'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Live indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px', background: connected ? 'rgba(16,185,129,0.12)' : 'rgba(113,113,122,0.12)', color: connected ? '#10B981' : '#71717a' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor', display: 'inline-block', animation: connected ? 'pulse-dot 2s ease infinite' : 'none' }} />
            {connected ? 'Live' : 'Offline'}
          </div>

          {liveCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', background: 'rgba(59,130,246,0.12)', color: '#3B82F6', padding: '4px 10px', borderRadius: '20px', fontWeight: 600 }}>
              <Zap size={11} />
              {liveCount} new
            </div>
          )}

          <button
            onClick={fetchActivities}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #3f3f46', borderRadius: '8px', color: '#a1a1aa', padding: '7px 13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Live bar ── */}
      <div style={{ height: '2px', background: '#1c1c1e', borderRadius: '1px', marginBottom: '1.75rem', overflow: 'hidden' }}>
        <div style={{ width: connected ? '100%' : '0%', height: '100%', background: 'linear-gradient(90deg, #10B981, #3B82F6)', transition: 'width 0.8s ease', borderRadius: '1px' }} />
      </div>

      {/* ── Empty states ── */}
      {!activeProject && (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#52525b' }}>
          <Activity size={48} style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.25 }} />
          <p style={{ margin: 0 }}>Select a project to see its activity feed.</p>
        </div>
      )}

      {loading && activeProject && (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#52525b' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 1rem', display: 'block' }} />
          <p style={{ margin: 0 }}>Loading activity...</p>
        </div>
      )}

      {!loading && activeProject && activities.length === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#52525b', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid #27272a' }}>
          <Clock size={40} style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.25 }} />
          <p style={{ margin: 0 }}>No activity yet. Upload a document to get started.</p>
        </div>
      )}

      {/* ── Grouped list ── */}
      {!loading && Object.entries(grouped).map(([day, items]) => (
        <div key={day} style={{ marginBottom: '2rem' }}>
          <div style={{
            fontSize: '0.7rem', fontWeight: 700, color: '#52525b',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            marginBottom: '0.75rem', paddingBottom: '0.5rem',
            borderBottom: '1px solid #1c1c1e',
          }}>
            {day}
          </div>
          {items.map(act => (
            <FeedItem key={act.id} act={act} isNew={newIds.has(act.id)} />
          ))}
        </div>
      ))}
    </div>
  );
}
