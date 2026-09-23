import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { X, Palette, Check, RotateCcw, Crown, Lock } from 'lucide-react';
import PulseProModal from './PulseProModal';

const THEMES = [
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
    id: 'dark',
    name: 'Midnight Dark',
    category: 'Dark Mode',
    bg: '#0b0f19',
    card: '#1f293d',
    accent: '#6366f1',
    tag: '🌙 Classic Dark'
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
    id: 'midnight_amoled',
    name: 'Midnight AMOLED',
    category: 'VIP Exclusive',
    bg: '#000000',
    card: '#0d0d0d',
    accent: '#e2e8f0',
    tag: '⚡ VIP Pure OLED',
    isPro: true
  },
  {
    id: 'aurora_borealis',
    name: 'Aurora Borealis',
    category: 'VIP Exclusive',
    bg: '#02121c',
    card: '#0a2638',
    accent: '#00f2fe',
    tag: '⚡ VIP Polar Lights',
    isPro: true
  },
  {
    id: 'blood_moon',
    name: 'Blood Moon',
    category: 'VIP Exclusive',
    bg: '#0d0205',
    card: '#260710',
    accent: '#ff1744',
    tag: '⚡ VIP Crimson Abyss',
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
  },
  {
    id: 'ocean',
    name: 'Deep Ocean',
    category: 'Cool & Vibrant',
    bg: '#061325',
    card: '#132a4e',
    accent: '#0ea5e9',
    tag: '🌊 Aquatic Navy'
  },
  {
    id: 'emerald',
    name: 'Forest Mint',
    category: 'Organic',
    bg: '#071e16',
    card: '#173e32',
    accent: '#10b981',
    tag: '🌲 Mint Green'
  },
  {
    id: 'neon',
    name: 'Cyberpunk Glow',
    category: 'Electric',
    bg: '#05050d',
    card: '#141634',
    accent: '#ec4899',
    tag: '🔮 Cyber Glow'
  },
  {
    id: 'sunset',
    name: 'Rose Sunset',
    category: 'Warm Twilight',
    bg: '#1c0a14',
    card: '#3a162b',
    accent: '#f43f5e',
    tag: '🌅 Twilight Rose'
  }
];

export default function ChatThemeModal({ currentTheme, onSelectTheme, onClose }) {
  const { user } = useContext(AuthContext);
  const [showProModal, setShowProModal] = useState(false);

  const isUserPro = Boolean(user?.isPro && user?.proExpiresAt && new Date(user.proExpiresAt) > new Date());

  const handleSelectTheme = (theme) => {
    if (theme.isPro && !isUserPro) {
      setShowProModal(true);
      return;
    }
    if (onSelectTheme) onSelectTheme(theme.id);
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
        <div
          className="modal-card modal-responsive modal-card-animated"
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: '460px',
            maxHeight: '90dvh',
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
              flexShrink: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Palette size={20} color="var(--accent)" />
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)' }}>Chat Window Theme</h3>
            </div>
            <button className="icon-btn-ghost" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          {/* Theme Content */}
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
            <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
              Personalize this conversation. VIP exclusive themes include ambient frequency glows.
            </div>

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
                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: 'var(--accent)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff'
                          }}
                        >
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

                    <div className="theme-preview-dots">
                      <div className="theme-dot" style={{ background: t.bg }} title="Background" />
                      <div className="theme-dot" style={{ background: t.card }} title="Surface / Card" />
                      <div className="theme-dot" style={{ background: t.accent }} title="Accent color" />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1, justifyContent: 'center', fontSize: '0.82rem' }}
                onClick={() => onSelectTheme && onSelectTheme('default')}
              >
                <RotateCcw size={14} /> App Default
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
