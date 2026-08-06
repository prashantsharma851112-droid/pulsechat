import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { X, Upload, Camera } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';

const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=alex',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=rahul',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=sara',
  'https://api.dicebear.com/7.x/bottts/svg?seed=neon',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=cyber',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=prashant',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=shadow',
  'https://api.dicebear.com/7.x/bottts/svg?seed=glitch',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=luna',
  'https://api.dicebear.com/7.x/big-smile/svg?seed=happy',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=sam',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=blaze'
];

export default function ProfileModal({ onClose }) {
  const { user, token, updateUserProfile } = useContext(AuthContext);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [status, setStatus] = useState(user.status || '');
  const [avatar, setAvatar] = useState(user.avatar);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatar(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/users/profile`, {
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-responsive" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-main)' }}>Profile Settings (DP & Bio)</h3>
          <button className="icon-btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {/* Current DP Avatar Preview with Upload Trigger */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem', position: 'relative' }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img
                src={avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                alt="Current DP"
                style={{ width: '96px', height: '96px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--accent)', boxShadow: '0 8px 20px rgba(0,0,0,0.3)' }}
              />
              <label
                htmlFor="dp-file-input"
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  background: 'var(--accent)',
                  color: '#fff',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
                }}
                title="Upload Photo (Any Image Size)"
              >
                <Camera size={16} />
              </label>
              <input
                id="dp-file-input"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.6rem' }}>
              Upload any image size or pick an avatar preset below!
            </p>
          </div>

          {/* Preset Avatars Selection */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px', marginBottom: '1.25rem', maxHeight: '110px', overflowY: 'auto', padding: '4px' }}>
            {PRESET_AVATARS.map((avUrl) => (
              <img
                key={avUrl}
                src={avUrl}
                onClick={() => setAvatar(avUrl)}
                alt="Avatar preset"
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  border: avatar === avUrl ? '2.5px solid var(--accent)' : '2px solid transparent',
                  background: 'var(--bg-card)',
                  padding: '2px',
                  transition: 'all 0.15s ease'
                }}
              />
            ))}
          </div>

          {/* Display Name */}
          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">Display Name</label>
            <input
              type="text"
              className="form-input"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
            />
          </div>

          {/* Status / Bio */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Status / Bio</label>
            <input
              type="text"
              className="form-input"
              value={status}
              onChange={e => setStatus(e.target.value)}
              placeholder="Available"
            />
          </div>

          <button onClick={handleSave} className="btn-primary" style={{ width: '100%', padding: '0.8rem' }} disabled={loading}>
            {loading ? 'Saving Profile...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
