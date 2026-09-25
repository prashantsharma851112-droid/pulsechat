import React, { useState, useContext, useRef } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { X, Palette, Check, RotateCcw, Crown, Lock, Image as ImageIcon, Sparkles, Heart, Trees, Waves, Zap } from 'lucide-react';
import PulseProModal from './PulseProModal';

const LIVE_WALLPAPERS = [
  {
    id: 'love_hearts_live',
    name: '💖 Couple Love (Live Hearts)',
    category: 'Love & Couples',
    tag: '✨ Live Floating Pink Hearts',
    previewBg: 'linear-gradient(135deg, #831843, #500724)',
    accent: '#ec4899',
    icon: <Heart size={16} color="#ec4899" />,
    isPro: true
  },
  {
    id: 'nature_forest_live',
    name: '🌿 Emerald Nature (Live Leaves)',
    category: 'Nature & Forest',
    tag: '✨ Live Falling Golden Leaves',
    previewBg: 'linear-gradient(135deg, #064e3b, #022c22)',
    accent: '#10b981',
    icon: <Trees size={16} color="#10b981" />,
    isPro: true
  },
  {
    id: 'ocean_waves_live',
    name: '🌊 Deep Ocean (Live Bubbles)',
    category: 'Sea & Sky',
    tag: '✨ Live Sea Waves & Water Bubbles',
    previewBg: 'linear-gradient(135deg, #0c4a6e, #082f49)',
    accent: '#0ea5e9',
    icon: <Waves size={16} color="#0ea5e9" />,
    isPro: true
  },
  {
    id: 'cyber_grid_live',
    name: '⚡ Synthwave Grid (Live Cyber)',
    category: 'Cosmic & Cyber',
    tag: '✨ Live Synth Grid & Stardust',
    previewBg: 'linear-gradient(135deg, #581c87, #3b0764)',
    accent: '#a855f7',
    icon: <Zap size={16} color="#a855f7" />,
    isPro: true
  }
];

const THEMES = [
  {
    id: 'midnight_amoled',
    name: 'Midnight AMOLED',
    category: 'Dark Mode',
    bg: '#000000',
    card: '#0d0d0d',
    accent: '#6366f1',
    tag: '🖤 Pure AMOLED (Default)',
    isPro: false
  },
  {
    id: 'dark',
    name: 'Midnight Dark',
    category: 'Dark Mode',
    bg: '#0b0f19',
    card: '#1f293d',
    accent: '#6366f1',
    tag: '🌙 Classic Dark'
  },
  {
    id: 'light',
    name: 'Daylight Clean',
    category: 'Light Mode',
    bg: '#f3f4f6',
    card: '#ffffff',
    accent: '#4f46e5',
    tag: '☀️ Clean White'
  },
  {
    id: 'gold_nitro',
    name: 'Royal Gold Aura',
    category: 'VIP Exclusive',
    bg: '#0f0c05',
    card: '#241a06',
    accent: '#f59e0b',
    tag: '⚡ VIP Gold',
    isPro: true
  },
  {
    id: 'nebula',
    name: 'Cosmic Nebula',
    category: 'VIP Exclusive',
    bg: '#0c071e',
    card: '#211342',
    accent: '#a855f7',
    tag: '⚡ VIP Nebula',
    isPro: true
  },
  {
    id: 'cyber_glow',
    name: 'Cyber Pulse',
    category: 'VIP Exclusive',
    bg: '#030d12',
    card: '#082531',
    accent: '#06b6d4',
    tag: '⚡ VIP Cyber',
    isPro: true
  },
  {
    id: 'blood_moon',
    name: 'Blood Moon',
    category: 'VIP Exclusive',
    bg: '#0d0205',
    card: '#260710',
    accent: '#ff1744',
    tag: '⚡ VIP Crimson',
    isPro: true
  },
  {
    id: 'tokyo_synth',
    name: 'Tokyo Synthwave',
    category: 'VIP Exclusive',
    bg: '#0d061f',
    card: '#200e4a',
    accent: '#f72585',
    tag: '⚡ VIP Neon 80s',
    isPro: true
  }
];

export default function ChatThemeModal({ chatId, currentTheme, onSelectTheme, onClose, onSetCustomWallpaper }) {
  const { user } = useContext(AuthContext);
  const [showProModal, setShowProModal] = useState(false);
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'custom' | 'color'
  const fileInputRef = useRef(null);

  const isUserPro = Boolean(user?.isPro);

  const handleSelectTheme = (t) => {
    if (t.isPro && !isUserPro) {
      setShowProModal(true);
      return;
    }
    if (onSelectTheme) onSelectTheme(t.id);
  };

  const handleCustomImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isUserPro) {
      setShowProModal(true);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      if (dataUrl) {
        if (onSetCustomWallpaper) {
          onSetCustomWallpaper(dataUrl);
        }
        if (onSelectTheme) {
          onSelectTheme('custom_image');
        }
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
        <div
          className="modal-card modal-responsive modal-card-animated"
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: '480px',
            maxHeight: '92dvh',
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            overflow: 'hidden',
            borderRadius: '24px'
          }}
        >
          {/* Header */}
          <div
            className="modal-header"
            style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--border)',
              background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.12), rgba(99, 102, 241, 0.12))',
              flexShrink: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Palette size={20} color="var(--accent)" />
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)' }}>
                Chat Wallpaper & Live Backgrounds
              </h3>
            </div>
            <button className="icon-btn-ghost" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', padding: '8px 16px 0 16px', gap: '8px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
            <button
              type="button"
              onClick={() => setActiveTab('live')}
              style={{
                flex: 1,
                padding: '8px',
                border: 'none',
                borderBottom: activeTab === 'live' ? '2px solid var(--accent)' : '2px solid transparent',
                background: 'transparent',
                color: activeTab === 'live' ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px'
              }}
            >
              <Sparkles size={14} /> Live Animated
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('custom')}
              style={{
                flex: 1,
                padding: '8px',
                border: 'none',
                borderBottom: activeTab === 'custom' ? '2px solid var(--accent)' : '2px solid transparent',
                background: 'transparent',
                color: activeTab === 'custom' ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px'
              }}
            >
              <ImageIcon size={14} /> Upload Custom
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('color')}
              style={{
                flex: 1,
                padding: '8px',
                border: 'none',
                borderBottom: activeTab === 'color' ? '2px solid var(--accent)' : '2px solid transparent',
                background: 'transparent',
                color: activeTab === 'color' ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px'
              }}
            >
              <Palette size={14} /> Solid Themes
            </button>
          </div>

          {/* Body Content */}
          <div
            style={{
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              flex: 1,
              minHeight: 0
            }}
          >
            {/* TAB 1: LIVE ANIMATED WALLPAPERS */}
            {activeTab === 'live' && (
              <>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Choose real-time live floating wallpaper for this conversation.
                </div>

                <div className="theme-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '10px' }}>
                  {LIVE_WALLPAPERS.map((w) => {
                    const isCurrent = currentTheme === w.id;
                    const isLocked = w.isPro && !isUserPro;
                    return (
                      <div
                        key={w.id}
                        onClick={() => handleSelectTheme(w)}
                        className={`theme-card ${isCurrent ? 'active' : ''}`}
                        style={{
                          background: w.previewBg,
                          border: isCurrent ? '2px solid #ec4899' : (w.isPro ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border)'),
                          position: 'relative',
                          padding: '14px 16px',
                          borderRadius: '16px',
                          cursor: 'pointer',
                          boxShadow: '0 4px 14px rgba(0,0,0,0.3)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {w.icon}
                            <span>{w.name}</span>
                            {w.isPro && <Crown size={14} color="#f59e0b" />}
                          </div>
                          {isCurrent ? (
                            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                              <Check size={14} strokeWidth={3} />
                            </div>
                          ) : isLocked ? (
                            <div style={{ color: '#f59e0b' }}>
                              <Lock size={16} />
                            </div>
                          ) : null}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: 'rgba(255, 255, 255, 0.85)', marginTop: '4px', fontWeight: 600 }}>
                          {w.tag}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* TAB 2: CUSTOM UPLOAD */}
            {activeTab === 'custom' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', padding: '1rem 0' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleCustomImageUpload}
                  style={{ display: 'none' }}
                />
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '20px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent)'
                }}>
                  <ImageIcon size={32} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <span>Upload Gallery Wallpaper</span>
                    {!isUserPro && <Crown size={14} color="#f59e0b" />}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: '320px' }}>
                    Set any personal photo, couple memory or custom HD wallpaper as your chat background.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    if (!isUserPro) {
                      setShowProModal(true);
                      return;
                    }
                    fileInputRef.current?.click();
                  }}
                  style={{ padding: '10px 24px', borderRadius: '20px', fontSize: '0.88rem', fontWeight: 700 }}
                >
                  📁 Select Photo from Device
                </button>
              </div>
            )}

            {/* TAB 3: SOLID THEMES */}
            {activeTab === 'color' && (
              <div className="theme-grid">
                {THEMES.map((t) => {
                  const isCurrent = currentTheme === t.id;
                  const isLocked = t.isPro && !isUserPro;
                  return (
                    <div
                      key={t.id}
                      onClick={() => handleSelectTheme(t)}
                      className={`theme-card ${isCurrent ? 'active' : ''}`}
                      style={{
                        background: t.card,
                        border: isCurrent ? '2px solid var(--accent)' : (t.isPro ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border)'),
                        position: 'relative'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: t.id === 'light' ? '#111827' : '#f3f4f6', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          {t.name}
                          {t.isPro && <Crown size={13} color="#f59e0b" />}
                        </div>
                        {isCurrent ? (
                          <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                            <Check size={12} strokeWidth={3} />
                          </div>
                        ) : isLocked ? (
                          <div style={{ color: '#f59e0b' }}>
                            <Lock size={14} />
                          </div>
                        ) : null}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: t.isPro ? '#f59e0b' : (t.id === 'light' ? '#6b7280' : '#9ca3af') }}>
                        {t.tag}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottom Actions */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1, justifyContent: 'center', fontSize: '0.82rem' }}
                onClick={() => onSelectTheme && onSelectTheme('midnight_amoled')}
              >
                <RotateCcw size={14} /> Reset Default
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={onClose}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>

      {showProModal && (
        <PulseProModal
          initialTab="pro"
          onClose={() => setShowProModal(false)}
        />
      )}
    </>
  );
}
