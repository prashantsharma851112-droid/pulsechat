import React, { useState, useContext, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { X, Upload, Camera, Lock, User as UserIcon, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, Sparkles, Share2, Database } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';
import { compressImage, parseSafeJson } from '../../utils/imageCompressor';
import { useBackHandler } from '../../utils/backNavigation';
import VibeAuraRing, { resolveUserAura, getProAuraRingClass } from '../common/VibeAuraRing';
import PulseHandleCardModal from './PulseHandleCardModal';
import ShareableStoryCardModal from './ShareableStoryCardModal';
import VipAuraSelectorModal from '../common/VipAuraSelectorModal';
import { updateUserProfileInStorage } from '../../utils/offlineStorage';
import { isChatBackupEnabled, setChatBackupEnabled } from '../../utils/localDatabase';

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

// =========================================================================
// ATOMIC ISOLATED PROFILE COMPONENTS (React.memo + 0ms GPU Tap Feedback)
// =========================================================================

export const ProfileTabNav = React.memo(function ProfileTabNav({ activeTab, onSelectTab }) {
  return (
    <div style={{
      display: 'flex',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-card)',
      padding: '0 8px',
      gap: '8px',
      flexShrink: 0
    }}>
      <button
        onClick={() => onSelectTab('profile')}
        title="Edit Profile"
        aria-label="Edit Profile"
        className="interactive-tap"
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
          transition: 'all 0.15s ease',
          willChange: 'transform',
          transform: 'translateZ(0)'
        }}
      >
        <UserIcon size={20} />
      </button>
      <button
        onClick={() => onSelectTab('card')}
        title="My Pulse Card"
        aria-label="My Pulse Card"
        className="interactive-tap"
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
          transition: 'all 0.15s ease',
          willChange: 'transform',
          transform: 'translateZ(0)'
        }}
      >
        <Sparkles size={20} color={activeTab === 'card' ? 'var(--accent)' : '#a855f7'} />
      </button>
    </div>
  );
});

export const PresetAvatarItem = React.memo(function PresetAvatarItem({ avUrl, isSelected, onSelect }) {
  return (
    <img
      src={avUrl}
      onClick={() => onSelect(avUrl)}
      alt="Avatar preset"
      className="interactive-tap"
      style={{
        width: '42px',
        height: '42px',
        borderRadius: '50%',
        cursor: 'pointer',
        border: isSelected ? '2.5px solid var(--accent)' : '2px solid transparent',
        background: 'var(--bg-card)',
        padding: '2px',
        transition: 'all 0.15s ease',
        willChange: 'transform',
        transform: 'translateZ(0)'
      }}
    />
  );
});

export const InstantSaveDpBanner = React.memo(function InstantSaveDpBanner({ loading, onSave }) {
  return (
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
        onClick={onSave}
        className="btn-primary interactive-tap"
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
          cursor: 'pointer',
          willChange: 'transform',
          transform: 'translateZ(0)'
        }}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
        {loading ? 'Saving DP...' : 'Save New DP Now'}
      </button>
    </div>
  );
});

export const ProfileQuickActionsRow = React.memo(function ProfileQuickActionsRow({
  onOpenAuraModal,
  onOpenStoryCard,
  onCopyNglLink,
  copiedAskToast
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      marginBottom: '1.25rem',
      width: '100%'
    }}>
      <button
        type="button"
        onClick={onOpenAuraModal}
        className="interactive-tap"
        style={{
          width: '100%',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.16), rgba(239, 68, 68, 0.22))',
          border: '1.5px solid rgba(245, 158, 11, 0.5)',
          borderRadius: '14px',
          padding: '10px 12px',
          color: '#fbbf24',
          fontSize: '0.82rem',
          fontWeight: 800,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          boxShadow: '0 4px 14px rgba(245, 158, 11, 0.18)',
          transition: 'all 0.15s ease',
          willChange: 'transform',
          transform: 'translateZ(0)'
        }}
      >
        <Sparkles size={16} color="#fbbf24" /> Customize Ring
      </button>

      <div style={{
        display: 'flex',
        gap: '8px',
        width: '100%'
      }}>
        <button
          type="button"
          onClick={onOpenStoryCard}
          className="interactive-tap"
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
            boxShadow: '0 4px 15px rgba(253, 29, 29, 0.35)',
            willChange: 'transform',
            transform: 'translateZ(0)'
          }}
        >
          <Share2 size={14} /> Insta Story Card 📸
        </button>
        <button
          type="button"
          onClick={onCopyNglLink}
          className="interactive-tap"
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
            gap: '6px',
            willChange: 'transform',
            transform: 'translateZ(0)'
          }}
        >
          <Lock size={14} /> {copiedAskToast ? 'Link Copied! 🤫' : 'Copy NGL Link 🤫'}
        </button>
      </div>
    </div>
  );
});

export const ProfileSaveSubmitButton = React.memo(function ProfileSaveSubmitButton({ loading, onSave }) {
  return (
    <button
      onClick={onSave}
      className="btn-primary interactive-tap"
      style={{
        width: '100%',
        padding: '0.8rem',
        willChange: 'transform',
        transform: 'translateZ(0)'
      }}
      disabled={loading}
    >
      {loading ? 'Saving Profile...' : 'Save Profile'}
    </button>
  );
});

// =========================================================================
// MAIN PROFILE MODAL
// =========================================================================

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
  const [showAuraModal, setShowAuraModal] = useState(false);
  const proRingClass = getProAuraRingClass(myAura, user?.isPro);

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
  const [backupEnabled, setBackupEnabled] = useState(() => isChatBackupEnabled(user?.id));

  React.useEffect(() => {
    const handleSettingChange = (e) => {
      if (e.detail?.enabled !== undefined) {
        setBackupEnabled(Boolean(e.detail.enabled));
      }
    };
    window.addEventListener('pulsechat_backup_setting_changed', handleSettingChange);
    return () => window.removeEventListener('pulsechat_backup_setting_changed', handleSettingChange);
  }, []);

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

  const handleCopyNgl = useCallback(() => {
    const askUrl = `${window.location.origin}/ask/@${user?.username}`;
    navigator.clipboard?.writeText(askUrl);
    setCopiedAskToast(true);
    setTimeout(() => setCopiedAskToast(false), 2500);
  }, [user?.username]);

  const handleSelectPresetAvatar = useCallback((url) => {
    setAvatar(url);
  }, []);

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
          <button className="icon-btn-ghost interactive-tap" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Tab Navigation (Icon-Only Minimal Bar) */}
        <ProfileTabNav activeTab={activeTab} onSelectTab={setActiveTab} />

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
                  className={`${proRingClass} ${proRingClass ? 'pro-neon-avatar-lg' : ''}`.trim()}
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
                    className="interactive-tap"
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
                      zIndex: 10,
                      willChange: 'transform',
                      transform: 'translateZ(0)'
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
                <PresetAvatarItem
                  key={avUrl}
                  avUrl={avUrl}
                  isSelected={avatar === avUrl}
                  onSelect={handleSelectPresetAvatar}
                />
              ))}
            </div>

            {/* Instant DP Save Prompt Banner when a new avatar is selected */}
            {avatar !== user?.avatar && (
              <InstantSaveDpBanner loading={loading} onSave={handleSaveProfile} />
            )}

            {/* Quick Action Buttons */}
            <ProfileQuickActionsRow
              onOpenAuraModal={() => setShowAuraModal(true)}
              onOpenStoryCard={() => setShowStoryCardModal(true)}
              onCopyNglLink={handleCopyNgl}
              copiedAskToast={copiedAskToast}
            />

            {/* Chat Backup Toggle Card */}
            <div
              onClick={() => {
                const next = !backupEnabled;
                setBackupEnabled(next);
                setChatBackupEnabled(user?.id, next);
              }}
              className="interactive-tap"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '14px',
                padding: '11px 14px',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                willChange: 'transform',
                transform: 'translateZ(0)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: backupEnabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Database size={16} color={backupEnabled ? '#10b981' : '#ef4444'} />
                </div>
                <div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Chat Backup
                    <span style={{
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      padding: '1px 5px',
                      borderRadius: '5px',
                      background: backupEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: backupEnabled ? '#10b981' : '#ef4444'
                    }}>
                      {backupEnabled ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Auto-save chats locally (Default ON)
                  </div>
                </div>
              </div>

              {/* Toggle Switch */}
              <div
                style={{
                  width: '36px',
                  height: '20px',
                  borderRadius: '10px',
                  background: backupEnabled ? '#10b981' : 'var(--border)',
                  position: 'relative',
                  transition: 'all 0.2s ease',
                  flexShrink: 0
                }}
              >
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: '#fff',
                  position: 'absolute',
                  top: '2px',
                  left: backupEnabled ? '18px' : '2px',
                  transition: 'all 0.2s ease'
                }} />
              </div>
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

            <ProfileSaveSubmitButton loading={loading} onSave={handleSaveProfile} />
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

      {/* Dedicated VIP Avatar Ring Selector Modal */}
      <VipAuraSelectorModal
        isOpen={showAuraModal}
        onClose={() => setShowAuraModal(false)}
      />
    </div>
  );
}
