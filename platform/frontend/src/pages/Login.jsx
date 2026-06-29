import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';
import './Auth.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isTestLoading, setIsTestLoading] = useState(false);
  
  const { login, resetPassword, setupTestAccount } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    if (isForgotPassword) {
      try {
        await resetPassword(email);
        setMessage('Password reset link sent to your email.');
      } catch (err) {
        setError('Failed to send reset link.');
      }
      return;
    }

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError('Invalid credentials. Please try again.');
    }
  };

  const handleTestLogin = async (type) => {
    setIsTestLoading(true);
    setError('');
    try {
      if (type === 'admin') {
        await setupTestAccount('admin@kncc.com', 'Password123!', 'admin', 'Admin User');
      } else {
        await setupTestAccount('engineer@kncc.com', 'Password123!', 'member', 'Site Engineer');
      }
      navigate('/dashboard');
    } catch (err) {
      setError(`Failed to login: ${err.message || JSON.stringify(err)}`);
    }
    setIsTestLoading(false);
  };  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <img src={logo} alt="KNCC Logo" style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'contain' }} />
            <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.75rem', letterSpacing: '0.05em', color: '#fff' }}>KNCC EXCEL</span>
          </div>
          <p className="auth-subtitle">Sign in to your organization</p>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {message && <div style={{ color: '#10B981', background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', textAlign: 'center', fontSize: '0.875rem' }}>{message}</div>}
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Email address</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
              placeholder="engineer@kncc.com"
            />
          </div>
          
          {!isForgotPassword && (
            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                Password
                <span 
                  onClick={() => setIsForgotPassword(true)} 
                  style={{ color: '#3B82F6', fontSize: '0.75rem', cursor: 'pointer' }}
                >
                  Forgot Password?
                </span>
              </label>
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                placeholder="••••••••"
              />
            </div>
          )}
          
          <button type="submit" className="auth-button">
            {isForgotPassword ? 'Send Reset Link' : 'Sign In'}
          </button>
        </form>

        {isForgotPassword && (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <span onClick={() => setIsForgotPassword(false)} style={{ color: '#a1a1aa', fontSize: '0.875rem', cursor: 'pointer' }}>
              &larr; Back to Login
            </span>
          </div>
        )}

        {!isForgotPassword && (
          <>
            <div style={{ margin: '1.5rem 0', display: 'flex', alignItems: 'center', color: '#52525b', fontSize: '0.875rem' }}>
              <div style={{ flex: 1, height: '1px', background: '#3f3f46' }}></div>
              <span style={{ padding: '0 1rem' }}>or use a test account</span>
              <div style={{ flex: 1, height: '1px', background: '#3f3f46' }}></div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                onClick={() => handleTestLogin('admin')}
                disabled={isTestLoading}
                style={{ flex: 1, padding: '0.5rem', background: '#27272a', border: '1px solid #3f3f46', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                Login as Admin
              </button>
              <button 
                onClick={() => handleTestLogin('engineer')}
                disabled={isTestLoading}
                style={{ flex: 1, padding: '0.5rem', background: '#27272a', border: '1px solid #3f3f46', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                Login as Engineer
              </button>
            </div>
          </>
        )}
        <div className="auth-footer">
          Don't have an account? <Link to="/register">Request access</Link>
        </div>
      </div>
    </div>
  );
}
