import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { X, Upload, Camera, Lock, User as UserIcon, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, Sparkles, Share2 } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';
import { compressImage, parseSafeJson } from '../../utils/imageCompressor';
import { useBackHandler } from '../../utils/backNavigation';
import VibeAuraRing, { resolveUserAura } from '../common/VibeAuraRing';
import PulseHandleCardModal from './PulseHandleCardModal';
import ShareableStoryCardModal from './ShareableStoryCardModal';
import SparksFeaturePromptModal from '../common/SparksFeaturePromptModal';
import { updateUserProfileInStorage } from '../../utils/offlineStorage';

const VIP_AURA_OPTIONS = [
  {
    id: 'dragon_aura',
    name: 'Dragon Fury VIP',
    emoji: '🐉',
    mood: 'Dragon Fury VIP',
    auraColor: '#f59e0b',
    auraType: 'dragon_glow',
    isPro: true,
    tag: 'Pulse VIP Member',
    badgeText: '👑 VIP Free',
    desc: 'Golden fiery dragon aura with mythical flicker animations',
    iconBg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(239, 68, 68, 0.25))',
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
    tag: 'Pulse VIP Member',
    badgeText: '👑 VIP Free',
    desc: 'Radiant cycling glowing multi-color neon ring',
    iconBg: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(6, 182, 212, 0.25))',
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
    tag: '3-Day Streak Only',
    badgeText: '🔥 Streak Only',
    desc: 'Pink/Neon flame ring (3-Day Streak par unlock, tootne par lock)',
    iconBg: 'linear-gradient(135deg, rgba(255, 0, 85, 0.25), rgba(249, 115, 22, 0.25))',
    borderColor: '#ff0055'
  }
];

const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=alex',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=rahul',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=sara',
  'https://api.dicebear.com/7.x/bottts/svg?seed=neon',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=cyber',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=prashant',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=shadow',
  'https://api.dicebear.com/7.x/bottts/svg?seed=glitch',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=luna',
  'https://api.dicebear.com/7.x/big-smile/svg?seed=happy',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=sam',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=blaze'
];

export default function ProfileModal({ onClose, onOpenFullDp }) {
  useBackHandler(onClose, true);
  const { user, token, updateUserProfile } = useContext(AuthContext);
  const { socket, vibeAuras } = useContext(SocketContext);
  const myAura = resolveUserAura(user, vibeAuras);
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'card'

  const effectiveUserId = user?._id || user?.id;
  const isUserPro = Boolean(user?.isPro && (!user?.proExpiresAt || new Date(user.proExpiresAt) > new Date()));
  const currentStreak = user?.streakCount || user?.vibeStreakCount || 0;
  const isStreakUnlocked = currentStreak >= 3;
  const activeAuraType = myAura?.auraType || user?.vibeAura?.auraType;

  const [pendingTrialAura, setPendingTrialAura] = useState(null);
  const [auraStatusMsg, setAuraStatusMsg] = useState({ type: '', text: '' });

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
    setAuraStatusMsg({
      type: 'success',
      text: isTrial
        ? `✨ ${auraItem.name} activated for 5-minute live trial!`
        : `✨ ${auraItem.name} activated on your Avatar!`
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
    setAuraStatusMsg({
      type: 'success',
      text: 'Avatar aura removed.'
    });
  };

  const handleSelectVipAura = (preset) => {
    if (preset.isStreak) {
      if (!isStreakUnlocked) {
        setAuraStatusMsg({
          type: 'error',
          text: `🔥 'Neon Flame' sirf continuous 3-day streak par unlock hota hai (${currentStreak}/3 days). Streak tootne par ye lock ho jayega.`
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

  // Profile Edit States
  const [displayName, setDisplayName] = useState(user.displayName);
  const [username, setUsername] = useState(user.username || '');
  const [status, setStatus] = useState(user.status || '');
  const [avatar, setAvatar] = useState(user.avatar);
  const [loading, setLoading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [showStoryCardModal, setShowStoryCardModal] = useState(false);
  const [copiedAskToast, setCopiedAskToast] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProfileError('');
    setCompressing(true);
    try {
      const compressed = await compressImage(file, 360, 360, 0.82);
      setAvatar(compressed);
    } catch (err) {
      console.warn('Image compression failed:', err);
      setProfileError(err.message || 'Failed to process selected image.');
    } finally {
      setCompressing(false);
      e.target.value = '';
    }
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    setProfileError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          username: (username || '').trim(),
          displayName: (displayName || '').trim(),
          avatar,
          status: (status || '').trim()
        })
      });
      const data = await parseSafeJson(res);
      if (res.ok && data.user) {
        updateUserProfile(data.user);
        window.dispatchEvent(new CustomEvent('pulsechat_user_profile_updated', {
          detail: {
            targetUserId: data.user.id,
            updates: {
              username: data.user.username,
              avatar: data.user.avatar,
              displayName: data.user.displayName,
              status: data.user.status,
              isPro: data.user.isPro,
              proTier: data.user.proTier,
              customBadge: data.user.customBadge,
              pulseSparks: data.user.pulseSparks
            }
          }
        }));
        onClose();
      } else {
        setProfileError(data.error || 'Failed to update profile.');
      }
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card modal-responsive"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '460px', width: '100%', maxHeight: '90dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-main)', fontWeight: 600 }}>
            Account Settings
          </h3>
          <button className="icon-btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Tab Navigation (Icon-Only Minimal Bar) */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-card)',
          padding: '0 8px',
          gap: '8px',
          flexShrink: 0
        }}>
          <button
            onClick={() => setActiveTab('profile')}
            title="Edit Profile"
            aria-label="Edit Profile"
            style={{
              flex: 1,
              padding: '11px 0',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'profile' ? '2.5px solid var(--accent)' : '2.5px solid transparent',
              color: activeTab === 'profile' ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            <UserIcon size={20} />
          </button>
          <button
            onClick={() => setActiveTab('card')}
            title="My Pulse Card"
            aria-label="My Pulse Card"
            style={{
              flex: 1,
              padding: '11px 0',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'card' ? '2.5px solid var(--accent)' : '2.5px solid transparent',
              color: activeTab === 'card' ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            <Sparkles size={20} color={activeTab === 'card' ? 'var(--accent)' : '#a855f7'} />
          </button>
        </div>

        {activeTab === 'profile' ? (
          <div style={{ padding: '1.5rem', flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {profileError && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: '#ef4444',
                padding: '8px 12px',
                borderRadius: '10px',
                fontSize: '0.85rem',
                marginBottom: '1rem'
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{profileError}</span>
              </div>
            )}

            {/* Current DP Avatar Preview with Upload Trigger */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem', position: 'relative' }}>
              <VibeAuraRing aura={myAura} size={96} hasCrown={Boolean(user?.hasKingCrown || user?.hasSilverCrown || user?.hasStreakCrown)}>
                <div
                  className={user?.isPro ? 'pro-neon-avatar pro-neon-avatar-lg' : ''}
                  style={{ position: 'relative', display: 'inline-block' }}
                >
                  {user?.hasKingCrown ? (
                    <div
                      style={{
                        position: 'absolute',
                        top: '-18px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: '1.6rem',
                        filter: 'drop-shadow(0 2px 6px rgba(245, 158, 11, 0.95))',
                        zIndex: 10,
                        pointerEvents: 'none'
                      }}
                      title="👑 #1 Gold Leaderboard King"
                    >
                      👑
                    </div>
                  ) : user?.hasSilverCrown ? (
                    <div
                      style={{
                        position: 'absolute',
                        top: '-18px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: '1.6rem',
                        filter: 'drop-shadow(0 2px 6px rgba(203, 213, 225, 0.95))',
                        zIndex: 10,
                        pointerEvents: 'none'
                      }}
                      title="👑 #2 Silver Leaderboard Champion"
                    >
                      👑
                    </div>
                  ) : user?.hasStreakCrown ? (
                    <div
                      style={{
                        position: 'absolute',
                        top: '-18px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: '1.6rem',
                        filter: 'drop-shadow(0 2px 6px rgba(239, 68, 68, 0.95))',
                        zIndex: 10,
                        pointerEvents: 'none'
                      }}
                      title="👑 7-Day Gaming Streak Crown"
                    >
                      👑
                    </div>
                  ) : null}
                  <img
                    src={avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                    alt="Current DP"
                    onClick={() => onOpenFullDp && onOpenFullDp(avatar || user.avatar, displayName || user.displayName || user.username, user.username)}
                    style={{
                      width: '96px',
                      height: '96px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: user?.hasKingCrown
                        ? '3.5px solid #fbbf24'
                        : user?.hasSilverCrown
                        ? '3.5px solid #cbd5e1'
                        : user?.hasStreakCrown
                        ? '3.5px solid #f97316'
                        : (user?.isPro ? 'none' : '3px solid var(--accent)'),
                      boxShadow: user?.isPro ? 'none' : '0 8px 20px rgba(0,0,0,0.3)',
                      cursor: 'pointer'
                    }}
                    title="Click to view full photo"
                  />
                  <label
                    htmlFor="dp-file-input"
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      background: 'var(--accent)',
                      color: '#fff',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                      zIndex: 10
                    }}
                    title="Upload Photo (Instant Compressed)"
                  >
                    {compressing ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                  </label>
                  <input
                    id="dp-file-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                </div>
              </VibeAuraRing>


              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.6rem' }}>
                {compressing ? (
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Optimizing & compressing photo...</span>
                ) : (
                  'Upload any image or pick an avatar preset below!'
                )}
              </p>
            </div>

            {/* Preset Avatars Selection */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px', marginBottom: '1.25rem', maxHeight: '110px', overflowY: 'auto', padding: '4px' }}>
              {PRESET_AVATARS.map((avUrl) => (
                <img
                  key={avUrl}
                  src={avUrl}
                  onClick={() => setAvatar(avUrl)}
                  alt="Avatar preset"
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    border: avatar === avUrl ? '2.5px solid var(--accent)' : '2px solid transparent',
                    background: 'var(--bg-card)',
                    padding: '2px',
                    transition: 'all 0.15s ease'
                  }}
                />
              ))}
            </div>

            {/* VIP Avatar Auras & Glowing Rings */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.7) 0%, rgba(49, 16, 66, 0.7) 100%)',
              border: '1.5px solid rgba(245, 158, 11, 0.35)',
              borderRadius: '16px',
              padding: '14px',
              marginBottom: '1.25rem',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={17} color="#fbbf24" />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#fff' }}>VIP Avatar Auras & Rings</div>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)' }}>
                      {isUserPro ? '👑 Pulse VIP Members get Dragon & Cyber Neon 100% Free!' : 'Free users: 10 Sparks 5-min trial • 100% Free for VIP'}
                    </div>
                  </div>
                </div>
                {activeAuraType && activeAuraType !== 'none' && (
                  <button
                    type="button"
                    onClick={handleClearAura}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '8px',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#ef4444',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Clear Ring
                  </button>
                )}
              </div>

              {auraStatusMsg.text && (
                <div style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  background: auraStatusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${auraStatusMsg.type === 'success' ? '#10b981' : '#ef4444'}`,
                  color: auraStatusMsg.type === 'success' ? '#10b981' : '#ef4444',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  marginBottom: '10px',
                  textAlign: 'center'
                }}>
                  {auraStatusMsg.text}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {VIP_AURA_OPTIONS.map((item) => {
                  const isActive = activeAuraType === item.auraType;
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: '12px',
                        background: isActive ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.05)',
                        border: isActive ? `1.5px solid ${item.borderColor}` : '1px solid rgba(255,255,255,0.1)',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: item.iconBg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.2rem',
                          border: `1.5px solid ${item.borderColor}`,
                          boxShadow: `0 0 10px ${item.auraColor}40`,
                          flexShrink: 0
                        }}>
                          {item.emoji}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#fff' }}>{item.name}</span>
                            <span style={{
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              padding: '2px 5px',
                              borderRadius: '5px',
                              background: item.isStreak ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)',
                              color: item.isStreak ? '#f87171' : '#fbbf24',
                              border: `1px solid ${item.isStreak ? '#ef444455' : '#f59e0b55'}`
                            }}>
                              {item.badgeText}
                            </span>
                            {isActive && (
                              <span style={{
                                fontSize: '0.62rem',
                                fontWeight: 800,
                                padding: '2px 5px',
                                borderRadius: '5px',
                                background: '#10b981',
                                color: '#fff'
                              }}>
                                Active Now
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.65)', marginTop: '2px' }}>
                            {item.desc}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectVipAura(item)}
                        disabled={isActive}
                        style={{
                          padding: '6px 10px',
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
                          fontWeight: 700,
                          fontSize: '0.74rem',
                          cursor: isActive ? 'default' : (item.isStreak && !isStreakUnlocked ? 'not-allowed' : 'pointer'),
                          flexShrink: 0,
                          boxShadow: isActive ? 'none' : '0 2px 8px rgba(0,0,0,0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {isActive ? (
                          <>✓ Active</>
                        ) : item.isStreak ? (
                          isStreakUnlocked ? '🔥 Activate' : '🔒 Streak Locked'
                        ) : isUserPro ? (
                          <>👑 Free Activate</>
                        ) : (
                          <>⚡ 10 Sparks Trial</>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Instant DP Save Prompt Banner when a new avatar is selected */}
            {avatar !== user?.avatar && (
              <div style={{
                marginBottom: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%)',
                border: '1.5px solid var(--accent)',
                padding: '12px 16px',
                borderRadius: '16px',
                textAlign: 'center',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)'
              }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={16} color="var(--accent)" /> New Profile Photo Selected!
                </span>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  className="btn-primary"
                  disabled={loading}
                  style={{
                    padding: '8px 22px',
                    borderRadius: '20px',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
                    cursor: 'pointer'
                  }}
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  {loading ? 'Saving DP...' : 'Save New DP Now'}
                </button>
              </div>
            )}

            {/* One-Click Viral Share Cards */}
            <div style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '1.25rem',
              width: '100%'
            }}>
              <button
                type="button"
                onClick={() => setShowStoryCardModal(true)}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '10px 8px',
                  color: '#fff',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 15px rgba(253, 29, 29, 0.35)'
                }}
              >
                <Share2 size={14} /> Insta Story Card 📸
              </button>
              <button
                type="button"
                onClick={() => {
                  const askUrl = `${window.location.origin}/ask/@${user?.username}`;
                  navigator.clipboard?.writeText(askUrl);
                  setCopiedAskToast(true);
                  setTimeout(() => setCopiedAskToast(false), 2500);
                }}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.25))',
                  border: '1.5px solid rgba(168, 85, 247, 0.5)',
                  borderRadius: '14px',
                  padding: '10px 8px',
                  color: '#c084fc',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Lock size={14} /> {copiedAskToast ? 'Link Copied! 🤫' : 'Copy NGL Link 🤫'}
              </button>
            </div>

            {/* Username Handle */}
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Username (@handle)</label>
              <input
                type="text"
                className="form-input"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="username"
              />
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Your unique handle: <strong style={{ color: 'var(--accent)' }}>@{username || 'username'}</strong>
              </div>
            </div>

            {/* Display Name */}
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Display Name</label>
              <input
                type="text"
                className="form-input"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
              />
            </div>

            {/* Status / Bio */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Status / Bio</label>
              <input
                type="text"
                className="form-input"
                value={status}
                onChange={e => setStatus(e.target.value)}
                placeholder="Available"
              />
            </div>

            <button onClick={handleSaveProfile} className="btn-primary" style={{ width: '100%', padding: '0.8rem' }} disabled={loading}>
              {loading ? 'Saving Profile...' : 'Save Profile'}
            </button>
          </div>
        ) : (
          <div style={{ padding: '0.75rem 1rem', flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', display: 'flex', justifyContent: 'center' }}>
            <PulseHandleCardModal targetUser={user} currentUser={user} embedded={true} />
          </div>
        )}
      </div>

      {showStoryCardModal && (
        <ShareableStoryCardModal
          user={user}
          onClose={() => setShowStoryCardModal(false)}
        />
      )}

      {/* Sparks Feature Prompt Modal for 5-minute Live Trial */}
      {pendingTrialAura && (
        <SparksFeaturePromptModal
          isOpen={Boolean(pendingTrialAura)}
          onClose={() => setPendingTrialAura(null)}
          featureKey="vibe_aura_trial_5m"
          featureName={`${pendingTrialAura.name} (5-Min Live Trial)`}
          sparksCost={10}
          icon={pendingTrialAura.emoji}
          description={`Apne profile avatar par 5 minute ke liye ${pendingTrialAura.name} live trial activate karein.`}
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
