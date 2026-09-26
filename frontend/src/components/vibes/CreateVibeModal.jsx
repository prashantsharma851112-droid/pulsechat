import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { X, Sparkles, Image as ImageIcon, Music, Palette, Send, Loader2 } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';

const GRADIENTS = [
  { id: 'g1', name: 'Pulse Purple', value: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' },
  { id: 'g2', name: 'Cyber Gold', value: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' },
  { id: 'g3', name: 'Mint Emerald', value: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)' },
  { id: 'g4', name: 'Neon Rose', value: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)' },
  { id: 'g5', name: 'Midnight AMOLED', value: 'linear-gradient(135deg, #18181b 0%, #09090b 100%)' }
];

const SOUNDTRACKS = [
  { id: 'lofi', name: '🎧 Lofi Chill Beats' },
  { id: 'cyberpunk', name: '⚡ Cyberpunk Rain' },
  { id: 'nebula', name: '🌌 Space Nebula' },
  { id: 'none', name: '🔇 Silent' }
];

export default function CreateVibeModal({ onClose, onCreated }) {
  const { token } = useContext(AuthContext);
  const [caption, setCaption] = useState('');
  const [selectedGradient, setSelectedGradient] = useState(GRADIENTS[0].value);
  const [soundtrack, setSoundtrack] = useState('lofi');
  const [mediaUrl, setMediaUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setError('File size exceeds 15MB limit.');
      return;
    }

    setUploading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${BACKEND_URL}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.url) {
        setMediaUrl(data.url);
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (err) {
      setError('Failed to upload image/video.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!caption.trim() && !mediaUrl) {
      setError('Please add a caption or upload media for your 24h Vibe.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/vibes/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          caption: caption.trim(),
          mediaUrl: mediaUrl || null,
          soundtrack,
          bgGradient: selectedGradient
        })
      });
      const data = await res.json();
      if (data.success) {
        if (onCreated) onCreated();
        onClose();
      } else {
        throw new Error(data.error || 'Failed to post Vibe');
      }
    } catch (err) {
      setError(err.message || 'Failed to post story');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1350 }}>
      <div
        className="modal-card modal-responsive"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '440px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '24px',
          overflow: 'hidden',
          background: 'var(--bg-card)',
          border: '1px solid rgba(255,255,255,0.15)'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(0,0,0,0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="#f59e0b" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)' }}>Post 24h Vibe Story</h3>
          </div>
          <button className="icon-btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Live Card Preview */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {error && <div className="error-banner">{error}</div>}

          <div style={{
            position: 'relative',
            height: '240px',
            borderRadius: '20px',
            background: mediaUrl ? '#000' : selectedGradient,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            overflow: 'hidden',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            {mediaUrl ? (
              <img src={mediaUrl} alt="Vibe Media" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} />
            ) : null}

            <textarea
              placeholder="What's your vibe today? Write something..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              style={{
                position: 'relative',
                zIndex: 2,
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '1.1rem',
                fontWeight: 700,
                textAlign: 'center',
                outline: 'none',
                resize: 'none',
                width: '100%',
                height: '100%',
                textShadow: '0 2px 8px rgba(0,0,0,0.8)'
              }}
            />

            {soundtrack !== 'none' && (
              <div style={{
                position: 'absolute',
                bottom: 12,
                left: 12,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(8px)',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '0.72rem',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                zIndex: 3
              }}>
                <Music size={12} color="#f59e0b" />
                <span>{SOUNDTRACKS.find(s => s.id === soundtrack)?.name}</span>
              </div>
            )}
          </div>

          {/* Media Upload & Background Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Palette size={14} /> Background Gradient
              </label>
              <label style={{ cursor: 'pointer', fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ImageIcon size={14} /> {uploading ? 'Uploading...' : mediaUrl ? 'Change Image' : 'Add Image/Video'}
                <input type="file" accept="image/*,video/*" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </div>

            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {GRADIENTS.map(g => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => { setSelectedGradient(g.value); setMediaUrl(''); }}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: g.value,
                    border: selectedGradient === g.value && !mediaUrl ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                />
              ))}
            </div>

            {/* Soundtrack Selector */}
            <div style={{ marginTop: '4px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                <Music size={14} /> Background Soundtrack
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {SOUNDTRACKS.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSoundtrack(s.id)}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '10px',
                      border: soundtrack === s.id ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                      background: soundtrack === s.id ? 'rgba(99, 102, 241, 0.15)' : 'rgba(0,0,0,0.2)',
                      fontSize: '0.75rem',
                      color: soundtrack === s.id ? '#fff' : 'var(--text-muted)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="btn-primary"
              style={{
                padding: '8px 20px',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {submitting ? <Loader2 size={16} className="spin" /> : <Send size={15} />} Post 24h Vibe
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
