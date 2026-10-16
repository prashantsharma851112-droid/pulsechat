import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { BACKEND_URL } from '../../utils/config';
import { playSound } from '../../utils/audio';
import { Zap, Crown, X, Sparkles, AlertCircle } from 'lucide-react';

export default function SparksFeaturePromptModal({
  isOpen,
  onClose,
  featureKey,
  featureName = 'VIP Pro Feature',
  sparksCost = 5,
  icon = '✨',
  description = '',
  onSuccess,
  onOpenProModal
}) {
  const { user, token, updateUserProfile } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const currentSparks = typeof user?.pulseSparks === 'number' ? user.pulseSparks : 50;
  const hasEnoughSparks = currentSparks >= sparksCost;

  const handleUnlockWithSparks = async () => {
    if (loading || !token) return;
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/sparks/use-feature`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ featureKey })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        playSound('sparkle');
        if (typeof data.balance === 'number' && updateUserProfile) {
          updateUserProfile({ ...user, pulseSparks: data.balance });
        }
        onClose();
        if (onSuccess) onSuccess();
      } else {
        playSound('pop');
        setErrorMsg(data.error || 'Failed to unlock feature');
      }
    } catch (err) {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          background: 'var(--bg-card, #0f172a)',
          borderRadius: '24px',
          border: '1.5px solid rgba(245, 158, 11, 0.45)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 25px rgba(245, 158, 11, 0.25)',
          padding: '24px 20px',
          color: 'var(--text-main, #f8fafc)',
          position: 'relative',
          overflow: 'hidden',
          animation: 'pulseModalPop 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Glow ambient background header */}
        <div
          style={{
            position: 'absolute',
            top: '-50px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '200px',
            height: '140px',
            background: 'radial-gradient(circle, rgba(245, 158, 11, 0.35) 0%, transparent 70%)',
            pointerEvents: 'none'
          }}
        />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            color: 'var(--text-muted, #94a3b8)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <X size={18} />
        </button>

        {/* Feature Icon Header */}
        <div style={{ textAlign: 'center', marginTop: '6px', marginBottom: '14px' }}>
          <div
            style={{
              width: '68px',
              height: '68px',
              borderRadius: '22px',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(236, 72, 153, 0.25))',
              border: '2px solid rgba(245, 158, 11, 0.55)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              boxShadow: '0 8px 24px rgba(245, 158, 11, 0.3)'
            }}
          >
            {icon}
          </div>
          <h3 style={{ margin: '12px 0 4px', fontSize: '1.25rem', fontWeight: 800 }}>
            {featureName}
          </h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)', lineHeight: 1.4 }}>
            {description || 'Free for Pulse Pro subscribers, or unlock now with Sparks!'}
          </p>
        </div>

        {/* Sparks Balance Pill */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={18} color="#f59e0b" fill="#f59e0b" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Your Balance:</span>
          </div>
          <span style={{ fontSize: '1rem', fontWeight: 800, color: '#f59e0b' }}>
            {currentSparks} Sparks
          </span>
        </div>

        {errorMsg && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '12px',
              padding: '8px 12px',
              marginBottom: '14px',
              color: '#fca5a5',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <AlertCircle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {hasEnoughSparks ? (
            <button
              type="button"
              onClick={handleUnlockWithSparks}
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                border: 'none',
                color: '#fff',
                fontSize: '0.98rem',
                fontWeight: 700,
                cursor: loading ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 6px 20px rgba(245, 158, 11, 0.4)',
                opacity: loading ? 0.7 : 1,
                transition: 'transform 0.15s ease'
              }}
            >
              <Zap size={18} fill="#fff" />
              {loading ? 'Unlocking...' : `Unlock for ${sparksCost} Sparks ⚡`}
            </button>
          ) : (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '14px',
                padding: '10px',
                textAlign: 'center',
                fontSize: '0.82rem',
                color: '#f87171'
              }}
            >
              ⚠️ Need {sparksCost} Sparks (Short by {sparksCost - currentSparks} Sparks)
            </div>
          )}

          {/* Pulse Pro Option */}
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onOpenProModal) onOpenProModal();
            }}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(236, 72, 153, 0.25))',
              border: '1.5px solid rgba(168, 85, 247, 0.5)',
              color: '#f8fafc',
              fontSize: '0.92rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Crown size={17} color="#ec4899" />
            Get Pulse Pro (Unlimited Access)
          </button>
        </div>
      </div>
    </div>
  );
}
