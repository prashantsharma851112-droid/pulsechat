import React, { useState, useEffect } from 'react';
import { X, Zap, Sparkles, RotateCcw, Check, Heart, Gift } from 'lucide-react';
import Sticker3D from '../common/Sticker3D';
import { playSound } from '../../utils/audio';

const CONFETTI_COLORS = ['#f59e0b', '#ec4899', '#8b5cf6', '#10b981', '#3b82f6', '#ef4444', '#fde047'];

export default function GiftUnboxModal({
  giftData,
  senderName = 'Friend',
  senderAvatar = null,
  isMine = false,
  messageId = '',
  onClose,
  onOpenWallet
}) {
  const giftId = giftData?.giftId || 'rocket';
  const sparkAmount = giftData?.sparkAmount || 10;
  const giftName = giftData?.giftName || 'Virtual Gift';
  const icon = giftData?.icon || '🎁';
  const desc = giftData?.desc || 'Exclusive PulseChat Virtual Gift';

  // Check if previously unboxed
  const storageKey = messageId ? `pulse_gift_unboxed_${messageId}` : null;
  const isAlreadyUnboxed = storageKey ? localStorage.getItem(storageKey) === 'true' : false;

  const [step, setStep] = useState(isAlreadyUnboxed ? 'revealed' : 'box'); // 'box' | 'unboxing' | 'revealed'
  const [isShaking, setIsShaking] = useState(false);
  const [confetti, setConfetti] = useState([]);

  // Generate confetti burst particles
  const triggerConfetti = () => {
    const pieces = Array.from({ length: 45 }).map((_, i) => ({
      id: i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      x: (Math.random() - 0.5) * 320,
      y: (Math.random() - 0.7) * 360,
      rot: Math.random() * 720 - 360,
      size: Math.random() * 8 + 6,
      shape: Math.random() > 0.4 ? 'rect' : 'circle',
      delay: Math.random() * 0.15
    }));
    setConfetti(pieces);
  };

  const handleStartUnbox = () => {
    if (step === 'unboxing') return;

    setStep('unboxing');
    setIsShaking(true);
    playSound('pop');

    // Shake for 700ms, then pop open with confetti
    setTimeout(() => {
      setIsShaking(false);
      triggerConfetti();
      playSound('success');
      setStep('revealed');

      if (storageKey) {
        try {
          localStorage.setItem(storageKey, 'true');
        } catch {}
      }
    }, 750);
  };

  const handleReplay = () => {
    setConfetti([]);
    setStep('box');
    setIsShaking(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1300 }}>
      <div
        className="modal-card modal-responsive modal-card-animated"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '440px',
          width: '92%',
          borderRadius: '26px',
          background: 'linear-gradient(145deg, #131127 0%, #1e1b38 50%, #120e24 100%)',
          border: '1.5px solid rgba(168, 85, 247, 0.4)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(168, 85, 247, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '24px 20px',
          position: 'relative'
        }}
      >
        {/* Sunburst glowing background on reveal */}
        {step === 'revealed' && <div className="gift-sunburst" />}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="icon-btn-ghost"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            zIndex: 10,
            color: 'rgba(255, 255, 255, 0.7)',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '50%',
            padding: '6px'
          }}
        >
          <X size={18} />
        </button>

        {/* Header Sender Info */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '16px',
          zIndex: 5,
          background: 'rgba(255, 255, 255, 0.06)',
          padding: '6px 14px',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          {senderAvatar ? (
            <img
              src={senderAvatar}
              alt=""
              style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <span style={{ fontSize: '1rem' }}>🎁</span>
          )}
          <span style={{ fontSize: '0.82rem', color: '#e2e8f0', fontWeight: 600 }}>
            {isMine ? (
              <span>Gift sent by <strong>You</strong></span>
            ) : (
              <span>Gift beamed by <strong style={{ color: '#f59e0b' }}>@{senderName}</strong></span>
            )}
          </span>
        </div>

        {/* --- STAGE 1: MYSTERY GIFT BOX (UNOPENED / UNBOXING) --- */}
        {(step === 'box' || step === 'unboxing') && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            zIndex: 5,
            width: '100%',
            padding: '10px 0'
          }}>
            <h2 style={{
              margin: '0 0 4px 0',
              fontSize: '1.35rem',
              fontWeight: 800,
              background: 'linear-gradient(90deg, #f59e0b, #ec4899, #a855f7)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '0.3px'
            }}>
              {isMine ? 'Your Mystery Gift' : 'Special Surprise Inside!'}
            </h2>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.65)' }}>
              {step === 'unboxing' ? 'Unwrapping the ribbons...' : 'Tap the 3D Gift Box to unbox and reveal!'}
            </p>

            {/* 3D Gift Dabba with hover & shake */}
            <div
              onClick={handleStartUnbox}
              className={isShaking ? 'gift-box-shaking' : ''}
              style={{
                cursor: 'pointer',
                transform: 'scale(1.2)',
                margin: '24px 0 34px 0',
                transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
              }}
              title="Tap to Unbox!"
            >
              <Sticker3D
                giftId="giftbox"
                sparkAmount={sparkAmount}
                showFooter={false}
              />
            </div>

            {/* Sparks Tag */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 14px',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '20px',
              color: '#f59e0b',
              fontWeight: 800,
              fontSize: '0.86rem',
              marginBottom: '20px'
            }}>
              <Zap size={15} fill="#f59e0b" />
              <span>{sparkAmount} Sparks Value</span>
            </div>

            {/* Tap to Unbox CTA Button */}
            <button
              onClick={handleStartUnbox}
              disabled={step === 'unboxing'}
              style={{
                width: '100%',
                maxWidth: '280px',
                padding: '13px',
                borderRadius: '16px',
                border: 'none',
                background: 'linear-gradient(90deg, #ec4899, #8b5cf6, #f59e0b)',
                color: '#fff',
                fontWeight: 800,
                fontSize: '1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 8px 24px rgba(236, 72, 153, 0.4)',
                transform: step === 'unboxing' ? 'scale(0.96)' : 'scale(1)',
                transition: 'all 0.2s ease'
              }}
            >
              <Sparkles size={18} />
              {step === 'unboxing' ? 'Opening...' : '✨ Tap to Open Gift!'}
            </button>
          </div>
        )}

        {/* --- STAGE 2: REVEALED 3D GIFT --- */}
        {step === 'revealed' && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            zIndex: 5,
            width: '100%',
            padding: '4px 0'
          }}>
            {/* Confetti Elements */}
            {confetti.map((p) => (
              <div
                key={p.id}
                style={{
                  position: 'absolute',
                  top: '40%',
                  left: '50%',
                  width: `${p.size}px`,
                  height: p.shape === 'circle' ? `${p.size}px` : `${p.size * 1.5}px`,
                  borderRadius: p.shape === 'circle' ? '50%' : '2px',
                  backgroundColor: p.color,
                  transform: `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg)`,
                  opacity: 0,
                  pointerEvents: 'none',
                  animation: `confettiFloat 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards ${p.delay}s`
                }}
              />
            ))}

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 12px',
              background: 'linear-gradient(90deg, rgba(236, 72, 153, 0.2), rgba(245, 158, 11, 0.2))',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '20px',
              color: '#fbbf24',
              fontSize: '0.74rem',
              fontWeight: 800,
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
              marginBottom: '10px'
            }}>
              <Sparkles size={12} fill="#fbbf24" />
              <span>Unboxed Successfully</span>
            </div>

            {/* Floating 3D Gift with emergence animation */}
            <div
              className="gift-emerged"
              style={{
                transform: 'scale(1.28)',
                margin: '16px 0 24px 0'
              }}
            >
              <Sticker3D
                giftId={giftId}
                sparkAmount={sparkAmount}
                showFooter={false}
              />
            </div>

            {/* Gift Title & Description */}
            <h2 style={{
              margin: '0 0 4px 0',
              fontSize: '1.45rem',
              fontWeight: 900,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              <span>{giftName}</span>
              <span style={{ fontSize: '1.5rem' }}>{icon}</span>
            </h2>

            <p style={{
              margin: '0 0 16px 0',
              fontSize: '0.84rem',
              color: 'rgba(255, 255, 255, 0.75)',
              maxWidth: '320px',
              lineHeight: 1.4
            }}>
              {desc}
            </p>

            {/* Sparks Reward Card */}
            <div style={{
              width: '100%',
              maxWidth: '320px',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: '16px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '18px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  background: 'rgba(245, 158, 11, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f59e0b'
                }}>
                  <Zap size={18} fill="#f59e0b" />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                    {isMine ? 'Gift Value' : 'Sparks Credited'}
                  </div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f59e0b' }}>
                    {isMine ? `${sparkAmount} Sparks Sent` : `+${sparkAmount} Sparks in Wallet`}
                  </div>
                </div>
              </div>

              {onOpenWallet && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenWallet();
                  }}
                  style={{
                    background: 'rgba(245, 158, 11, 0.2)',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    color: '#fbbf24',
                    borderRadius: '10px',
                    padding: '6px 10px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Wallet
                </button>
              )}
            </div>

            {/* Action Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', maxWidth: '320px' }}>
              <button
                onClick={handleReplay}
                title="Replay Unboxing Animation"
                style={{
                  padding: '11px 14px',
                  borderRadius: '14px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#e2e8f0',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  flexShrink: 0
                }}
              >
                <RotateCcw size={15} />
                <span>Replay</span>
              </button>

              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '14px',
                  background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(99, 102, 241, 0.3)'
                }}
              >
                Awesome!
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes confettiFloat {
          0% {
            opacity: 1;
            transform: translate(0, 0) rotate(0deg) scale(0.2);
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(var(--tx, 0), var(--ty, 0)) rotate(var(--trot, 180deg)) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
