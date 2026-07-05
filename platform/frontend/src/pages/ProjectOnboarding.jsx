import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlatform } from '../context/PlatformContext';
import { useAuth } from '../context/AuthContext';
import { LogOut } from 'lucide-react';
import './ProjectOnboarding.css';

export default function ProjectOnboarding() {
  const navigate = useNavigate();
  const { createProject } = usePlatform();
  const { logout } = useAuth();
  
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    budget: '',
    client: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await createProject(formData);
      navigate('/dashboard'); // Go to dashboard immediately after creation
    } catch (err) {
      setError(err.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-card" style={{ position: 'relative' }}>
        <button 
          onClick={logout} 
          style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
        >
          <LogOut size={14} /> Logout
        </button>
        <h1 className="onboarding-title">Create New Project</h1>
        <p className="onboarding-subtitle">Set up your construction project to begin tracking materials, purchase orders, and documents.</p>
        
        {error && <div style={{ color: 'red', marginBottom: '1rem', padding: '0.5rem', background: '#ffebee', borderRadius: '4px' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Project Name</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Downtown Highrise Phase 2" 
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Location / Site Name</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. 123 Main St, Zone A" 
              required
              value={formData.location}
              onChange={(e) => setFormData({...formData, location: e.target.value})}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Client / Owner Name</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Acme Development Corp" 
              required
              value={formData.client}
              onChange={(e) => setFormData({...formData, client: e.target.value})}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Estimated Budget (USD)</label>
            <input 
              type="number" 
              className="form-input" 
              placeholder="e.g. 5000000" 
              required
              value={formData.budget}
              onChange={(e) => setFormData({...formData, budget: e.target.value})}
            />
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Creating...' : 'Initialize Project Workspace'}
          </button>
        </form>
      </div>
    </div>
  );
}
