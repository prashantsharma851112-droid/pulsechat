import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { X } from 'lucide-react';

const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=alex',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=rahul',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=sara',
  'https://api.dicebear.com/7.x/bottts/svg?seed=neon',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=cyber'
];

export default function ProfileModal({ onClose }) {
  const { user, token, updateUserProfile } = useContext(AuthContext);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [status, setStatus] = useState(user.status || '');
  const [avatar, setAvatar] = useState(user.avatar);

  const handleSave = async () => {
    try {
      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ displayName, avatar, status })
      });
      const data = await res.json();
      if (res.ok) {
        updateUserProfile(data.user);
        onClose();
      }
    } catch (err) {
      alert("Failed to update profile.");
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-sidebar)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--border)', width: '90%', maxWidth: '420px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h3>Profile Settings (DP & Bio)</h3>
          <button onClick={onClose} style={{ background: 'transparent', color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>

        {/* Current DP Avatar */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <img src={avatar} alt="Current DP" style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--accent)' }} />
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Choose an avatar below or paste image URL</p>
        </div>

        {/* Preset Avatars Selection */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '1.5rem' }}>
          {PRESET_AVATARS.map((avUrl) => (
            <img 
              key={avUrl} 
              src={avUrl} 
              onClick={() => setAvatar(avUrl)}
              style={{ width: '42px', height: '42px', borderRadius: '50%', cursor: 'pointer', border: avatar === avUrl ? '2px solid var(--accent)' : '2px solid transparent' }} 
            />
          ))}
        </div>

        {/* Custom Image URL */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Custom DP Image URL</label>
          <input type="text" value={avatar} onChange={e => setAvatar(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-main)', marginTop: '0.3rem' }} />
        </div>

        {/* Display Name */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Display Name</label>
          <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-main)', marginTop: '0.3rem' }} />
        </div>

        {/* Status / Bio */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status / Bio</label>
          <input type="text" value={status} onChange={e => setStatus(e.target.value)} placeholder="Available" style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-main)', marginTop: '0.3rem' }} />
        </div>

        <button onClick={handleSave} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--accent)', color: '#fff', fontWeight: 600 }}>Save Profile</button>
      </div>
    </div>
  );
}
