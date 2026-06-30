import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { motion } from 'framer-motion';
import './COTimeline.css';

export default function COTimeline() {
  const { cos, addCO } = usePlatform();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    cost: '',
    desc: ''
  });

  const displayCOs = cos.length > 0 ? cos : [
    { id: 'CO-005', title: 'Additional Foundation Reinforcement', date: 'Oct 24, 2026', status: 'pending', cost: '+$14,500', desc: 'Requested by structural engineer due to unforeseen soil conditions on the north elevation.' },
    { id: 'CO-004', title: 'Lighting Fixture Upgrade', date: 'Oct 20, 2026', status: 'approved', cost: '+$8,200', desc: 'Client requested upgrade to premium LED fixtures in main lobby.' },
    { id: 'CO-003', title: 'Omit Window Blinds', date: 'Oct 15, 2026', status: 'approved', cost: '-$3,400', desc: 'Client will handle window treatments directly post-occupancy.' },
    { id: 'CO-002', title: 'HVAC Duct Re-routing', date: 'Oct 10, 2026', status: 'rejected', cost: '+$12,000', desc: 'Proposed alternative route due to clash with plumbing. Rejected in favor of plumbing adjustment.' },
    { id: 'CO-001', title: 'Initial Site Clearing Expansion', date: 'Sep 05, 2026', status: 'approved', cost: '+$5,000', desc: 'Expanded clearing area by 50ft to accommodate laydown yard.' },
  ];

  const getStatusStyle = (status) => {
    switch (status) {
      case 'pending': return { dot: 'pending', badge: 'status-pending', cost: 'positive' };
      case 'approved': return { dot: 'approved', badge: 'status-approved', cost: cost => String(cost).startsWith('-') ? 'negative' : 'positive' };
      case 'rejected': return { dot: 'rejected', badge: 'status-rejected', cost: 'neutral' };
      default: return { dot: 'draft', badge: 'status-draft', cost: 'neutral' };
    }
  };

  const handleCreate = (e) => {
    e.preventDefault();
    const newCoId = `CO-00${displayCOs.length + 1}`;
    addCO({
      id: newCoId,
      title: formData.title,
      cost: formData.cost,
      desc: formData.desc,
      status: 'pending',
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    });
    setShowModal(false);
    setFormData({ title: '', cost: '', desc: '' });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -30 },
    visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 200, damping: 20 } }
  };

  return (
    <div className="timeline-container">
      <motion.div 
        className="timeline-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div>
          <h1 className="timeline-title">Change Order Timeline</h1>
          <p style={{ color: '#a1a1aa', margin: '0.25rem 0 0 0' }}>Track all project modifications and their financial impact.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          style={{ padding: '0.75rem 1.5rem', background: '#3B82F6', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
        >
          <Plus size={18} /> Create CO
        </button>
      </motion.div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ background: '#18181b', padding: '2rem', borderRadius: '12px', width: '500px', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Create Change Order</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1a1aa' }}>Title</label>
                <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1a1aa' }}>Cost Impact (e.g. +$5,000)</label>
                <input required type="text" value={formData.cost} onChange={e => setFormData({...formData, cost: e.target.value})} style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px' }} />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1a1aa' }}>Description</label>
                <textarea required value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', minHeight: '100px' }}></textarea>
              </div>
              <button type="submit" style={{ width: '100%', padding: '1rem', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>Submit CO</button>
            </form>
          </motion.div>
        </div>
      )}

      <motion.div 
        className="timeline-wrapper"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {displayCOs.map(co => {
          const styles = getStatusStyle(co.status);
          const costColorClass = typeof styles.cost === 'function' ? styles.cost(co.cost) : styles.cost;
          
          return (
            <motion.div key={co.id} className="timeline-item" variants={itemVariants}>
              <div className={`timeline-dot ${styles.dot}`}></div>
              <div className="timeline-content">
                <div className="co-header">
                  <div>
                    <h3 className="co-id">{co.id}</h3>
                    <h4 className="co-title">{co.title}</h4>
                  </div>
                  <span className="co-date">{co.date}</span>
                </div>
                <p className="co-body">{co.desc}</p>
                <div className="co-footer">
                  <span className={`co-status ${styles.badge}`}>{co.status}</span>
                  <span className={`co-cost ${costColorClass}`}>{typeof co.amount !== 'undefined' ? `$${Number(co.amount).toLocaleString()}` : co.cost}</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
