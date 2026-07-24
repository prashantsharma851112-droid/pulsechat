import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { MessageSquare, Check, X } from 'lucide-react';

export default function Register({ switchToLogin }) {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAvailable, setIsAvailable] = useState(null);
  const [error, setError] = useState('');

  // Live Username Check
  useEffect(() => {
    if (username.length >= 3) {
      const timer = setTimeout(() => {
        fetch(`/api/auth/check-username/${username}`)
          .then(res => res.json())
          .then(data => setIsAvailable(data.available));
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setIsAvailable(null);
    }
  }, [username]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, displayName, username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed.');

      login(data);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)' }}>
      <form onSubmit={handleSubmit} style={{ background: 'var(--bg-sidebar)', padding: '2.5rem', borderRadius: '16px', border: '1px solid var(--border)', width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700 }}>Join PulseChat</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No Phone Number Required! Choose your @username</p>
        </div>

        {error && <div style={{ background: '#ef444422', border: '1px solid #ef4444', color: '#f87171', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Display Name</label>
          <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} required placeholder="Alex Rivers" style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-main)' }} />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Unique @username</label>
          <div style={{ position: 'relative' }}>
            <input type="text" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} required placeholder="alex_dev" style={{ width: '100%', padding: '0.7rem 2.2rem 0.7rem 0.7rem', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-main)' }} />
            {isAvailable === true && <Check size={18} color="#10b981" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />}
            {isAvailable === false && <X size={18} color="#ef4444" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />}
          </div>
          {isAvailable === false && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.2rem' }}>Username already taken!</p>}
          {isAvailable === true && <p style={{ color: '#10b981', fontSize: '0.75rem', marginTop: '0.2rem' }}>Username is available!</p>}
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Email Address</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="alex@example.com" style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-main)' }} />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-main)' }} />
        </div>

        <button type="submit" style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'var(--accent)', color: '#fff', fontWeight: 600 }}>Create Account</button>

        <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Already registered? <span onClick={switchToLogin} style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>Sign In</span>
        </p>
      </form>
    </div>
  );
}
