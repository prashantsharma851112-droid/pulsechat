import React, { useState, useContext } from 'react';
import { X, Sparkles, Send, Crown, Zap, Flame, Gem, Smile, Lock } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import Animated3DText from '../common/Animated3DText';
import PulseProModal from './PulseProModal';

const STYLES = [
  { id: 'cyber-neon', name: 'Cyber Neon', icon: <Zap size={14} />, color: '#06b6d4', desc: 'Electric Cyan & Magenta holographic glow' },
  { id: 'gold-deluxe', name: 'Gold Deluxe', icon: <Crown size={14} />, color: '#f59e0b', desc: 'Extruded golden chrome with metallic sheen' },
  { id: 'flame-inferno', name: 'Inferno Blaze', icon: <Flame size={14} />, color: '#f97316', desc: 'Fiery blazing embers with magma depth' },
  { id: 'cosmic-nebula', name: 'Cosmic Nebula', icon: <Sparkles size={14} />, color: '#a855f7', desc: 'Deep galactic stardust violet pulsar' },
  { id: 'diamond-crystal', name: 'Crystal Diamond', icon: <Gem size={14} />, color: '#38bdf8', desc: 'Crystalline ice blue diamond facets' },
  { id: 'bubble-candy', name: 'Candy Pop', icon: <Smile size={14} />, color: '#ec4899', desc: 'Glossy rounded bubblegum balloon text' }
];

const PRESET_WORDS = ['PULSE', 'VIP', 'LEGEND', 'FIRE 🔥', 'SUPER', 'BOOM 💥', 'LOVE ❤️', 'CHILL'];

export default function Animated3DTextModal({ initialText = '', onSend3D, onClose, onOpenProModal }) {
  const { user } = useContext(AuthContext);
  const [inputText, setInputText] = useState(initialText || 'PULSE');
  const [selectedStyle, setSelectedStyle] = useState('cyber-neon');
  const [showProModal, setShowProModal] = useState(false);
  const [proModalTab, setProModalTab] = useState('pro');

  const hasUsedTrial = Boolean(user?.hasUsed3DTrial);
  const isTrial = !hasUsedTrial;
  const isUserPro = Boolean(user?.isPro && (!user?.proExpiresAt || new Date(user.proExpiresAt) > new Date()));
  const currentSparks = user?.pulseSparks ?? 0;
  const cleanText = inputText.trim() || 'PULSE';

  const openPro = (tab = 'pro') => {
    if (onOpenProModal) {
      onOpenProModal(tab);
    } else {
      setProModalTab(tab);
      setShowProModal(true);
    }
  };

  const handleSend = () => {
    if (!cleanText) return;
    if (isTrial) {
      onSend3D(cleanText, selectedStyle);
      onClose();
      return;
    }
    if (!isUserPro) {
      openPro('pro');
      return;
    }
    if (currentSparks < 10) {
      openPro('sparks');
      return;
    }
    onSend3D(cleanText, selectedStyle);
    onClose();
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
        <div
          className="modal-card modal-responsive modal-card-animated"
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: '480px',
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
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(99, 102, 241, 0.12))',
              flexShrink: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: '0.82rem',
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.35)'
                }}
              >
                3D
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>3D Animated Typography</span>
                  {isTrial ? (
                    <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', fontWeight: 800 }}>
                      🎁 1 FREE TRIAL
                    </span>
                  ) : isUserPro ? (
                    <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', fontWeight: 800 }}>
                      ⚡ 10 SPARKS / MSG
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontWeight: 800 }}>
                      🔒 VIP ONLY
                    </span>
                  )}
                </h3>
                <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Convert words into animated 3D perspective stickers
                </p>
              </div>
            </div>
            <button className="icon-btn-ghost" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

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
            {/* Live 3D Interactive Stage Preview */}
            <div
              style={{
                borderRadius: '16px',
                padding: '2.5rem 1rem 1.8rem 1rem',
                background: 'radial-gradient(ellipse at center, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '160px',
                boxShadow: 'inset 0 2px 12px rgba(0, 0, 0, 0.5)',
                overflow: 'hidden',
                position: 'relative'
              }}
            >
              <div style={{ position: 'absolute', top: '10px', left: '12px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ✨ Live 3D Preview
              </div>
              <Animated3DText
                text={cleanText}
                styleType={selectedStyle}
                isMine={true}
                showFooter={false}
              />
            </div>

            {/* Status / Sparks Cost Engine Banner */}
            {isTrial ? (
              <div style={{
                padding: '10px 14px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(99, 102, 241, 0.15))',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.78rem',
                color: '#10b981',
                fontWeight: 600
              }}>
                <Sparkles size={18} style={{ flexShrink: 0 }} />
                <div>
                  <strong>1st Time Free Trial:</strong> Pehla 3D Animated Text 100% Free hai (0 Sparks, VIP not required)! Uske baad VIP subscription aur 10 Sparks/msg lagte hain.
                </div>
              </div>
            ) : !isUserPro ? (
              <div style={{
                padding: '10px 14px',
                borderRadius: '12px',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                fontSize: '0.78rem',
                color: '#f59e0b',
                fontWeight: 600
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Crown size={18} style={{ flexShrink: 0 }} />
                  <span>Trial used! 3D stickers bhejne ke liye <strong>VIP Subscription</strong> chahiye.</span>
                </div>
                <button
                  type="button"
                  onClick={() => openPro('pro')}
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '0.72rem',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Get VIP Free
                </button>
              </div>
            ) : (
              <div style={{
                padding: '10px 14px',
                borderRadius: '12px',
                background: currentSparks < 10 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                border: currentSparks < 10 ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(245, 158, 11, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                fontSize: '0.78rem',
                color: currentSparks < 10 ? '#ef4444' : '#f59e0b',
                fontWeight: 600
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={18} fill={currentSparks < 10 ? '#ef4444' : '#f59e0b'} style={{ flexShrink: 0 }} />
                  <span>
                    Cost: <strong>10 Sparks</strong> / msg | Balance: <strong>{currentSparks} Sparks</strong>
                  </span>
                </div>
                {currentSparks < 10 ? (
                  <button
                    type="button"
                    onClick={() => openPro('sparks')}
                    style={{
                      background: '#ef4444',
                      border: 'none',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: '0.72rem',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    + Get Sparks
                  </button>
                ) : (
                  <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 800 }}>✓ Sparks Ready</span>
                )}
              </div>
            )}

            {/* Text Input */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Your Message / Word (Max 30 chars)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  maxLength={30}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type words to convert into 3D..."
                  className="form-input"
                  style={{ borderRadius: '12px', fontSize: '0.95rem', fontWeight: 600, paddingRight: '50px' }}
                  autoFocus
                />
                <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  {inputText.length}/30
                </span>
              </div>
            </div>

            {/* Quick Word Presets */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {PRESET_WORDS.map(word => (
                <button
                  key={word}
                  type="button"
                  onClick={() => setInputText(word)}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '3px 9px',
                    fontSize: '0.74rem',
                    color: 'var(--text-main)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {word}
                </button>
              ))}
            </div>

            {/* 3D Styles Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                Choose 3D Style
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {STYLES.map(s => {
                  const isSelected = selectedStyle === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedStyle(s.id)}
                      style={{
                        padding: '10px',
                        borderRadius: '12px',
                        background: isSelected ? `${s.color}18` : 'var(--bg-card)',
                        border: isSelected ? `2px solid ${s.color}` : '1px solid var(--border)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', fontWeight: 700, color: s.color }}>
                          {s.icon}
                          <span>{s.name}</span>
                        </div>
                        {isSelected && (
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color }} />
                        )}
                      </div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.2 }}>
                        {s.desc}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sticky Action Bar */}
          <div style={{
            display: 'flex',
            gap: '10px',
            padding: '12px 1.25rem',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-card)',
            flexShrink: 0
          }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{
                flex: 1.5,
                justifyContent: 'center',
                background: isTrial
                  ? 'linear-gradient(135deg, #10b981, #6366f1)'
                  : !isUserPro
                  ? 'linear-gradient(135deg, #f59e0b, #ec4899)'
                  : currentSparks < 10
                  ? 'linear-gradient(135deg, #ef4444, #f59e0b)'
                  : 'linear-gradient(135deg, #f59e0b, #10b981)',
                border: 'none',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
                color: '#fff',
                fontWeight: 800
              }}
              onClick={handleSend}
            >
              {isTrial ? (
                <>
                  <Sparkles size={16} /> Send Free Trial (0 Sparks)
                </>
              ) : !isUserPro ? (
                <>
                  <Crown size={16} /> Unlock VIP Subscription
                </>
              ) : currentSparks < 10 ? (
                <>
                  <Zap size={16} fill="#fff" /> Need 10 Sparks • Get Free Sparks
                </>
              ) : (
                <>
                  <Send size={16} /> Send 3D Text (10 Sparks)
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {showProModal && (
        <PulseProModal
          initialTab={proModalTab}
          onClose={() => setShowProModal(false)}
        />
      )}
    </>
  );
}
