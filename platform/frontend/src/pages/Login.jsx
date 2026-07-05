import React, { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';
import './Auth.css';

// -------------------------------------------------------------------------- //
// Client-side validation helpers (UX only — server always re-validates)       //
// -------------------------------------------------------------------------- //
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 72;

function sanitizeInput(val) {
  // Strip HTML tags and trim whitespace — client-side XSS mitigation
  return val.replace(/<[^>]*>/g, '').trim();
}

function validateLoginForm(email, password) {
  if (!email || email.length > MAX_EMAIL_LENGTH) return 'Please enter a valid email address.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address.';
  if (!password || password.length < 1) return 'Please enter your password.';
  if (password.length > MAX_PASSWORD_LENGTH) return 'Invalid input.';
  return null;
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  // Rule 4: Always show a GENERIC error — never "email not found" or "wrong password"
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const { login, resetPassword, setupTestAccount } = useAuth();
  const navigate = useNavigate();

  const handleEmailChange = (e) => setEmail(sanitizeInput(e.target.value));
  const handlePasswordChange = (e) => setPassword(e.target.value.slice(0, MAX_PASSWORD_LENGTH));

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (isForgotPassword) {
      const sanitized = sanitizeInput(email);
      if (!sanitized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitized)) {
        setError('Please enter a valid email address.');
        return;
      }
      setIsLoading(true);
      try {
        await resetPassword(sanitized);
        // Rule 4: Generic message regardless of whether the email exists
        setMessage("If that email is registered, you'll receive a password reset link.");
      } catch {
        // Rule 4: Even on error, show the same generic message
        setMessage("If that email is registered, you'll receive a password reset link.");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Rule 1: Client-side validation (UX gate — server validates too)
    const validationError = validateLoginForm(email, password);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    try {
      await login(email.toLowerCase().trim(), password);
      navigate('/dashboard');
    } catch {
      // Rule 4: Generic message — never reveal if it was a missing email or wrong password
      setError('Incorrect email or password.');
    } finally {
      setIsLoading(false);
    }
  }, [email, password, isForgotPassword, login, resetPassword, navigate]);



  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <img src={logo} alt="KNCC Logo" style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'contain' }} />
            <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.75rem', letterSpacing: '0.05em', color: '#fff' }}>KNCC EXCEL</span>
          </div>
          <p className="auth-subtitle">
            {isForgotPassword ? 'Reset your password' : 'Sign in to your organization'}
          </p>
        </div>

        {error && <div className="auth-error" role="alert">{error}</div>}
        {message && (
          <div
            role="status"
            style={{ color: '#10B981', background: 'rgba(16,185,129,0.1)', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', textAlign: 'center', fontSize: '0.875rem' }}
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="email-input">Email address</label>
            <input
              id="email-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={handleEmailChange}
              maxLength={MAX_EMAIL_LENGTH}
              required
              placeholder="you@kncc.com"
            />
          </div>

          {!isForgotPassword && (
            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Password</span>
                <span
                  id="forgot-password-link"
                  onClick={() => { setIsForgotPassword(true); setError(''); setMessage(''); }}
                  style={{ color: '#3B82F6', fontSize: '0.75rem', cursor: 'pointer' }}
                >
                  Forgot Password?
                </span>
              </label>
              <input
                id="password-input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={handlePasswordChange}
                maxLength={MAX_PASSWORD_LENGTH}
                required
                placeholder="••••••••"
              />
            </div>
          )}

          <button
            id="auth-submit-btn"
            type="submit"
            className="auth-button"
            disabled={isLoading}
          >
            {isLoading
              ? (isForgotPassword ? 'Sending…' : 'Signing in…')
              : (isForgotPassword ? 'Send Reset Link' : 'Sign In')}
          </button>
        </form>

        {isForgotPassword && (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <span
              id="back-to-login-link"
              onClick={() => { setIsForgotPassword(false); setError(''); setMessage(''); }}
              style={{ color: '#a1a1aa', fontSize: '0.875rem', cursor: 'pointer' }}
            >
              ← Back to Login
            </span>
          </div>
        )}

        )}

        <div className="auth-footer">
          Don't have an account? <Link to="/register" id="register-link">Request access</Link>
        </div>
      </div>
    </div>
  );
}
