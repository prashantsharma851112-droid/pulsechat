import React, { useContext } from 'react';
import { X, Palette, Check, Sparkles } from 'lucide-react';
import { ThemeContext } from '../../context/ThemeContext';

const THEMES = [
  {
    id: 'light',
    name: 'Daylight Clean',
    category: 'Light Mode',
    bg: '#f3f4f6',
    card: '#ffffff',
    accent: '#4f46e5',
    tag: '☀️ Default Light'
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

export default function ChatThemeModal({ onClose }) {
  const { theme, changeTheme } = useContext(ThemeContext);

  const handleSelectTheme = (themeId) => {
    changeTheme(themeId);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="modal-card modal-responsive modal-card-animated"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '440px', padding: 0, overflow: 'hidden' }}
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Palette size={20} color="var(--accent)" />
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)' }}>Chat Theme</h3>
          </div>
          <button className="icon-btn-ghost" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Theme Content */}
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            Choose your preferred color theme. Changes apply instantly across PulseChat.
          </div>

          <div className="theme-grid">
            {THEMES.map((t) => {
              const isCurrent = theme === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => handleSelectTheme(t.id)}
                  className={`theme-card ${isCurrent ? 'active' : ''}`}
                  style={{
                    background: t.card,
                    border: isCurrent ? '2px solid var(--accent)' : '1px solid var(--border)',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: t.id === 'light' ? '#111827' : '#f3f4f6' }}>
                      {t.name}
                    </div>
                    {isCurrent && (
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
                    )}
                  </div>

                  <div style={{ fontSize: '0.74rem', color: t.id === 'light' ? '#6b7280' : '#9ca3af' }}>
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={onClose}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
