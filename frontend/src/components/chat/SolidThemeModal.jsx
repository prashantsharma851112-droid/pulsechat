import React, { useState, useContext } from 'react';
import { ThemeContext } from '../../context/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import { X, Palette, Check, Crown, Lock } from 'lucide-react';
import PulseProModal from './PulseProModal';

const SOLID_THEMES = [
  { id: 'midnight_amoled', name: '🖤 Midnight AMOLED (Default)', color: '#000000', card: '#0d0d0d', isPro: false },
  { id: 'dark', name: '🌙 Midnight Dark', color: '#6366f1', card: '#1f293d', isPro: false },
  { id: 'light', name: '☀️ Daylight Clean (Light Mode)', color: '#4f46e5', card: '#ffffff', isPro: false },
  { id: 'emerald', name: '🌿 Emerald Pulse', color: '#10b981', card: '#071e16', isPro: false },
  { id: 'neon', name: '⚡ Cyberpunk Neon', color: '#ec4899', card: '#05050d', isPro: false },
  { id: 'sunset', name: '🌅 Sunset Rose', color: '#f43f5e', card: '#1c0a14', isPro: false },
  { id: 'aurora_borealis', name: '🌌 Aurora Borealis', color: '#00f2fe', card: '#02121c', isPro: true },
  { id: 'blood_moon', name: '🩸 Blood Moon', color: '#ff1744', card: '#260710', isPro: true },
  { id: 'tokyo_synth', name: '🌆 Tokyo Synthwave', color: '#f72585', card: '#200e4a', isPro: true },
  { id: 'royal_gold', name: '👑 Royal Gold Aura', color: '#f59e0b', card: '#241a06', isPro: true },
  { id: 'nebula', name: '🔮 Cosmic Nebula', color: '#a855f7', card: '#211342', isPro: true },
  { id: 'cyber_glow', name: '⚡ Cyber Pulse', color: '#06b6d4', card: '#082531', isPro: true }
];

export default function SolidThemeModal({ onClose }) {
  const { theme, changeTheme } = useContext(ThemeContext);
  const { user } = useContext(AuthContext);
  const [showProModal, setShowProModal] = useState(false);

  const isUserProActive = Boolean(user?.isPro && user?.proExpiresAt && new Date(user.proExpiresAt) > new Date());

  const handleSelectTheme = (t) => {
    if (t.isPro && !isUserProActive) {
      setShowProModal(true);
      return;
    }
    changeTheme(t.id);
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1250 }}>
        <div
          className="modal-card modal-responsive modal-card-animated"
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: '440px',
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
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15))',
              flexShrink: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Palette size={20} color="var(--accent)" />
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)' }}>
                Solid Color Themes
              </h3>
            </div>
            <button className="icon-btn-ghost" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Select App UI solid color theme. Changes apply across all chat screens instantly.
            </div>

            {SOLID_THEMES.map((t) => {
              const isCurrent = theme === t.id;
              const isLocked = t.isPro && !isUserProActive;
              return (
                <div
                  key={t.id}
                  onClick={() => handleSelectTheme(t)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: 'var(--bg-card)',
                    border: isCurrent ? '2px solid var(--accent)' : (t.isPro ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border)'),
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: t.color, border: '2px solid rgba(255,255,255,0.2)' }} />
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {t.name}
                      {t.isPro && <Crown size={13} color="#f59e0b" />}
                    </span>
                  </div>

                  {isCurrent ? (
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={14} strokeWidth={3} />
                    </div>
                  ) : isLocked ? (
                    <Lock size={15} color="#f59e0b" />
                  ) : null}
                </div>
              );
            })}
          </div>

          <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', background: 'var(--bg-card)' }}>
            <button
              type="button"
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
              onClick={onClose}
            >
              Done
            </button>
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
