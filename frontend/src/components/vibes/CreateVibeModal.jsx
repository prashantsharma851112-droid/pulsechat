import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { X, Sparkles, Image as ImageIcon, Music, Palette, Send, Loader2, Type, Sparkle } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';
import ChatLiveWallpaper from '../chat/ChatLiveWallpaper';

import MusicPickerModal from './MusicPickerModal';

const GRADIENTS = [
  { id: 'g1', name: 'Pulse Purple', value: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' },
  { id: 'g2', name: 'Cyber Gold', value: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' },
  { id: 'g3', name: 'Mint Emerald', value: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)' },
  { id: 'g4', name: 'Neon Rose', value: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)' },
  { id: 'g5', name: 'Midnight AMOLED', value: 'linear-gradient(135deg, #18181b 0%, #09090b 100%)' },
  { id: 'g6', name: 'Sunset Crimson', value: 'linear-gradient(135deg, #ff4e50 0%, #f9d423 100%)' },
  { id: 'g7', name: 'Royal Sapphire', value: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)' },
  { id: 'g8', name: 'Cosmic Obsidian', value: 'linear-gradient(135deg, #0f0c29 0%, #24243e 100%)' }
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
  const [selectedSong, setSelectedSong] = useState(null);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [textStyle3D, setTextStyle3D] = useState('none');
  const [animatedBg, setAnimatedBg] = useState('none');
  const [activeCategoryTab, setActiveCategoryTab] = useState('3d_text'); // '3d_text' | 'live_animated' | 'bg_color'
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
      soundtrack: selectedSong ? 'music_track' : soundtrack,
      songTitle: selectedSong ? selectedSong.songTitle : '',
      artistName: selectedSong ? selectedSong.artistName : '',
      albumArt: selectedSong ? selectedSong.albumArt : '',
      audioUrl: selectedSong ? selectedSong.audioUrl : '',
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
            soundtrack: selectedSong ? 'music_track' : soundtrack,
            songTitle: selectedSong ? selectedSong.songTitle : '',
            artistName: selectedSong ? selectedSong.artistName : '',
            albumArt: selectedSong ? selectedSong.albumArt : '',
            audioUrl: selectedSong ? selectedSong.audioUrl : '',
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

            {/* Selected Instagram Music Track Badge / Vinyl Sticker */}
            {selectedSong ? (
              <div style={{
                position: 'absolute',
                top: 14,
                left: 14,
                background: 'rgba(0, 0, 0, 0.72)',
                backdropFilter: 'blur(10px)',
                padding: '6px 12px',
                borderRadius: '20px',
                border: '1px solid rgba(245, 158, 11, 0.5)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                zIndex: 5,
                boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                animation: 'pulseFadeIn 0.2s ease'
              }}>
                <img
                  src={selectedSong.albumArt || `https://api.dicebear.com/7.x/identicon/svg?seed=${selectedSong.songTitle}`}
                  alt="Track"
                  style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', animation: 'spin 4s linear infinite' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: '140px' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    🎵 {selectedSong.songTitle}
                  </span>
                  <span style={{ fontSize: '0.64rem', color: '#f59e0b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedSong.artistName}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSong(null)}
                  style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', padding: '2px', marginLeft: '2px' }}
                  title="Remove Song"
                >
                  <X size={14} />
                </button>
              </div>
            ) : null}
          </div>

          {/* Controls Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            
            {/* 1. Music Search Trigger Button */}
            <div>
              <button
                type="button"
                onClick={() => setShowMusicPicker(true)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '14px',
                  background: selectedSong ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(236, 72, 153, 0.25))' : 'linear-gradient(135deg, #6366f1, #a855f7)',
                  border: selectedSong ? '1.5px solid #f59e0b' : 'none',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.86rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  boxShadow: selectedSong ? '0 4px 14px rgba(245, 158, 11, 0.3)' : '0 4px 14px rgba(99, 102, 241, 0.3)',
                  transition: 'all 0.2s ease'
                }}
              >
                <Music size={17} />
                <span>{selectedSong ? `🎵 Selected: ${selectedSong.songTitle} (Change)` : '🎵 Add Music'}</span>
              </button>
            </div>

            {/* 2. Add Image Button (Directly below Add Music) */}
            <div>
              <label style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '14px',
                background: mediaUrl ? 'rgba(16, 185, 129, 0.2)' : 'linear-gradient(135deg, #10b981, #06b6d4)',
                border: mediaUrl ? '1.5px solid #10b981' : 'none',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.86rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: mediaUrl ? '0 4px 14px rgba(16, 185, 129, 0.3)' : '0 4px 14px rgba(16, 185, 129, 0.3)',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box'
              }}>
                <ImageIcon size={17} />
                <span>{uploading ? 'Processing Image...' : mediaUrl ? '🖼️ Image Attached (Click to Change)' : '🖼️ Add Image'}</span>
                <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </div>

            {/* 3. 3 Separate Category Tabs (3D Text, Live Canvas, BG Color) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '2px' }}>
              <button
                type="button"
                onClick={() => setActiveCategoryTab('3d_text')}
                style={{
                  padding: '8px 4px',
                  borderRadius: '12px',
                  border: activeCategoryTab === '3d_text' ? '1.5px solid #3b82f6' : '1px solid var(--border)',
                  background: activeCategoryTab === '3d_text' ? 'rgba(59, 130, 246, 0.22)' : 'rgba(0,0,0,0.25)',
                  color: activeCategoryTab === '3d_text' ? '#38bdf8' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <Type size={14} color={activeCategoryTab === '3d_text' ? '#38bdf8' : '#888'} /> 3D Text
              </button>

              <button
                type="button"
                onClick={() => setActiveCategoryTab('live_animated')}
                style={{
                  padding: '8px 4px',
                  borderRadius: '12px',
                  border: activeCategoryTab === 'live_animated' ? '1.5px solid #ec4899' : '1px solid var(--border)',
                  background: activeCategoryTab === 'live_animated' ? 'rgba(236, 72, 153, 0.22)' : 'rgba(0,0,0,0.25)',
                  color: activeCategoryTab === 'live_animated' ? '#f472b6' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <Sparkle size={14} color={activeCategoryTab === 'live_animated' ? '#f472b6' : '#888'} /> Live Canvas
              </button>

              <button
                type="button"
                onClick={() => setActiveCategoryTab('bg_color')}
                style={{
                  padding: '8px 4px',
                  borderRadius: '12px',
                  border: activeCategoryTab === 'bg_color' ? '1.5px solid #10b981' : '1px solid var(--border)',
                  background: activeCategoryTab === 'bg_color' ? 'rgba(16, 185, 129, 0.22)' : 'rgba(0,0,0,0.25)',
                  color: activeCategoryTab === 'bg_color' ? '#34d399' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <Palette size={14} color={activeCategoryTab === 'bg_color' ? '#34d399' : '#888'} /> BG Color
              </button>
            </div>

            {/* 4. Category Options Panel */}
            <div style={{
              padding: '10px 12px',
              borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              minHeight: '62px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              {activeCategoryTab === '3d_text' && (
                <div>
                  <span style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    Select 3D Text Style (VIP Feature):
                  </span>
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
                          background: textStyle3D === st.id ? 'rgba(59, 130, 246, 0.25)' : 'var(--bg-card)',
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
              )}

              {activeCategoryTab === 'live_animated' && (
                <div>
                  <span style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    Select Live Animated Background:
                  </span>
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
                          background: animatedBg === bg.id && !mediaUrl ? 'rgba(236, 72, 153, 0.25)' : 'var(--bg-card)',
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
              )}

              {activeCategoryTab === 'bg_color' && (
                <div>
                  <span style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    Select Background Color Palette:
                  </span>
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', alignItems: 'center' }}>
                    {GRADIENTS.map(g => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => { setSelectedGradient(g.value); setAnimatedBg('none'); setMediaUrl(''); }}
                        title={g.name}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: g.value,
                          border: selectedGradient === g.value && animatedBg === 'none' && !mediaUrl ? '2.5px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                          cursor: 'pointer',
                          flexShrink: 0,
                          transition: 'transform 0.15s ease',
                          transform: selectedGradient === g.value ? 'scale(1.1)' : 'scale(1)'
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
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

      <MusicPickerModal
        isOpen={showMusicPicker}
        onClose={() => setShowMusicPicker(false)}
        selectedSong={selectedSong}
        onSelectSong={(song) => {
          setSelectedSong(song);
          setSoundtrack('music_track');
        }}
      />
    </div>
  );
}
