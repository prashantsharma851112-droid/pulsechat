import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { X, Sparkles, Image as ImageIcon, Music, Palette, Send, Loader2, Type, Sparkle } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';
import ChatLiveWallpaper from '../chat/ChatLiveWallpaper';

const GRADIENTS = [
  { id: 'g1', name: 'Pulse Purple', value: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' },
  { id: 'g2', name: 'Cyber Gold', value: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' },
  { id: 'g3', name: 'Mint Emerald', value: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)' },
  { id: 'g4', name: 'Neon Rose', value: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)' },
  { id: 'g5', name: 'Midnight AMOLED', value: 'linear-gradient(135deg, #18181b 0%, #09090b 100%)' }
];

const TEXT_STYLES_3D = [
  { id: 'none', label: 'Standard', class: '' },
  { id: 'text-3d-neon', label: '⚡ Cyber Neon', class: 'text-3d-neon' },
  { id: 'text-3d-gold', label: '👑 Gold Deluxe', class: 'text-3d-gold' },
  { id: 'text-3d-ruby', label: '💎 Blood Crimson', class: 'text-3d-ruby' },
  { id: 'text-3d-matrix', label: '❇️ Emerald Matrix', class: 'text-3d-matrix' },
  { id: 'text-3d-synthwave', label: '🌌 Tokyo Synth', class: 'text-3d-synthwave' },
  { id: 'text-3d-platinum', label: '🏆 Royal Platinum', class: 'text-3d-platinum' }
];

const ANIMATED_BGS = [
  { id: 'none', label: 'Static Gradient' },
  { id: 'matrix_code_live', label: '❇️ Matrix Rain' },
  { id: 'starry_galaxy_live', label: '🌌 Starry Galaxy' },
  { id: 'cyber_grid_live', label: '⚡ Cyber Grid' },
  { id: 'firefly_night_live', label: '💡 Firefly Glow' },
  { id: 'love_hearts_live', label: '💖 Floating Hearts' }
];

const SOUNDTRACKS = [
  { id: 'lofi', name: '🎧 Lofi Chill Beats' },
  { id: 'cyberpunk', name: '⚡ Cyberpunk Rain' },
  { id: 'nebula', name: '🌌 Space Nebula' },
  { id: 'none', name: '🔇 Silent' }
];

const compressImageToBase64 = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 640;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => resolve(event.target.result);
    };
    reader.onerror = () => resolve('');
  });
};

export default function CreateVibeModal({ onClose, onCreated }) {
  const { user, token } = useContext(AuthContext);
  const [caption, setCaption] = useState('');
  const [selectedGradient, setSelectedGradient] = useState(GRADIENTS[0].value);
  const [soundtrack, setSoundtrack] = useState('lofi');
  const [textStyle3D, setTextStyle3D] = useState('none');
  const [animatedBg, setAnimatedBg] = useState('none');
  const [mediaUrl, setMediaUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setError('File size exceeds 20MB limit.');
      return;
    }

    setUploading(true);
    setError('');

    let uploadedUrl = null;

    if (token) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${BACKEND_URL}/api/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          if (data.url) uploadedUrl = data.url;
        }
      } catch (err) {
        console.warn('Server media upload offline, falling back to compressed local storage.');
      }
    }

    if (!uploadedUrl) {
      try {
        uploadedUrl = await compressImageToBase64(file);
      } catch (err) {
        console.warn('Local compression failed:', err);
      }
    }

    if (uploadedUrl) {
      setMediaUrl(uploadedUrl);
    } else {
      setError('Unable to load image.');
    }
    setUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!caption.trim() && !mediaUrl) {
      setError('Please add a caption or upload media for your 24h Vibe.');
      return;
    }

    setSubmitting(true);
    setError('');

    const newVibe = {
      id: 'vibe_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      userId: user?.id || user?._id || 'local_user',
      username: user?.username || 'you',
      displayName: user?.displayName || user?.username || 'You',
      avatar: user?.avatar,
      caption: caption.trim(),
      mediaUrl: mediaUrl || null,
      soundtrack,
      bgGradient: selectedGradient,
      textStyle3D,
      animatedBg,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      views: [],
      sparksEarned: 0
    };

    if (token) {
      try {
        await fetch(`${BACKEND_URL}/api/vibes/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            caption: caption.trim(),
            mediaUrl: mediaUrl || null,
            soundtrack,
            bgGradient: selectedGradient,
            textStyle3D,
            animatedBg
          })
        });
      } catch (err) {
        console.warn('Server offline, vibe saved in local storage.');
      }
    }

    try {
      const raw = localStorage.getItem('pulsechat_local_vibes');
      const existing = raw ? JSON.parse(raw) : [];
      existing.unshift(newVibe);
      localStorage.setItem('pulsechat_local_vibes', JSON.stringify(existing));
    } catch (err) {
      console.warn('LocalStorage error:', err);
    }

    window.dispatchEvent(new CustomEvent('pulsechat_vibes_updated'));

    setSubmitting(false);
    if (onCreated) onCreated();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1350 }}>
      <div
        className="modal-card modal-responsive"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '460px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '24px',
          overflow: 'hidden',
          background: 'var(--bg-card)',
          border: '1px solid rgba(255,255,255,0.15)',
          maxHeight: '92dvh'
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

        {/* Scrollable Content */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
          {error && <div className="error-banner">{error}</div>}

          {/* Live Card Preview */}
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
            {/* Live Canvas Background if selected */}
            {animatedBg !== 'none' && !mediaUrl && (
              <ChatLiveWallpaper wallpaperId={animatedBg} />
            )}

            {mediaUrl ? (
              <img src={mediaUrl} alt="Vibe Media" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} />
            ) : null}

            {/* 3D Text Card or Normal Textarea */}
            {textStyle3D !== 'none' && !mediaUrl ? (
              <div className={`animated-3d-stage ${textStyle3D}`} style={{ position: 'relative', zIndex: 3, maxWidth: '100%' }}>
                <div className="animated-3d-card" style={{ padding: '10px 16px' }}>
                  <textarea
                    placeholder="Type 3D Vibe text..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    className="text-3d-content"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      resize: 'none',
                      width: '100%',
                      fontSize: '1.15rem',
                      textAlign: 'center',
                      fontFamily: 'inherit'
                    }}
                  />
                  <div className="text-3d-shadow" />
                </div>
              </div>
            ) : (
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
            )}

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
                zIndex: 4
              }}>
                <Music size={12} color="#f59e0b" />
                <span>{SOUNDTRACKS.find(s => s.id === soundtrack)?.name}</span>
              </div>
            )}
          </div>

          {/* Controls Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* 3D Text Style Selector */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                <Type size={14} color="#3b82f6" /> 3D Text Style (VIP Feature)
              </label>
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                {TEXT_STYLES_3D.map(st => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setTextStyle3D(st.id)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '12px',
                      border: textStyle3D === st.id ? '1.5px solid #3b82f6' : '1px solid var(--border)',
                      background: textStyle3D === st.id ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-card)',
                      color: textStyle3D === st.id ? '#38bdf8' : 'var(--text-muted)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Animated Wallpaper Selector */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                <Sparkle size={14} color="#ec4899" /> Live Animated Canvas Background
              </label>
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                {ANIMATED_BGS.map(bg => (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => { setAnimatedBg(bg.id); setMediaUrl(''); }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '12px',
                      border: animatedBg === bg.id && !mediaUrl ? '1.5px solid #ec4899' : '1px solid var(--border)',
                      background: animatedBg === bg.id && !mediaUrl ? 'rgba(236, 72, 153, 0.2)' : 'var(--bg-card)',
                      color: animatedBg === bg.id && !mediaUrl ? '#f472b6' : 'var(--text-muted)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {bg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Background Gradients & Media Upload */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Palette size={14} /> Background Color
              </label>
              <label style={{ cursor: 'pointer', fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ImageIcon size={14} /> {uploading ? 'Processing...' : mediaUrl ? 'Change Image' : 'Add Image'}
                <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </div>

            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {GRADIENTS.map(g => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => { setSelectedGradient(g.value); setAnimatedBg('none'); setMediaUrl(''); }}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: g.value,
                    border: selectedGradient === g.value && animatedBg === 'none' && !mediaUrl ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                />
              ))}
            </div>

            {/* Soundtrack Selector */}
            <div style={{ marginTop: '2px' }}>
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

          {/* Action Buttons */}
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
