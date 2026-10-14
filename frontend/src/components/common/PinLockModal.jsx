import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Lock, X, Delete, Check, ShieldCheck, KeyRound } from 'lucide-react';
import { getSecurityPin, setSecurityPin, verifySecurityPin } from '../../utils/securityLock';

export default function PinLockModal({
  isOpen,
  mode = 'verify', // 'verify' | 'setup' | 'change'
  title,
  subtitle,
  onSuccess,
  onClose
}) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isConfirmingStep, setIsConfirmingStep] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setConfirmPin('');
      setIsConfirmingStep(false);
      setErrorMsg('');
      setIsShaking(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const triggerErrorShake = (msg) => {
    setErrorMsg(msg);
    setIsShaking(true);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([80, 50, 80]); } catch (e) {}
    }
    setTimeout(() => {
      setIsShaking(false);
      setPin('');
      if (mode === 'setup' && isConfirmingStep) {
        setIsConfirmingStep(false);
        setConfirmPin('');
      }
    }, 600);
  };

  const handleKeyPress = (num) => {
    if (pin.length < 4) {
      const next = pin + String(num);
      setPin(next);
      setErrorMsg('');

      if (next.length === 4) {
        // Complete 4 digits entered!
        if (mode === 'verify') {
          if (verifySecurityPin(next)) {
            if (onSuccess) onSuccess(next);
            if (onClose) onClose();
          } else {
            triggerErrorShake('Incorrect PIN. Try again.');
          }
        } else if (mode === 'setup' || mode === 'change') {
          if (!isConfirmingStep) {
            // Move to confirmation step
            setTimeout(() => {
              setConfirmPin(next);
              setPin('');
              setIsConfirmingStep(true);
            }, 180);
          } else {
            // Verify match
            if (next === confirmPin) {
              setSecurityPin(next);
              if (onSuccess) onSuccess(next);
              if (onClose) onClose();
            } else {
              triggerErrorShake('PINs do not match. Start over.');
            }
          }
        }
      }
    }
  };

  const handleDelete = () => {
    if (pin.length > 0) {
      setPin(prev => prev.slice(0, -1));
      setErrorMsg('');
    }
  };

  const modalTitle = title || (
    mode === 'verify'
      ? 'Enter Security PIN'
      : (isConfirmingStep ? 'Confirm 4-Digit PIN' : 'Set 4-Digit Security PIN')
  );

  const modalSubtitle = subtitle || (
    mode === 'verify'
      ? 'Enter your PIN to access protected content'
      : (isConfirmingStep ? 'Re-enter your PIN to confirm' : 'Choose a memorable 4-digit code')
  );

  const content = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999999,
        background: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '340px',
          background: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          borderRadius: '24px',
          padding: '24px 20px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.85)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative'
        }}
      >
        {/* Close Button if allow close */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        )}

        {/* Lock Icon Emblem */}
        <div
          style={{
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(168, 85, 247, 0.25))',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px',
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)'
          }}
        >
          <Lock size={26} color="#818cf8" />
        </div>

        {/* Header Texts */}
        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', textAlign: 'center', marginBottom: '4px' }}>
          {modalTitle}
        </div>
        <div style={{ fontSize: '0.78rem', color: '#94a3b8', textAlign: 'center', marginBottom: '20px' }}>
          {modalSubtitle}
        </div>

        {/* 4-Digit PIN Indicator Dots */}
        <div
          style={{
            display: 'flex',
            gap: '14px',
            marginBottom: errorMsg ? '8px' : '20px',
            transform: isShaking ? 'translateX(-6px)' : 'none',
            transition: 'transform 0.08s ease'
          }}
        >
          {[0, 1, 2, 3].map(i => {
            const isFilled = i < pin.length;
            return (
              <div
                key={i}
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: isFilled
                    ? 'linear-gradient(135deg, #6366f1, #a855f7)'
                    : 'rgba(255, 255, 255, 0.12)',
                  border: isFilled
                    ? '2px solid #818cf8'
                    : '2px solid rgba(255, 255, 255, 0.25)',
                  boxShadow: isFilled ? '0 0 10px rgba(99, 102, 241, 0.8)' : 'none',
                  transition: 'all 0.18s ease'
                }}
              />
            );
          })}
        </div>

        {/* Error Feedback Message */}
        {errorMsg && (
          <div style={{ fontSize: '0.76rem', color: '#f87171', fontWeight: 600, marginBottom: '14px', textAlign: 'center' }}>
            {errorMsg}
          </div>
        )}

        {/* Number Keypad Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            width: '100%',
            maxWidth: '260px'
          }}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              style={{
                height: '56px',
                borderRadius: '50%',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(255, 255, 255, 0.06)',
                color: '#ffffff',
                fontSize: '1.35rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s ease',
                userSelect: 'none',
                WebkitTapHighlightColor: 'transparent'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.14)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'}
            >
              {num}
            </button>
          ))}

          {/* Empty spacer / clear */}
          <div />

          {/* 0 */}
          <button
            type="button"
            onClick={() => handleKeyPress(0)}
            style={{
              height: '56px',
              borderRadius: '50%',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(255, 255, 255, 0.06)',
              color: '#ffffff',
              fontSize: '1.35rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s ease',
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.14)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'}
          >
            0
          </button>

          {/* Backspace Delete */}
          <button
            type="button"
            onClick={handleDelete}
            style={{
              height: '56px',
              borderRadius: '50%',
              border: 'none',
              background: 'transparent',
              color: '#cbd5e1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent'
            }}
            title="Delete"
          >
            <Delete size={22} />
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}
