import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { X, Sparkles, Check, Crown, Flame, Trash2 } from 'lucide-react';
import SparksFeaturePromptModal from './SparksFeaturePromptModal';
import { resolveUserAura } from './VibeAuraRing';
import { updateUserProfileInStorage } from '../../utils/offlineStorage';

export const VIP_AURA_OPTIONS = [
  {
    id: 'dragon_aura',
    name: 'Dragon Fury VIP',
    emoji: '🐉',
    mood: 'Dragon Fury VIP',
    auraColor: '#f59e0b',
    auraType: 'dragon_glow',
    isPro: true,
    tag: '👑 VIP Free',
    iconBg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.3), rgba(239, 68, 68, 0.3))',
    borderColor: '#f59e0b'
  },
  {
    id: 'neon_circle',
    name: 'Cyber Neon Pulse',
    emoji: '🌈',
    mood: 'Cyber Neon VIP',
    auraColor: '#a855f7',
    auraType: 'cyber_neon',
    isPro: true,
    tag: '👑 VIP Free',
    iconBg: 'linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(6, 182, 212, 0.3))',
    borderColor: '#a855f7'
  },
  {
    id: 'neon_flame',
    name: 'Neon Flame',
    emoji: '🔥',
    mood: 'Neon Flame Streak',
    auraColor: '#ff0055',
    auraType: 'neon_flame',
    isStreak: true,
    tag: '🔥 3-Day Streak',
    iconBg: 'linear-gradient(135deg, rgba(255, 0, 85, 0.3), rgba(249, 115, 22, 0.3))',
    borderColor: '#ff0055'
  }
];

export default function VipAuraSelectorModal({ isOpen, onClose }) {
  const { user, updateUserProfile } = useContext(AuthContext);
  const { socket, vibeAuras } = useContext(SocketContext);
  const [pendingTrialAura, setPendingTrialAura] = useState(null);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  if (!isOpen) return null;

  const effectiveUserId = user?._id || user?.id;
  const isUserPro = Boolean(user?.isPro && (!user?.proExpiresAt || new Date(user.proExpiresAt) > new Date()));
  const currentStreak = user?.streakCount || user?.vibeStreakCount || 0;
  const isStreakUnlocked = currentStreak >= 3;
  const myAura = resolveUserAura(user, vibeAuras);
  const activeAuraType = myAura?.auraType || user?.vibeAura?.auraType;

  const applyAuraDirectly = (auraItem, isTrial = false, trialExpiresAt = null) => {
    if (!effectiveUserId) return;
    const finalExpiresAt = isTrial ? (trialExpiresAt || (Date.now() + 5 * 60 * 1000)) : null;
    const auraData = {
      userId: effectiveUserId,
      mood: auraItem.mood || '',
      emoji: auraItem.emoji || '⚡',
      auraColor: auraItem.auraColor || '#f59e0b',
      auraType: auraItem.auraType,
      isLowBattery: false,
      batteryLevel: null,
      inGame: '',
      isTrial: Boolean(isTrial),
      trialExpiresAt: finalExpiresAt
    };

    if (isTrial) {
      try {
        localStorage.setItem('pulsechat_aura_trial', JSON.stringify({
          auraType: auraItem.auraType,
          expiresAt: finalExpiresAt
        }));
      } catch (e) {}
    } else {
      localStorage.removeItem('pulsechat_aura_trial');
    }

    if (socket) socket.emit('update_vibe_aura', auraData);
    if (typeof updateUserProfile === 'function') updateUserProfile({ ...user, vibeAura: auraData });
    try { updateUserProfileInStorage(effectiveUserId, { vibeAura: auraData }, effectiveUserId); } catch (e) {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pulsechat_user_profile_updated', {
        detail: { targetUserId: effectiveUserId, updates: { vibeAura: auraData } }
      }));
    }
    setStatusMsg({
      type: 'success',
      text: isTrial ? `✨ ${auraItem.name} 5-min trial activated!` : `✨ ${auraItem.name} activated!`
    });
  };

  const handleClearAura = () => {
    localStorage.removeItem('pulsechat_aura_trial');
    if (!effectiveUserId) return;
    const clearData = {
      userId: effectiveUserId,
      mood: '',
      emoji: '',
      auraColor: null,
      auraType: 'none',
      isLowBattery: false,
      batteryLevel: null,
      inGame: '',
      cleared: true,
      music: null
    };
    if (socket) socket.emit('update_vibe_aura', clearData);
    if (typeof updateUserProfile === 'function') updateUserProfile({ ...user, vibeAura: null });
    try { updateUserProfileInStorage(effectiveUserId, { vibeAura: null }, effectiveUserId); } catch (e) {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pulsechat_user_profile_updated', {
        detail: { targetUserId: effectiveUserId, updates: { vibeAura: null } }
      }));
    }
    setStatusMsg({
      type: 'success',
      text: 'Avatar ring removed.'
    });
  };

  const handleSelectAura = (preset) => {
    setStatusMsg({ type: '', text: '' });
    if (preset.isStreak) {
      if (!isStreakUnlocked) {
        setStatusMsg({
          type: 'error',
          text: `🔥 Neon Flame requires 3-day continuous streak (${currentStreak}/3 days).`
        });
        return;
      }
      applyAuraDirectly(preset);
      return;
    }

    if (preset.isPro && !isUserPro) {
      setPendingTrialAura(preset);
      return;
    }

    applyAuraDirectly(preset);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
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
          background: 'linear-gradient(135deg, #181528 0%, #221230 100%)',
          border: '1px solid rgba(255, 215, 0, 0.25)',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          animation: 'fadeInScale 0.2s ease-out'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="#fbbf24" />
            <span style={{ fontWeight: 800, fontSize: '1rem', color: '#fff' }}>VIP Avatar Rings</span>
          </div>
          <button
            onClick={onClose}
            className="icon-btn-ghost"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#fff'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Status Toast */}
        {statusMsg.text && (
          <div style={{
            padding: '8px 14px',
            background: statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            borderBottom: `1px solid ${statusMsg.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: statusMsg.type === 'success' ? '#10b981' : '#ef4444',
            fontSize: '0.78rem',
            fontWeight: 700,
            textAlign: 'center'
          }}>
            {statusMsg.text}
          </div>
        )}

        {/* Options List */}
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {VIP_AURA_OPTIONS.map((item) => {
            const isActive = activeAuraType === item.auraType;
            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '14px',
                  background: isActive ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.04)',
                  border: isActive ? `1.5px solid ${item.borderColor}` : '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: item.iconBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    border: `1.5px solid ${item.borderColor}`,
                    boxShadow: `0 0 10px ${item.auraColor}40`,
                    flexShrink: 0
                  }}>
                    {item.emoji}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#fff' }}>{item.name}</div>
                    <div style={{ fontSize: '0.68rem', color: item.isStreak ? '#f87171' : '#fbbf24', fontWeight: 700 }}>
                      {item.tag}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectAura(item)}
                  disabled={isActive}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '10px',
                    border: 'none',
                    background: isActive
                      ? 'rgba(16, 185, 129, 0.3)'
                      : (item.isPro && isUserPro)
                      ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                      : item.isStreak
                      ? (isStreakUnlocked ? 'linear-gradient(90deg, #ff0055, #f97316)' : 'rgba(255,255,255,0.1)')
                      : 'linear-gradient(90deg, #6366f1, #a855f7)',
                    color: isActive ? '#10b981' : (item.isStreak && !isStreakUnlocked ? 'rgba(255,255,255,0.4)' : '#fff'),
                    fontWeight: 800,
                    fontSize: '0.76rem',
                    cursor: isActive ? 'default' : (item.isStreak && !isStreakUnlocked ? 'not-allowed' : 'pointer'),
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: isActive ? 'none' : '0 2px 8px rgba(0,0,0,0.3)'
                  }}
                >
                  {isActive ? (
                    <>✓ Active</>
                  ) : item.isStreak ? (
                    isStreakUnlocked ? '🔥 Activate' : '🔒 Locked'
                  ) : isUserPro ? (
                    <>👑 Free</>
                  ) : (
                    <>⚡ 10 Sparks</>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer with Clear Ring option */}
        {activeAuraType && activeAuraType !== 'none' && (
          <div style={{ padding: '0 16px 14px 16px', display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={handleClearAura}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ef4444',
                fontSize: '0.76rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
                opacity: 0.85
              }}
            >
              <Trash2 size={13} /> Remove Active Ring
            </button>
          </div>
        )}
      </div>

      {pendingTrialAura && (
        <SparksFeaturePromptModal
          isOpen={Boolean(pendingTrialAura)}
          onClose={() => setPendingTrialAura(null)}
          featureKey="vibe_aura_trial_5m"
          featureName={`${pendingTrialAura.name} (5-Min Trial)`}
          sparksCost={10}
          icon={pendingTrialAura.emoji}
          description={`Activate 5-minute live trial of ${pendingTrialAura.name} on your avatar.`}
          onOpenProModal={() => {
            setPendingTrialAura(null);
          }}
          onSuccess={() => {
            const expiresAt = Date.now() + 5 * 60 * 1000;
            applyAuraDirectly(pendingTrialAura, true, expiresAt);
            setPendingTrialAura(null);
          }}
        />
      )}
    </div>
  );
}
