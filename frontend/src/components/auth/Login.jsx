import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { MessageSquare, Lock, AtSign } from 'lucide-react';

export default function Login({ switchToRegister }) {
  const { login } = useContext(AuthContext);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed.');

      login(data);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)' }}>
      <form onSubmit={handleSubmit} style={{ background: 'var(--bg-sidebar)', padding: '2.5rem', borderRadius: '16px', border: '1px solid var(--border)', width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ background: 'var(--accent)', width: '56px', height: '56px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
            <MessageSquare size={30} color="#fff" />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Welcome to PulseChat</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>Login with Email or Unique @Username</p>
        </div>

        {error && <div style={{ background: '#ef444422', border: '1px solid #ef4444', color: '#f87171', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}

        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Email or @Username</label>
          <div style={{ position: 'relative' }}>
            <AtSign size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)} required placeholder="alex_dev or alex@mail.com" style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-main)' }} />
          </div>
        </div>

        <div style={{ marginBottom: '1.75rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Password</label>
          <div style={{ position: 'relative' }}>
            <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-main)' }} />
          </div>
        </div>

        <button type="submit" style={{ width: '100%', padding: '0.85rem', borderRadius: '8px', background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: '1rem' }}>Log In</button>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Don't have an account? <span onClick={switchToRegister} style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>Create Account</span>
        </p>
      </form>
    </div>
  );
}
