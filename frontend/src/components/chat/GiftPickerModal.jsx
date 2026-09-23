import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { X, Zap, Sparkles, Send, Plus, Loader2 } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';
import Sticker3D from '../common/Sticker3D';


const GIFTS = [
  { id: 'coffee', name: 'Coffee Chat', sparks: 10, icon: '☕', desc: 'A casual caffeine pulse' },
  { id: 'heart', name: 'Love Pulse', sparks: 20, icon: '💖', desc: 'Heartfelt appreciation' },
  { id: 'fire', name: 'Fire Energy', sparks: 25, icon: '🔥', desc: 'Lit hype & vibes' },
  { id: 'rocket', name: 'Super Rocket', sparks: 35, icon: '🚀', desc: 'Blast off support' },
  { id: 'diamond', name: 'Pulse Diamond', sparks: 50, icon: '💎', desc: 'Ultra rare appreciation' },
  { id: 'crown', name: 'Royal Crown', sparks: 100, icon: '👑', desc: 'King / Queen respect' }
];

export default function GiftPickerModal({
  chatId,
  receiverId,
  receiverName,
  isGroup,
  onClose,
  onOpenSparksStore
}) {
  const { user, token, updateUserProfile } = useContext(AuthContext);
  const [selectedGift, setSelectedGift] = useState(GIFTS[0]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const currentSparks = user?.pulseSparks ?? 50;
  const canAfford = currentSparks >= selectedGift.sparks;

  const handleSendGift = async () => {
    if (!canAfford) {
      if (onOpenSparksStore) onOpenSparksStore();
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/payments/send-gift`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          chatId,
          receiverId,
          receiverName,
          isGroup: Boolean(isGroup),
          giftId: selectedGift.id
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to beam gift');
      }

      // Update local user's balance
      if (typeof data.remainingSparks === 'number') {
        updateUserProfile({
          ...user,
          pulseSparks: data.remainingSparks
        });
      }

      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Error beaming gift');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1250 }}>
      <div
        className="modal-card modal-responsive modal-card-animated"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '440px',
          padding: 0,
          borderRadius: '22px',
          overflow: 'hidden',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(245, 158, 11, 0.15))',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>🎁</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-main)', fontWeight: 800 }}>
                Beam a Virtual Gift
              </h3>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                To: <strong style={{ color: 'var(--text-main)' }}>{receiverName || 'Chat'}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Sparks Pill */}
            <div
              onClick={onOpenSparksStore}
              title="Click to get more sparks"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                padding: '4px 10px',
                borderRadius: '16px',
                color: '#f59e0b',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              <Zap size={14} fill="#f59e0b" />
              <span>{currentSparks}</span>
              <Plus size={12} />
            </div>

            <button onClick={onClose} className="icon-btn-ghost">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div style={{
            padding: '8px 16px',
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
            fontSize: '0.8rem',
            textAlign: 'center'
          }}>
            {errorMsg}
          </div>
        )}

        {/* Gift Grid */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px'
          }}>
            {GIFTS.map((g) => {
              const isSelected = selectedGift.id === g.id;
              const affordable = currentSparks >= g.sparks;
              return (
                <div
                  key={g.id}
                  onClick={() => setSelectedGift(g)}
                  style={{
                    padding: '12px 8px',
                    borderRadius: '16px',
                    textAlign: 'center',
                    background: isSelected
                      ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(245, 158, 11, 0.15))'
                      : 'var(--hover-bg)',
                    border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    position: 'relative'
                  }}
                >
                  <div style={{ fontSize: '2rem', marginBottom: '4px' }}>
                    {g.icon}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-main)', marginBottom: '4px' }}>
                    {g.name}
                  </div>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    color: affordable ? '#f59e0b' : 'var(--text-muted)'
                  }}>
                    <Zap size={11} fill={affordable ? '#f59e0b' : 'currentColor'} /> {g.sparks}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Gift Preview Strip */}
          <div style={{
            background: 'var(--hover-bg)',
            borderRadius: '14px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'visible', flexShrink: 0, transform: 'scale(0.42)', transformOrigin: 'center center' }}>
                <Sticker3D giftId={selectedGift.id} sparkAmount={selectedGift.sparks} showFooter={false} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.86rem', color: 'var(--text-main)' }}>{selectedGift.name}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{selectedGift.desc}</div>
              </div>
            </div>
            <div style={{ fontWeight: 900, color: '#f59e0b', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Zap size={13} fill="#f59e0b" /> {selectedGift.sparks} Sparks
            </div>
          </div>

          {/* Action Button */}
          {canAfford ? (
            <button
              type="button"
              disabled={loading}
              onClick={handleSendGift}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: '14px',
                fontWeight: 800,
                fontSize: '0.92rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'linear-gradient(90deg, #6366f1, #f59e0b)'
              }}
            >
              {loading ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
              Beam {selectedGift.name} Now
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenSparksStore}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: '14px',
                fontWeight: 800,
                fontSize: '0.92rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'linear-gradient(90deg, #f59e0b, #ef4444)'
              }}
            >
              <Zap size={16} fill="#fff" />
              Need {selectedGift.sparks - currentSparks} More Sparks — Top Up
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
