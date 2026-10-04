import React, { useState, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { X, Zap, RotateCcw } from 'lucide-react';
import Sticker3D from '../common/Sticker3D';
import { playSound } from '../../utils/audio';

const CONFETTI_COLORS = ['#f59e0b', '#ec4899', '#8b5cf6', '#10b981', '#3b82f6', '#ef4444', '#fde047', '#06b6d4'];

export default function GiftUnboxModal({
  giftData,
  senderName = 'Friend',
  senderAvatar = null,
  isMine = false,
  messageId = '',
  onClose,
  onOpenWallet
}) {
  const uid = useId().replace(/:/g, '');
  const giftId = giftData?.giftId || 'rocket';
  const sparkAmount = giftData?.sparkAmount || 10;
  const giftName = giftData?.giftName || 'Virtual Gift';

  // Check if previously unboxed
  const storageKey = messageId ? `pulse_gift_unboxed_${messageId}` : null;
  const isAlreadyUnboxed = storageKey ? localStorage.getItem(storageKey) === 'true' : false;

  // States: 'box' | 'opening' | 'revealed'
  const [step, setStep] = useState(isAlreadyUnboxed ? 'revealed' : 'box');
  const [isShaking, setIsShaking] = useState(false);
  const [isPopping, setIsPopping] = useState(false);
  const [confetti, setConfetti] = useState([]);

  // Generate 3D burst confetti
  const triggerConfetti = () => {
    const pieces = Array.from({ length: 48 }).map((_, i) => {
      const angle = (i / 48) * 2 * Math.PI + (Math.random() - 0.5) * 0.4;
      const dist = Math.random() * 220 + 90;
      return {
        id: i,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist - 30,
        rot: Math.random() * 720 - 360,
        size: Math.random() * 8 + 6,
        shape: Math.random() > 0.4 ? 'rect' : 'circle',
        delay: Math.random() * 0.1
      };
    });
    setConfetti(pieces);
  };

  const handleStartUnbox = (e) => {
    if (e) e.stopPropagation();
    if (step !== 'box') return;

    // Step 1: Start shaking
    setStep('opening');
    setIsShaking(true);
    playSound('pop');

    // Step 2: After 300ms shake, trigger 3D lid pop & box fall & confetti
    setTimeout(() => {
      setIsShaking(false);
      setIsPopping(true);
      triggerConfetti();
      playSound('success');

      if (storageKey) {
        try {
          localStorage.setItem(storageKey, 'true');
        } catch {}
      }

      // Step 3: Transition to pure revealed state (box unmounts completely)
      setTimeout(() => {
        setStep('revealed');
        setIsPopping(false);
      }, 820);
    }, 320);
  };

  const handleReplay = (e) => {
    if (e) e.stopPropagation();
    setConfetti([]);
    setIsShaking(false);
    setIsPopping(false);
    setStep('box');
  };

  const modalContent = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        zIndex: 9999,
        background: 'rgba(5, 4, 12, 0.92)',
        backdropFilter: 'blur(26px)',
        WebkitBackdropFilter: 'blur(26px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        overflow: 'hidden'
      }}
    >
      {/* Top Controls: Minimal Transparent Replay & Close */}
      <div
        style={{
          position: 'absolute',
          top: '24px',
          right: '24px',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {step === 'revealed' && (
          <button
            onClick={handleReplay}
            title="Replay 3D Unboxing"
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: 'rgba(255, 255, 255, 0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.2s ease'
            }}
          >
            <RotateCcw size={18} />
          </button>
        )}

        <button
          onClick={onClose}
          title="Close"
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: 'rgba(255, 255, 255, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.2s ease'
          }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Confetti Particles Burst */}
      {confetti.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 40
          }}
        >
          {confetti.map((p) => (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                width: `${p.size}px`,
                height: p.shape === 'circle' ? `${p.size}px` : `${p.size * 1.6}px`,
                borderRadius: p.shape === 'circle' ? '50%' : '2px',
                backgroundColor: p.color,
                opacity: 0,
                animation: `confettiBlast 1.1s cubic-bezier(0.2, 0.8, 0.3, 1) forwards ${p.delay}s`,
                '--tx': `${p.x}px`,
                '--ty': `${p.y}px`,
                '--trot': `${p.rot}deg`
              }}
            />
          ))}
        </div>
      )}

      {/* --- STAGES 1 & 2: 3D GIFT BOX (PRESENT & UNBOXING) --- */}
      {(step === 'box' || step === 'opening') && (
        <div
          onClick={handleStartUnbox}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            position: 'relative',
            zIndex: 20
          }}
        >
          {/* Radial Ambient Glow behind the 3D Box */}
          <div
            style={{
              position: 'absolute',
              width: '320px',
              height: '320px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(245, 158, 11, 0.3) 0%, rgba(236, 72, 153, 0.2) 40%, transparent 70%)',
              filter: 'blur(45px)',
              pointerEvents: 'none',
              transform: 'scale(1.2)'
            }}
          />

          {/* 3D Box Container with Float / Shake */}
          <div
            className={
              isShaking
                ? 'gift-box-shaking'
                : !isPopping
                ? 'gift-box-floating'
                : ''
            }
            style={{
              position: 'relative',
              width: '210px',
              height: '210px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {/* 3D Box Base (Falls Down & Disappears when popped) */}
            <div
              className={isPopping ? 'gift-box-base-falling' : ''}
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none'
              }}
            >
              <svg viewBox="0 0 160 160" width="100%" height="100%" style={{ overflow: 'visible' }}>
                <defs>
                  <linearGradient id={`baseLeft_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#be123c" />
                    <stop offset="100%" stopColor="#881337" />
                  </linearGradient>
                  <linearGradient id={`baseRight_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#9f1239" />
                    <stop offset="100%" stopColor="#4c0519" />
                  </linearGradient>
                  <linearGradient id={`baseRibbon_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fef08a" />
                    <stop offset="50%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#b45309" />
                  </linearGradient>
                </defs>

                {/* Isometric Drop Shadow */}
                <ellipse cx="80" cy="144" rx="46" ry="12" fill="#000000" opacity="0.6" />

                {/* Box Cavity (Revealed when lid opens) */}
                <polygon points="80,72 126,76 80,102 34,76" fill="#30030e" />
                <ellipse cx="80" cy="86" rx="22" ry="10" fill="#fef08a" opacity="0.75" filter="blur(6px)" />

                {/* Left Side Face */}
                <polygon points="34,76 80,102 80,138 34,112" fill={`url(#baseLeft_${uid})`} />
                {/* Right Side Face */}
                <polygon points="80,102 126,76 126,112 80,138" fill={`url(#baseRight_${uid})`} />
                {/* Left Face Ribbon */}
                <polygon points="53,87 61,91 61,127 53,123" fill={`url(#baseRibbon_${uid})`} />
                {/* Right Face Ribbon */}
                <polygon points="99,91 107,87 107,123 99,127" fill={`url(#baseRibbon_${uid})`} />
              </svg>
            </div>

            {/* 3D Box Lid (Flies Up & Spins Away when popped) */}
            <div
              className={isPopping ? 'gift-box-lid-opening' : ''}
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none'
              }}
            >
              <svg viewBox="0 0 160 160" width="100%" height="100%" style={{ overflow: 'visible' }}>
                <defs>
                  <linearGradient id={`lidTop_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f43f5e" />
                    <stop offset="100%" stopColor="#be123c" />
                  </linearGradient>
                  <linearGradient id={`lidRibbon_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fef08a" />
                    <stop offset="50%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#b45309" />
                  </linearGradient>
                </defs>

                <g filter="drop-shadow(0 8px 16px rgba(190, 18, 60, 0.45))">
                  {/* Lid overhang rims */}
                  <polygon points="30,68 80,96 80,103 30,75" fill="#be123c" />
                  <polygon points="80,96 130,68 130,75 80,103" fill="#881337" />
                  {/* Lid top face */}
                  <polygon points="80,40 130,68 80,96 30,68" fill={`url(#lidTop_${uid})`} />
                  {/* Top Face Gold Ribbons */}
                  <polygon points="52,54 58,51 108,79 102,82" fill={`url(#lidRibbon_${uid})`} />
                  <polygon points="102,54 108,51 58,79 52,82" fill={`url(#lidRibbon_${uid})`} />
                  {/* Specular Highlight on Lid Rim */}
                  <polyline points="30,68 80,96 130,68" fill="none" stroke="#fda4af" strokeWidth="1.5" opacity="0.8" />
                  {/* 3D Golden Bow on Top */}
                  <path d="M80 66 C65 42 42 46 60 64 C68 70 76 68 80 66 Z" fill={`url(#lidRibbon_${uid})`} />
                  <path d="M80 66 C95 42 118 46 100 64 C92 70 84 68 80 66 Z" fill={`url(#lidRibbon_${uid})`} />
                  <ellipse cx="80" cy="66" rx="7" ry="5.5" fill="#fef08a" stroke="#d97706" strokeWidth="1" />
                  <path d="M78 68 C74 76 64 82 58 84 C62 81 72 74 76 68 Z" fill={`url(#lidRibbon_${uid})`} />
                  <path d="M82 68 C86 76 96 82 102 84 C98 81 88 74 84 68 Z" fill={`url(#lidRibbon_${uid})`} />
                </g>
              </svg>
            </div>

            {/* Emerging 3D Gift inside box while popping */}
            {isPopping && (
              <div
                className="gift-item-emerging"
                style={{
                  position: 'absolute',
                  zIndex: 25,
                  pointerEvents: 'none'
                }}
              >
                <Sticker3D giftId={giftId} sparkAmount={sparkAmount} showFooter={false} />
              </div>
            )}
          </div>

          {/* Minimal Tap Hint Below Box */}
          <div
            style={{
              marginTop: '36px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              opacity: isPopping ? 0 : 1,
              transition: 'opacity 0.2s ease'
            }}
          >
            <span
              style={{
                fontSize: '0.95rem',
                fontWeight: 700,
                color: 'rgba(255, 255, 255, 0.9)',
                letterSpacing: '0.3px',
                textShadow: '0 2px 10px rgba(0, 0, 0, 0.5)'
              }}
            >
              Tap to open ✨
            </span>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 10px',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: '16px',
                color: '#f59e0b',
                fontWeight: 800,
                fontSize: '0.78rem'
              }}
            >
              <Zap size={13} fill="#f59e0b" />
              <span>{sparkAmount} Sparks</span>
            </div>
          </div>
        </div>
      )}

      {/* --- STAGE 3: REVEALED (BOX HAS COMPLETELY FALLEN & DISAPPEARED) --- */}
      {step === 'revealed' && (
        <div
          onClick={(e) => {
            // Tapping anywhere closes the modal
            e.stopPropagation();
            onClose();
          }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            position: 'relative',
            zIndex: 30,
            width: '100%',
            maxWidth: '380px'
          }}
        >
          {/* Pulsating Glowing Aura Behind 3D Gift */}
          <div
            style={{
              position: 'absolute',
              width: '300px',
              height: '300px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(245, 158, 11, 0.35) 0%, rgba(168, 85, 247, 0.22) 50%, transparent 72%)',
              filter: 'blur(50px)',
              pointerEvents: 'none'
            }}
          />

          {/* Floating 3D Gift */}
          <div
            className="gift-item-emerging"
            style={{
              margin: '0 0 28px 0',
              cursor: 'pointer'
            }}
          >
            <Sticker3D giftId={giftId} sparkAmount={sparkAmount} showFooter={false} />
          </div>

          {/* Minimal Spark Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              background: 'rgba(245, 158, 11, 0.16)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '20px',
              color: '#fbbf24',
              fontWeight: 800,
              fontSize: '0.88rem',
              marginBottom: '32px'
            }}
          >
            <Zap size={15} fill="#fbbf24" />
            <span>{isMine ? `${sparkAmount} Sparks Sent` : `+${sparkAmount} Sparks`}</span>
          </div>

          {/* Soft dismiss hint */}
          <span
            style={{
              fontSize: '0.78rem',
              color: 'rgba(255, 255, 255, 0.45)',
              letterSpacing: '0.4px'
            }}
          >
            Tap anywhere to close
          </span>
        </div>
      )}

      <style>{`
        @keyframes confettiBlast {
          0% {
            opacity: 1;
            transform: translate(0, 0) scale(0.2) rotate(0deg);
          }
          60% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(var(--tx), var(--ty)) scale(1.1) rotate(var(--trot));
          }
        }
      `}</style>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}
