import React, { useState, useContext, useRef } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { X, Sparkles, Image as ImageIcon, Music, Palette, Send, Loader2, Type, Sparkle, ZoomIn, Sliders, Trash2, AlignCenter, AlignLeft, AlignRight, Move } from 'lucide-react';
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
  { id: 'text-3d-flame', label: '🔥 Inferno Flame', class: 'text-3d-flame' },
  { id: 'text-3d-cosmic', label: '🔮 Cosmic Nebula', class: 'text-3d-cosmic' },
  { id: 'text-3d-diamond', label: '💎 Diamond Ice', class: 'text-3d-diamond' },
  { id: 'text-3d-candy', label: '🍭 Bubble Candy', class: 'text-3d-candy' },
  { id: 'text-3d-emerald', label: '❇️ Emerald Matrix', class: 'text-3d-emerald' },
  { id: 'text-3d-crimson', label: '🩸 Blood Crimson', class: 'text-3d-crimson' },
  { id: 'text-3d-tokyo', label: '🌌 Tokyo Synth', class: 'text-3d-tokyo' },
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

const STICKERS = ['🔥', '💖', '⚡', '👑', '🎵', '🌟', '🏆', '💎', '🎉', '🚀'];

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
  const [songStartTime, setSongStartTime] = useState(0);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const previewAudioRef = useRef(null);

  const previewSongPart = (song, startTimeSec) => {
    if (!song) return;
    try {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      if (song.audioUrl && !song.youtubeId) {
        const audio = new Audio(song.audioUrl);
        const validTime = Number(startTimeSec);
        if (!isNaN(validTime) && isFinite(validTime) && validTime >= 0) {
          try { audio.currentTime = validTime; } catch (e) {}
        }
        audio.volume = 0.85;
        audio.play().catch(() => {});
        previewAudioRef.current = audio;
      }
    } catch (e) {}
  };

  const formatSecs = (sec) => {
    const validSec = Number(sec) || 0;
    const m = Math.floor(validSec / 60);
    const s = Math.floor(validSec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };
  const [textStyle3D, setTextStyle3D] = useState('none');
  const [animatedBg, setAnimatedBg] = useState('none');
  const [activeCategoryTab, setActiveCategoryTab] = useState('3d_text'); // '3d_text' | 'live_animated' | 'bg_color' | 'image_adjust'
  const [mediaUrl, setMediaUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Advanced Image & Text Controls State
  const [imageFit, setImageFit] = useState('contain'); // 'contain' | 'cover' | 'padded'
  const [imageZoom, setImageZoom] = useState(1.0);
  const [imageFilter, setImageFilter] = useState('none');
  const [imageOpacity, setImageOpacity] = useState(0.92);
  const [textSize, setTextSize] = useState(1.2);
  const [textAlign, setTextAlign] = useState('center');
  const [selectedStickers, setSelectedStickers] = useState([]);

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
      setActiveCategoryTab('image_adjust');
    } else {
      setError('Unable to load image.');
    }
    setUploading(false);
  };

  const toggleSticker = (st) => {
    setSelectedStickers(prev => 
      prev.includes(st) ? prev.filter(s => s !== st) : [...prev, st]
    );
  };

  const [textPos, setTextPos] = useState({ x: 50, y: 50 });
  const [musicPos, setMusicPos] = useState({ x: 20, y: 15 });
  const [imagePos, setImagePos] = useState({ x: 50, y: 50 });
  const [draggingElement, setDraggingElement] = useState(null);
  const cardRef = useRef(null);

  const handlePointerDown = (elementName, e) => {
    e.stopPropagation();
    setDraggingElement(elementName);
  };

  const handlePointerMove = (e) => {
    if (!draggingElement || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = Math.max(10, Math.min(90, Math.round(((clientX - rect.left) / rect.width) * 100)));
    const y = Math.max(10, Math.min(90, Math.round(((clientY - rect.top) / rect.height) * 100)));

    if (draggingElement === 'text') setTextPos({ x, y });
    else if (draggingElement === 'music') setMusicPos({ x, y });
    else if (draggingElement === 'image') setImagePos({ x, y });
  };

  const handlePointerUp = () => {
    setDraggingElement(null);
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
      youtubeId: selectedSong ? selectedSong.youtubeId : '',
      songStartTime: selectedSong ? (songStartTime || 0) : 0,
      bgGradient: selectedGradient,
      textStyle3D,
      animatedBg,
      textPos,
      musicPos,
      imagePos,
      imageFit,
      imageZoom,
      imageFilter,
      imageOpacity,
      textSize,
      textAlign,
      selectedStickers,
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
            youtubeId: selectedSong ? selectedSong.youtubeId : '',
            songStartTime: selectedSong ? (songStartTime || 0) : 0,
            bgGradient: selectedGradient,
            textStyle3D,
            animatedBg,
            textPos,
            musicPos,
            imagePos,
            imageFit,
            imageZoom,
            imageFilter,
            imageOpacity,
            textSize,
            textAlign,
            selectedStickers
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
          maxHeight: '94dvh'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(0,0,0,0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="#f59e0b" />
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-main)' }}>Post 24h Vibe Story</h3>
          </div>
          <button className="icon-btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Scrollable Content */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
          {error && <div className="error-banner">{error}</div>}

          {/* YouTube Full Song Audio Player Engine */}
          {selectedSong?.youtubeId && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 12px',
              borderRadius: '12px',
              background: 'rgba(18, 18, 24, 0.88)',
              border: '1px solid rgba(245, 158, 11, 0.5)'
            }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Disc size={16} className="spin-slow" /> 🎵 Full Song Preview:
              </div>
              <div style={{ width: '130px', height: '36px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                <iframe
                  key={`yt_modal_preview_${selectedSong.youtubeId}_${songStartTime}`}
                  src={`https://www.youtube-nocookie.com/embed/${selectedSong.youtubeId}?autoplay=1&enablejsapi=1&start=${Math.floor(songStartTime)}`}
                  allow="autoplay; encrypted-media; fullscreen"
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              </div>
            </div>
          )}

          {/* Live Card Preview (Interactive Drag & Drop Canvas) */}
          <div
            ref={cardRef}
            onMouseMove={handlePointerMove}
            onTouchMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onTouchEnd={handlePointerUp}
            onMouseLeave={handlePointerUp}
            style={{
              position: 'relative',
              height: '260px',
              borderRadius: '20px',
              background: selectedGradient,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: imageFit === 'padded' ? '24px' : '0px',
              overflow: 'hidden',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.2)',
              userSelect: 'none',
              cursor: draggingElement ? 'grabbing' : 'default'
            }}
          >
            {/* Live Canvas Background ALWAYS rendered if selected */}
            {animatedBg !== 'none' && (
              <ChatLiveWallpaper wallpaperId={animatedBg} />
            )}

            {/* Uploaded Image Layer with Drag & Drop Position, Fit, Zoom, Filter & Opacity */}
            {mediaUrl ? (
              <div
                onMouseDown={(e) => handlePointerDown('image', e)}
                onTouchStart={(e) => handlePointerDown('image', e)}
                style={{
                  position: 'absolute',
                  left: `${imagePos.x}%`,
                  top: `${imagePos.y}%`,
                  transform: `translate(-50%, -50%) scale(${imageZoom})`,
                  width: imageFit === 'contain' ? '90%' : '100%',
                  height: imageFit === 'contain' ? '90%' : '100%',
                  borderRadius: imageFit === 'padded' ? '14px' : '0px',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2,
                  cursor: 'grab',
                  touchAction: 'none'
                }}
              >
                <img
                  src={mediaUrl}
                  alt="Vibe Media"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: imageFit === 'padded' ? 'contain' : imageFit,
                    filter: imageFilter === 'warm' ? 'saturate(1.4) contrast(1.15)' :
                            imageFilter === 'cyber' ? 'hue-rotate(180deg) saturate(1.5)' :
                            imageFilter === 'vintage' ? 'sepia(0.4) contrast(1.1)' :
                            imageFilter === 'bw' ? 'grayscale(0.85) contrast(1.2)' : 'none',
                    opacity: imageOpacity,
                    pointerEvents: 'none'
                  }}
                />
              </div>
            ) : null}

            {/* Drag-and-Drop 3D Text Card or Textarea */}
            <div
              onMouseDown={(e) => handlePointerDown('text', e)}
              onTouchStart={(e) => handlePointerDown('text', e)}
              style={{
                position: 'absolute',
                left: `${textPos.x}%`,
                top: `${textPos.y}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 5,
                width: '88%',
                display: 'flex',
                justifyContent: 'center',
                cursor: 'grab',
                touchAction: 'none'
              }}
            >
              {textStyle3D !== 'none' ? (
                <div className={`animated-3d-stage ${textStyle3D}`} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <div className="animated-3d-card" style={{ padding: '8px 12px', width: '100%', background: 'transparent', boxShadow: 'none', border: 'none' }}>
                    <textarea
                      placeholder="Type 3D Vibe text... (Drag to position)"
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      className="text-3d-content"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        resize: 'none',
                        width: '100%',
                        fontSize: `${textSize}rem`,
                        textAlign: textAlign,
                        fontFamily: 'inherit'
                      }}
                    />
                    <div className="text-3d-shadow" />
                  </div>
                </div>
              ) : (
                <textarea
                  placeholder="What's your vibe today? Drag to position text anywhere!"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    fontSize: `${textSize}rem`,
                    fontWeight: 700,
                    textAlign: textAlign,
                    outline: 'none',
                    resize: 'none',
                    width: '100%',
                    textShadow: '0 2px 10px rgba(0,0,0,0.85)'
                  }}
                />
              )}
            </div>

            {/* Drag-and-Drop Music Track Vinyl Sticker */}
            {selectedSong ? (
              <div
                onMouseDown={(e) => handlePointerDown('music', e)}
                onTouchStart={(e) => handlePointerDown('music', e)}
                style={{
                  position: 'absolute',
                  left: `${musicPos.x}%`,
                  top: `${musicPos.y}%`,
                  transform: 'translate(-50%, -50%)',
                  background: 'rgba(0, 0, 0, 0.82)',
                  backdropFilter: 'blur(10px)',
                  padding: '5px 10px',
                  borderRadius: '20px',
                  border: '1.5px solid rgba(245, 158, 11, 0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  zIndex: 6,
                  boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
                  cursor: 'grab',
                  touchAction: 'none'
                }}
              >
                <img
                  src={selectedSong.albumArt || `https://api.dicebear.com/7.x/identicon/svg?seed=${selectedSong.songTitle}`}
                  alt="Track"
                  style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover', animation: 'spin 4s linear infinite', pointerEvents: 'none' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: '120px', pointerEvents: 'none' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    🎵 {selectedSong.songTitle}
                  </span>
                  <span style={{ fontSize: '0.62rem', color: '#f59e0b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedSong.artistName}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setSelectedSong(null); }}
                  style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', padding: '1px' }}
                  title="Remove Song"
                >
                  <X size={13} />
                </button>
              </div>
            ) : null}

            {/* Floating Selected Sticker Badges */}
            {selectedStickers.length > 0 && (
              <div style={{
                position: 'absolute',
                bottom: 12,
                right: 12,
                display: 'flex',
                gap: '6px',
                zIndex: 6,
                background: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(8px)',
                padding: '4px 8px',
                borderRadius: '16px',
                pointerEvents: 'none'
              }}>
                {selectedStickers.map(s => (
                  <span key={s} style={{ fontSize: '1.2rem', animation: 'bounce 2s infinite' }}>{s}</span>
                ))}
              </div>
            )}
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

            {/* Instagram-style Music Trimmer / Song Portion Adjuster Widget */}
            {selectedSong && (
              <div style={{
                background: 'rgba(18, 18, 24, 0.88)',
                border: '1.5px solid rgba(245, 158, 11, 0.5)',
                borderRadius: '16px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Sliders size={13} /> Full Song Trimmer (Choose Any 30s Part)
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fff', background: 'rgba(245, 158, 11, 0.25)', padding: '2px 8px', borderRadius: '10px' }}>
                    {formatSecs(songStartTime)} - {formatSecs(songStartTime + 30)}
                  </span>
                </div>

                {/* Animated Waveform Visualizer & Seek Range Slider */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: '34px', gap: '2px', background: 'rgba(0,0,0,0.5)', borderRadius: '10px', padding: '0 8px', overflow: 'hidden' }}>
                  {[40, 65, 85, 30, 95, 60, 75, 45, 90, 100, 50, 70, 80, 60, 40, 90, 85, 70, 95, 50, 80, 60, 40, 75, 90, 65, 80, 45, 95, 85].map((h, idx) => {
                    const activeStartIdx = Math.floor((songStartTime / 240) * 30);
                    const activeEndIdx = Math.floor(((songStartTime + 30) / 240) * 30);
                    const isActive = idx >= activeStartIdx && idx <= activeEndIdx;
                    return (
                      <div
                        key={idx}
                        style={{
                          flex: 1,
                          height: `${h}%`,
                          background: isActive
                            ? 'linear-gradient(180deg, #f59e0b, #ec4899)'
                            : 'rgba(255, 255, 255, 0.22)',
                          borderRadius: '2px',
                          transition: 'background 0.15s ease'
                        }}
                      />
                    );
                  })}
                  <input
                    type="range"
                    min={0}
                    max={240}
                    step={1}
                    value={songStartTime}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setSongStartTime(val);
                      previewSongPart(selectedSong, val);
                    }}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: '100%',
                      height: '100%',
                      opacity: 0,
                      cursor: 'ew-resize',
                      zIndex: 5
                    }}
                  />
                </div>

                {/* Quick Seek Presets */}
                <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                  {[
                    { label: '▶️ Intro (0:00)', sec: 0 },
                    { label: '🔥 Verse (0:30)', sec: 30 },
                    { label: '🎵 Chorus (1:00)', sec: 60 },
                    { label: '⚡ Drop (1:30)', sec: 90 },
                    { label: '🎸 Bridge (2:00)', sec: 120 }
                  ].map(preset => (
                    <button
                      key={preset.sec}
                      type="button"
                      onClick={() => {
                        setSongStartTime(preset.sec);
                        previewSongPart(selectedSong, preset.sec);
                      }}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '10px',
                        background: songStartTime === preset.sec ? 'linear-gradient(135deg, #f59e0b, #ec4899)' : 'rgba(255,255,255,0.08)',
                        color: songStartTime === preset.sec ? '#ffffff' : 'var(--text-muted)',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

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

            {/* 3. Category Tabs (3D Text, Position, Image, Live Canvas, BG Color) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px', marginTop: '2px' }}>
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
                  fontSize: '0.76rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <Type size={13} color={activeCategoryTab === '3d_text' ? '#38bdf8' : '#888'} /> 3D Text
              </button>

              <button
                type="button"
                onClick={() => setActiveCategoryTab('position')}
                style={{
                  padding: '8px 4px',
                  borderRadius: '12px',
                  border: activeCategoryTab === 'position' ? '1.5px solid #f59e0b' : '1px solid var(--border)',
                  background: activeCategoryTab === 'position' ? 'rgba(245, 158, 11, 0.22)' : 'rgba(0,0,0,0.25)',
                  color: activeCategoryTab === 'position' ? '#f59e0b' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '0.76rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <Move size={13} color={activeCategoryTab === 'position' ? '#f59e0b' : '#888'} /> 📍 Position
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
                  fontSize: '0.76rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <Sparkle size={13} color={activeCategoryTab === 'live_animated' ? '#f472b6' : '#888'} /> Canvas
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
                  fontSize: '0.76rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <Palette size={13} color={activeCategoryTab === 'bg_color' ? '#34d399' : '#888'} /> BG Color
              </button>

              {mediaUrl && (
                <button
                  type="button"
                  onClick={() => setActiveCategoryTab('image_adjust')}
                  style={{
                    padding: '8px 4px',
                    borderRadius: '12px',
                    border: activeCategoryTab === 'image_adjust' ? '1.5px solid #f59e0b' : '1px solid var(--border)',
                    background: activeCategoryTab === 'image_adjust' ? 'rgba(245, 158, 11, 0.22)' : 'rgba(0,0,0,0.25)',
                    color: activeCategoryTab === 'image_adjust' ? '#fbbf24' : 'var(--text-muted)',
                    fontWeight: 700,
                    fontSize: '0.76rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Sliders size={13} color={activeCategoryTab === 'image_adjust' ? '#fbbf24' : '#888'} /> Adjust
                </button>
              )}
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
              {activeCategoryTab === 'position' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#f59e0b', margin: 0 }}>
                    🎯 Drag items directly on the card preview OR click presets below:
                  </span>

                  {/* Text Position */}
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                      📝 Text Alignment & Position
                    </span>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      {[
                        { label: '⬆️ Top', x: 50, y: 22 },
                        { label: '🎯 Center', x: 50, y: 50 },
                        { label: '⬇️ Bottom', x: 50, y: 78 },
                        { label: '⬅️ Left', x: 28, y: 50 },
                        { label: '➡️ Right', x: 72, y: 50 }
                      ].map(btn => (
                        <button
                          key={btn.label}
                          type="button"
                          onClick={() => setTextPos({ x: btn.x, y: btn.y })}
                          style={{
                            flex: 1, padding: '4px 6px', borderRadius: '8px', fontSize: '0.68rem', fontWeight: 700,
                            background: textPos.x === btn.x && textPos.y === btn.y ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)',
                            color: '#fff', border: textPos.x === btn.x && textPos.y === btn.y ? '1px solid #f59e0b' : '1px solid var(--border)',
                            cursor: 'pointer'
                          }}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Music Sticker Position */}
                  {selectedSong && (
                    <div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f59e0b', display: 'block', marginBottom: '4px' }}>
                        🎵 Music Sticker Position
                      </span>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        {[
                          { label: '↖️ Top-Left', x: 22, y: 15 },
                          { label: '↗️ Top-Right', x: 78, y: 15 },
                          { label: '↙️ Bottom-Left', x: 22, y: 82 },
                          { label: '↘️ Bottom-Right', x: 78, y: 82 }
                        ].map(btn => (
                          <button
                            key={btn.label}
                            type="button"
                            onClick={() => setMusicPos({ x: btn.x, y: btn.y })}
                            style={{
                              flex: 1, padding: '4px 6px', borderRadius: '8px', fontSize: '0.68rem', fontWeight: 700,
                              background: musicPos.x === btn.x && musicPos.y === btn.y ? 'rgba(245,158,11,0.3)' : 'rgba(245,158,11,0.12)',
                              color: '#f59e0b', border: musicPos.x === btn.x && musicPos.y === btn.y ? '1.5px solid #f59e0b' : '1px solid rgba(245,158,11,0.3)',
                              cursor: 'pointer'
                            }}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Image Position */}
                  {mediaUrl && (
                    <div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981', display: 'block', marginBottom: '4px' }}>
                        🖼️ Image Layer Position
                      </span>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        {[
                          { label: '🎯 Center', x: 50, y: 50 },
                          { label: '⬆️ Up', x: 50, y: 38 },
                          { label: '⬇️ Down', x: 50, y: 62 }
                        ].map(btn => (
                          <button
                            key={btn.label}
                            type="button"
                            onClick={() => setImagePos({ x: btn.x, y: btn.y })}
                            style={{
                              flex: 1, padding: '4px 6px', borderRadius: '8px', fontSize: '0.68rem', fontWeight: 700,
                              background: imagePos.x === btn.x && imagePos.y === btn.y ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.12)',
                              color: '#10b981', border: imagePos.x === btn.x && imagePos.y === btn.y ? '1.5px solid #10b981' : '1px solid rgba(16,185,129,0.3)',
                              cursor: 'pointer'
                            }}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeCategoryTab === '3d_text' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block' }}>
                    Select 3D Text Style:
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

                  {/* Size & Alignment Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Size:</span>
                      {[1.0, 1.2, 1.5, 1.8].map(sz => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setTextSize(sz)}
                          style={{
                            padding: '2px 7px',
                            borderRadius: '8px',
                            border: textSize === sz ? '1px solid var(--accent)' : 'none',
                            background: textSize === sz ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                            color: textSize === sz ? '#fff' : '#aaa',
                            fontSize: '0.72rem',
                            cursor: 'pointer'
                          }}
                        >
                          {sz === 1.0 ? 'S' : sz === 1.2 ? 'M' : sz === 1.5 ? 'L' : 'XL'}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button type="button" onClick={() => setTextAlign('left')} style={{ background: 'transparent', border: 'none', color: textAlign === 'left' ? 'var(--accent)' : '#888', cursor: 'pointer', padding: '2px' }}><AlignLeft size={14} /></button>
                      <button type="button" onClick={() => setTextAlign('center')} style={{ background: 'transparent', border: 'none', color: textAlign === 'center' ? 'var(--accent)' : '#888', cursor: 'pointer', padding: '2px' }}><AlignCenter size={14} /></button>
                      <button type="button" onClick={() => setTextAlign('right')} style={{ background: 'transparent', border: 'none', color: textAlign === 'right' ? 'var(--accent)' : '#888', cursor: 'pointer', padding: '2px' }}><AlignRight size={14} /></button>
                    </div>
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
                        onClick={() => setAnimatedBg(bg.id)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '12px',
                          border: animatedBg === bg.id ? '1.5px solid #ec4899' : '1px solid var(--border)',
                          background: animatedBg === bg.id ? 'rgba(236, 72, 153, 0.25)' : 'var(--bg-card)',
                          color: animatedBg === bg.id ? '#f472b6' : 'var(--text-muted)',
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
                        onClick={() => setSelectedGradient(g.value)}
                        title={g.name}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: g.value,
                          border: selectedGradient === g.value ? '2.5px solid #fff' : '1px solid rgba(255,255,255,0.2)',
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

              {activeCategoryTab === 'image_adjust' && mediaUrl && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.73rem', fontWeight: 700, color: '#fbbf24' }}>
                      Image Framing & Controls:
                    </span>
                    <button
                      type="button"
                      onClick={() => { setMediaUrl(''); setActiveCategoryTab('3d_text'); }}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                    >
                      <Trash2 size={12} /> Remove Image
                    </button>
                  </div>

                  {/* Image Framing Mode Buttons */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[
                      { id: 'contain', label: '🖼️ Framed (BG Visible)' },
                      { id: 'padded', label: '🔲 Padded' },
                      { id: 'cover', label: '📐 Full Cover' }
                    ].map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setImageFit(f.id)}
                        style={{
                          flex: 1,
                          padding: '4px 6px',
                          borderRadius: '8px',
                          border: imageFit === f.id ? '1px solid #f59e0b' : '1px solid var(--border)',
                          background: imageFit === f.id ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                          color: imageFit === f.id ? '#fbbf24' : '#aaa',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Image Filter Preset Selectors */}
                  <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '2px' }}>
                    {[
                      { id: 'none', label: 'Normal' },
                      { id: 'warm', label: '☀️ Warm' },
                      { id: 'cyber', label: '⚡ Cyber' },
                      { id: 'vintage', label: '📜 Vintage' },
                      { id: 'bw', label: '🖤 B&W' }
                    ].map(fl => (
                      <button
                        key={fl.id}
                        type="button"
                        onClick={() => setImageFilter(fl.id)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '8px',
                          border: imageFilter === fl.id ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)',
                          background: imageFilter === fl.id ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                          color: imageFilter === fl.id ? '#fff' : '#aaa',
                          fontSize: '0.68rem',
                          cursor: 'pointer'
                        }}
                      >
                        {fl.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 5. Stickers Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', padding: '4px 0' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>Stickers:</span>
              {STICKERS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSticker(s)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '10px',
                    border: (Array.isArray(selectedStickers) && selectedStickers.includes(s)) ? '1.5px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                    background: (Array.isArray(selectedStickers) && selectedStickers.includes(s)) ? 'rgba(245, 158, 11, 0.2)' : 'rgba(0,0,0,0.2)',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  {s}
                </button>
              ))}
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
