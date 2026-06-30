import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { useAuth } from '../context/AuthContext';
import { Plus, FolderOpen, Building2, Calendar, FileSpreadsheet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './ProjectDashboard.css';

export default function ProjectDashboard() {
  const { user } = useAuth();
  const { projects, switchProject, createProject } = usePlatform();
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({ name: '', job_number: '', tax_rate: '1.06', client: 'KNCC Development Corp' });
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createProject({
        name: formData.name,
        job_number: formData.job_number,
        tax_rate: parseFloat(formData.tax_rate),
        client: formData.client,
        status: 'In Progress',
        budget: 0
      });
      setShowCreate(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dash-container animate-fade-in">
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Welcome back, {user?.name || 'Engineer'}</h1>
          <p className="dash-subtitle">Select a project workspace to continue or create a new one.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={18} /> New Project
        </button>
      </div>

      <div className="dash-grid">
        {projects.length === 0 && (
          <div className="dash-empty glass-panel">
            <FolderOpen size={48} color="#52525b" />
            <h3>No projects found</h3>
            <p>Create your first project to start tracking materials and costs.</p>
          </div>
        )}
        
        {projects.map((proj, idx) => (
          <motion.div 
            key={proj.id}
            className="dash-card glass-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => switchProject(proj.id)}
          >
            <div className="dash-card-top">
              <div className="dash-card-icon">
                <Building2 size={24} color="#3B82F6" />
              </div>
              <span className={`dash-status ${proj.status === 'Completed' ? 'done' : 'active'}`}>
                {proj.status || 'Active'}
              </span>
            </div>
            <h2 className="dash-card-title">{proj.name}</h2>
            <p className="dash-card-client">{proj.client || 'KNCC Organization'}</p>
            
            <div className="dash-card-stats">
              <div className="stat">
                <span className="stat-val">{proj.job_number || 'N/A'}</span>
                <span className="stat-label">Job Number</span>
              </div>
              <div className="stat">
                <span className="stat-val">{((proj.tax_rate || 1) - 1) > 0 ? `${((proj.tax_rate - 1)*100).toFixed(2)}%` : 'No Tax'}</span>
                <span className="stat-label">Tax Rate</span>
              </div>
            </div>

            <div className="dash-card-footer">
              <Calendar size={14} />
              <span>Created {new Date(proj.created_at).toLocaleDateString()}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <div className="dash-modal-overlay">
            <motion.div 
              className="dash-modal glass-panel"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <h2>Create New Project</h2>
              <p>Initialize a new workspace with a blank Master Excel grid.</p>
              
              <form onSubmit={handleCreate}>
                <div className="form-group">
                  <label>Project Name</label>
                  <input 
                    type="text" 
                    required 
                    className="input-base"
                    placeholder="e.g. Willow Way Phase 2" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Job Number (Optional)</label>
                  <input 
                    type="text" 
                    className="input-base"
                    placeholder="e.g. JB-2026-04" 
                    value={formData.job_number}
                    onChange={e => setFormData({...formData, job_number: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Tax Multiplier</label>
                  <input 
                    type="number" 
                    step="0.001"
                    required 
                    className="input-base"
                    placeholder="e.g. 1.06 (for 6%)" 
                    value={formData.tax_rate}
                    onChange={e => setFormData({...formData, tax_rate: e.target.value})}
                  />
                </div>
                
                <div className="dash-modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Creating...' : 'Create Workspace'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
