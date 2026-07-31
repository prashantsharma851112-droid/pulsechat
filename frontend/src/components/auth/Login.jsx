import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { Zap, Lock, AtSign } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : window.location.origin);

export default function Login({ switchToRegister }) {
  const { login } = useContext(AuthContext);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed.');

      login(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', padding: '1rem' }}>
      <form onSubmit={handleSubmit} className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ background: 'var(--accent)', width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto', boxShadow: '0 8px 20px rgba(99, 102, 241, 0.3)' }}>
            <Zap size={30} color="#fff" />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.4rem 0' }}>Welcome to PulseChat</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Login with Email or Unique @Username</p>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div style={{ marginBottom: '1.25rem' }}>
          <label className="form-label">Email or @Username</label>
          <div style={{ position: 'relative' }}>
            <AtSign size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              required
              placeholder="alex_dev or alex@mail.com"
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '1.75rem' }}>
          <label className="form-label">Password</label>
          <div style={{ position: 'relative' }}>
            <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
        </div>

        <button type="submit" className="btn-primary" style={{ width: '100%', padding: '0.85rem' }} disabled={loading}>
          {loading ? 'Logging in...' : 'Sign In'}
        </button>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Don't have an account? <span onClick={switchToRegister} style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>Create Account</span>
        </p>
      </form>
    </div>
  );
}
