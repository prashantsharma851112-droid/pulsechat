import React, { useState, useContext } from 'react';
import { ThemeContext } from '../../context/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import { X, Check, User, Plus, EyeOff, ShieldAlert, LogOut, Settings as SettingsIcon, Sparkles, Bell, BellOff, Ban, Unlock, Users, ArrowRightLeft, UserCheck, Trash2, Crown, Lock, Shield, FileText, HelpCircle, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { requestNotificationPermission, showPushNotification } from '../../utils/notifications';
import { BACKEND_URL } from '../../utils/config';
import PulseProModal from '../chat/PulseProModal';

const THEMES = [
  { id: 'midnight_amoled', name: '🖤 Midnight AMOLED (Default)', color: '#000000', isPro: false },
  { id: 'dark', name: '🌙 Midnight Dark', color: '#6366f1' },
  { id: 'light', name: '☀️ Light Mode (Brightness)', color: '#4f46e5' },
  { id: 'aurora_borealis', name: '🌌 Aurora Borealis', color: '#00f2fe', isPro: true },
  { id: 'blood_moon', name: '🩸 Blood Moon', color: '#ff1744', isPro: true },
  { id: 'tokyo_synth', name: '🌆 Tokyo Synthwave', color: '#f72585', isPro: true },
  { id: 'royal_gold', name: '👑 Royal Gold Aura', color: '#f59e0b', isPro: true },
  { id: 'nebula', name: '🔮 Cosmic Nebula', color: '#a855f7', isPro: true },
  { id: 'cyber_glow', name: '⚡ Cyber Pulse', color: '#06b6d4', isPro: true },
  { id: 'emerald', name: '🌿 Emerald Pulse', color: '#10b981' },
  { id: 'neon', name: '⚡ Cyberpunk Neon', color: '#ec4899' },
  { id: 'sunset', name: '🌅 Sunset Rose', color: '#f43f5e' }
];

export default function SettingsModal({
  onClose,
  openProfileModal,
  openCreateGroupModal,
  silentMode,
  setSilentMode,
  openPanicModal,
  onOpenFullDp,
  openAdminModal
}) {
  const { theme, changeTheme } = useContext(ThemeContext);
  const { user, logout, deleteAccount, toggleHideReadReceipts, toggleHideOnlineStatus, toggleAutoCleanup, runInstantCleanup, unblockUser, token, savedAccounts, switchAccount, addAccount, removeSavedAccount } = useContext(AuthContext);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedList, setBlockedList] = useState([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [cleaningStorage, setCleaningStorage] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [cleanupDays, setCleanupDays] = useState(7);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('pulsechat_notifications_enabled') !== 'false';
  });

  // Account Permanent Deletion States (GDPR & Google Play Policy Section 5)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteDetail, setDeleteDetail] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleDeleteAccountSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!deleteReason) {
      setDeleteError('Please choose a reason for deleting your account.');
      return;
    }
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      setDeleteError('Please type "DELETE" in capital letters to confirm.');
      return;
    }
    setIsDeletingAccount(true);
    setDeleteError('');
    try {
      const res = await deleteAccount({
        reason: deleteReason,
        reasonDetail: deleteDetail.trim(),
        confirmation: deleteConfirmText.trim()
      });
      if (res && res.success) {
        setShowDeleteModal(false);
        onClose();
        alert('Your account and all associated data have been permanently deleted.');
      } else {
        setDeleteError(res?.error || 'Failed to delete account. Please try again.');
      }
    } catch (err) {
      setDeleteError(err.message || 'An error occurred while deleting your account.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleRunInstantCleanup = async () => {
    if (cleaningStorage) return;
    setCleaningStorage(true);
    setCleanupResult(null);
    try {
      const res = await runInstantCleanup(cleanupDays);
      if (res && res.success) {
        setCleanupResult({ type: 'success', msg: `Cleaned ${res.deletedCount} msgs (${cleanupDays}+ d)!` });
      } else {
        setCleanupResult({ type: 'error', msg: 'Cleanup failed.' });
      }
    } catch (e) {
      setCleanupResult({ type: 'error', msg: 'Cleanup error.' });
    } finally {
      setCleaningStorage(false);
      setTimeout(() => setCleanupResult(null), 5000);
    }
  };

  const handleToggleNotifications = async () => {
    const nextState = !notificationsEnabled;
    setNotificationsEnabled(nextState);
    localStorage.setItem('pulsechat_notifications_enabled', String(nextState));

    if (nextState) {
      const granted = await requestNotificationPermission(true, token);
      if (granted) {
        showPushNotification('Notifications Enabled 🔔', 'You will now receive message sounds and alerts.');
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pulsechat_notifications_toggled', { detail: { enabled: nextState } }));
    }
  };

  const fetchBlockedList = async () => {
    if (!token) return;
    setLoadingBlocked(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/users/blocked`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setBlockedList(data);
    } catch (e) {
      console.error("Failed to fetch blocked users:", e);
    } finally {
      setLoadingBlocked(false);
    }
  };

  const handleUnblock = async (targetId) => {
    await unblockUser(targetId);
    setBlockedList(prev => prev.filter(u => u.id !== targetId));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card modal-responsive modal-card-animated"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '420px', width: '100%', maxHeight: '90dvh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
      >
        {/* Header Bar */}
        <div className="modal-header" style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SettingsIcon size={20} color="var(--accent)" />
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)' }}>Settings & Options</h3>
          </div>
          <button className="icon-btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ padding: '1.25rem 1.5rem 2.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {/* User Profile Summary Card */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              <div
                className={user?.isPro ? 'pro-neon-avatar' : ''}
                style={{ position: 'relative', flexShrink: 0, display: 'inline-flex' }}
              >
                {user?.hasKingCrown ? (
                  <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', fontSize: '1.1rem', filter: 'drop-shadow(0 2px 5px rgba(245, 158, 11, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 #1 Gold Leaderboard King">👑</div>
                ) : user?.hasSilverCrown ? (
                  <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', fontSize: '1.1rem', filter: 'drop-shadow(0 2px 5px rgba(203, 213, 225, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 #2 Silver Leaderboard Champion">👑</div>
                ) : user?.hasStreakCrown ? (
                  <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', fontSize: '1.1rem', filter: 'drop-shadow(0 2px 5px rgba(239, 68, 68, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 7-Day Gaming Streak Crown">👑</div>
                ) : null}
                <img
                  src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`}
                  alt="DP"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenFullDp && onOpenFullDp(user?.avatar, user?.displayName || user?.username, user?.username);
                  }}
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: user?.hasKingCrown
                      ? '2.5px solid #fbbf24'
                      : user?.hasSilverCrown
                      ? '2.5px solid #cbd5e1'
                      : user?.hasStreakCrown
                      ? '2.5px solid #f97316'
                      : (user?.isPro ? 'none' : '2px solid var(--accent)'),
                    cursor: 'pointer'
                  }}
                  title="Click to view full profile photo"
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.displayName}
                </h4>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>@{user?.username}</p>
              </div>
            </div>

            {openProfileModal && (
              <button
                className="btn-secondary"
                onClick={() => { onClose(); openProfileModal(); }}
                style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}
              >
                <User size={14} color="var(--accent)" /> Edit Profile
              </button>
            )}
          </div>

          {/* Quick Actions */}
          {openCreateGroupModal && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                className="user-select-card"
                onClick={() => { onClose(); openCreateGroupModal(); }}
                style={{ width: '100%', background: 'var(--bg-card)', padding: '12px 14px', border: '1px solid var(--border)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Plus size={18} color="var(--accent)" />
                  </div>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>Create New Group</span>
                </div>
              </button>
            </div>
          )}

          {/* Privacy & Modes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Notifications & Privacy
            </span>

            {/* Notification ON / OFF Toggle Switch */}
            <div
              onClick={handleToggleNotifications}
              className="user-select-card"
              style={{
                width: '100%',
                background: 'var(--bg-card)',
                padding: '12px 14px',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: notificationsEnabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {notificationsEnabled ? (
                    <Bell size={18} color="#10b981" />
                  ) : (
                    <BellOff size={18} color="#ef4444" />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Message Notifications</span>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: '8px',
                      background: notificationsEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: notificationsEnabled ? '#10b981' : '#ef4444'
                    }}>
                      {notificationsEnabled ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {notificationsEnabled
                      ? 'Alerts, push notifications & audio enabled'
                      : 'All notification alerts & sounds are disabled (Muted)'}
                  </div>
                </div>
              </div>
              <div style={{
                width: '36px',
                height: '20px',
                borderRadius: '10px',
                background: notificationsEnabled ? '#10b981' : 'var(--border)',
                position: 'relative',
                transition: 'all 0.2s ease'
              }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: '#fff',
                  position: 'absolute',
                  top: '2px',
                  left: notificationsEnabled ? '18px' : '2px',
                  transition: 'all 0.2s ease'
                }} />
              </div>
            </div>

            {/* Hide Online Status (Incognito / Online Dot Privacy) */}
            <div
              onClick={() => {
                if (!user?.isPro) {
                  setShowProModal(true);
                  return;
                }
                toggleHideOnlineStatus(!user?.hideOnlineStatus);
              }}
              className="user-select-card"
              style={{
                width: '100%',
                background: 'var(--bg-card)',
                padding: '12px 14px',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: user?.hideOnlineStatus ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <EyeOff size={18} color={user?.hideOnlineStatus ? '#f59e0b' : 'var(--text-muted)'} />
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Hide Online Status</span>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 900,
                      padding: '1px 6px',
                      borderRadius: '8px',
                      background: 'rgba(245, 158, 11, 0.2)',
                      color: '#f59e0b',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px'
                    }}>
                      <Crown size={11} /> PRO
                    </span>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: '8px',
                      background: user?.hideOnlineStatus ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                      color: user?.hideOnlineStatus ? '#f59e0b' : '#10b981'
                    }}>
                      {user?.hideOnlineStatus ? 'HIDDEN' : 'VISIBLE'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {user?.hideOnlineStatus
                      ? 'Your green online dot indicator is hidden from everyone'
                      : 'VIP Pro: Hide green dot indicator from everyone'}
                  </div>
                </div>
              </div>
              <div style={{
                width: '36px',
                height: '20px',
                borderRadius: '10px',
                background: user?.hideOnlineStatus ? '#f59e0b' : 'var(--border)',
                position: 'relative',
                transition: 'all 0.2s ease'
              }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: '#fff',
                  position: 'absolute',
                  top: '2px',
                  left: user?.hideOnlineStatus ? '18px' : '2px',
                  transition: 'all 0.2s ease'
                }} />
              </div>
            </div>

            {/* Unseen Privacy Mode (Ghost Seen) */}
            <div
              onClick={() => toggleHideReadReceipts(!user?.hideReadReceipts)}
              className="user-select-card"
              style={{
                width: '100%',
                background: 'var(--bg-card)',
                padding: '12px 14px',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: user?.hideReadReceipts ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <EyeOff size={18} color={user?.hideReadReceipts ? 'var(--accent)' : 'var(--text-muted)'} />
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>Unseen Privacy Mode (Ghost Seen)</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Read messages without sending blue ticks or seen status</div>
                </div>
              </div>
              <div style={{
                width: '36px',
                height: '20px',
                borderRadius: '10px',
                background: user?.hideReadReceipts ? 'var(--accent)' : 'var(--border)',
                position: 'relative',
                transition: 'all 0.2s ease'
              }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: '#fff',
                  position: 'absolute',
                  top: '2px',
                  left: user?.hideReadReceipts ? '18px' : '2px',
                  transition: 'all 0.2s ease'
                }} />
              </div>
            </div>

            {/* Auto-Cleanup Old Chats Toggle Switch (MongoDB 500MB Saver) */}
            <div
              onClick={() => toggleAutoCleanup && toggleAutoCleanup(user?.autoCleanupEnabled === false ? true : false)}
              className="user-select-card"
              style={{
                width: '100%',
                background: 'var(--bg-card)',
                padding: '12px 14px',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: user?.autoCleanupEnabled !== false ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Trash2 size={18} color={user?.autoCleanupEnabled !== false ? '#10b981' : '#ef4444'} />
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Auto-Cleanup Old Chats</span>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: '8px',
                      background: user?.autoCleanupEnabled !== false ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: user?.autoCleanupEnabled !== false ? '#10b981' : '#ef4444'
                    }}>
                      {user?.autoCleanupEnabled !== false ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {user?.autoCleanupEnabled !== false
                      ? 'Auto-delete read chats older than 7 days'
                      : 'Disabled: Old chat history will be kept permanently'}
                  </div>
                </div>
              </div>
              <div style={{
                width: '36px',
                height: '20px',
                borderRadius: '10px',
                background: user?.autoCleanupEnabled !== false ? '#10b981' : 'var(--border)',
                position: 'relative',
                transition: 'all 0.2s ease'
              }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: '#fff',
                  position: 'absolute',
                  top: '2px',
                  left: user?.autoCleanupEnabled !== false ? '18px' : '2px',
                  transition: 'all 0.2s ease'
                }} />
              </div>
            </div>

            {/* Run Instant Storage Cleanup Card with Day Selection */}
            <div
              className="user-select-card"
              style={{
                width: '100%',
                background: 'rgba(99, 102, 241, 0.08)',
                padding: '12px 14px',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={18} color="var(--accent)" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      Run Instant Storage Cleanup
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {cleaningStorage ? `🧹 Purging messages older than ${cleanupDays} days...` : `Purge read messages older than ${cleanupDays} days`}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRunInstantCleanup}
                  disabled={cleaningStorage}
                  style={{
                    border: 'none',
                    outline: 'none',
                    cursor: cleaningStorage ? 'wait' : 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#fff',
                    background: 'var(--accent)',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
                  }}
                >
                  {cleaningStorage ? 'Cleaning...' : '⚡ Clean Now'}
                </button>
              </div>

              {/* Day Selection Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', paddingTop: '2px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginRight: '2px' }}>
                  Select History Threshold:
                </span>
                {[7, 15, 30, 60, 90].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCleanupDays(d);
                    }}
                    style={{
                      padding: '2px 8px',
                      fontSize: '0.72rem',
                      borderRadius: '6px',
                      border: cleanupDays === d ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: cleanupDays === d ? 'var(--accent)' : 'var(--bg-card)',
                      color: cleanupDays === d ? '#fff' : 'var(--text-main)',
                      cursor: 'pointer',
                      fontWeight: cleanupDays === d ? 700 : 500,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {d} Days
                  </button>
                ))}
              </div>

              {cleanupResult && (
                <div style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: cleanupResult.type === 'success' ? '#10b981' : '#ef4444',
                  background: cleanupResult.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  textAlign: 'center'
                }}>
                  {cleanupResult.msg}
                </div>
              )}
            </div>

            {/* App Feature Tour / Walkthrough */}
            <div
              onClick={() => {
                window.dispatchEvent(new CustomEvent('pulsechat_open_onboarding'));
                onClose();
              }}
              className="user-select-card"
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.12))',
                padding: '12px 14px',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <Sparkles size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>App Features Walkthrough Tour</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Step-by-step guide to all PulseChat features & where to use them
                  </div>
                </div>
              </div>
              <ArrowRightLeft size={16} color="var(--accent)" />
            </div>

            {/* Blocked Contacts Manager Button */}
            <div
              onClick={() => {
                setShowBlockedModal(true);
                fetchBlockedList();
              }}
              className="user-select-card"
              style={{
                width: '100%',
                background: 'var(--bg-card)',
                padding: '12px 14px',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Ban size={18} color="#ef4444" />
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>Blocked Contacts</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Manage blocked users and unblock contacts</div>
                </div>
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--hover-bg)', padding: '2px 8px', borderRadius: '12px' }}>
                {user?.blockedUsers?.length || 0}
              </span>
            </div>

            {openPanicModal && (
              <button
                className="user-select-card"
                onClick={() => { onClose(); openPanicModal(); }}
                style={{ width: '100%', background: 'rgba(239, 68, 68, 0.08)', padding: '12px 14px', border: '1px solid rgba(239, 68, 68, 0.2)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShieldAlert size={18} color="#ef4444" />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#ef4444' }}>Panic Wipe Chats</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Immediately clear active conversations</div>
                  </div>
                </div>
              </button>
            )}

            {openAdminModal && (
              <button
                className="user-select-card"
                onClick={() => { onClose(); openAdminModal(); }}
                style={{ width: '100%', background: 'rgba(99, 102, 241, 0.1)', padding: '12px 14px', border: '1px solid rgba(99, 102, 241, 0.3)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShieldAlert size={18} color="var(--accent)" />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Master Admin Dashboard
                      {user?.isAdmin && <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', fontWeight: 800 }}>ACTIVE</span>}
                    </div>
                  </div>
                </div>
              </button>
            )}
          </div>

          {/* Color Themes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              App Theme
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {THEMES.map(t => {
                const isUserProActive = Boolean(user?.isPro && user?.proExpiresAt && new Date(user.proExpiresAt) > new Date());
                const isLocked = t.isPro && !isUserProActive;
                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      if (isLocked) {
                        setShowProModal(true);
                        return;
                      }
                      changeTheme(t.id);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: 'var(--bg-card)',
                      border: theme === t.id ? '2px solid var(--accent)' : (t.isPro ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border)'),
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: t.color, border: '2px solid rgba(255,255,255,0.2)' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {t.name}
                        {t.isPro && <Crown size={12} color="#f59e0b" />}
                      </span>
                    </div>
                    {theme === t.id ? (
                      <Check size={16} color="var(--accent)" />
                    ) : isLocked ? (
                      <Lock size={14} color="#f59e0b" />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Account Switcher Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={16} color="var(--accent)" />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Switch Account
                </span>
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {savedAccounts?.length || 1} saved
              </span>
            </div>

            {/* List of saved accounts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(savedAccounts && savedAccounts.length > 0 ? savedAccounts : [{
                id: user?.id,
                username: user?.username,
                displayName: user?.displayName || user?.username,
                avatar: user?.avatar || ''
              }]).map(acc => {
                const isActive = acc.id === user?.id || acc.username === user?.username;
                return (
                  <div
                    key={acc.id || acc.username}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '12px',
                      background: isActive ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-card)',
                      border: isActive ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                      gap: '10px'
                    }}
                  >
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1, cursor: isActive ? 'default' : 'pointer' }}
                      onClick={() => {
                        if (!isActive) {
                          switchAccount(acc.id);
                          onClose();
                        }
                      }}
                    >
                      <div
                        className={acc.isPro ? 'pro-neon-avatar' : ''}
                        style={{ position: 'relative', flexShrink: 0, display: 'inline-flex' }}
                      >
                        <img
                          src={acc.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${acc.username}`}
                          alt={acc.displayName}
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: acc.isPro ? 'none' : (isActive ? '2px solid var(--accent)' : '1px solid var(--border)')
                          }}
                        />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {acc.displayName || acc.username}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          @{acc.username}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {isActive ? (
                        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--accent)', background: 'var(--bg-card)', padding: '3px 8px', borderRadius: '8px', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Check size={12} /> Active
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            switchAccount(acc.id);
                            onClose();
                          }}
                          className="btn-primary"
                          style={{ padding: '4px 10px', fontSize: '0.76rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <ArrowRightLeft size={12} /> Switch
                        </button>
                      )}

                      {!isActive && savedAccounts?.length > 1 && (
                        <button
                          onClick={() => removeSavedAccount(acc.id)}
                          title="Remove saved account"
                          className="icon-btn-ghost"
                          style={{ padding: '4px', color: 'var(--text-muted)', borderRadius: '6px' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Add Another Account Button */}
              <button
                onClick={() => {
                  onClose();
                  addAccount();
                }}
                className="user-select-card"
                style={{
                  width: '100%',
                  background: 'var(--bg-card)',
                  padding: '10px 12px',
                  border: '1px dashed var(--accent)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  color: 'var(--accent)',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  cursor: 'pointer'
                }}
              >
                <Plus size={16} /> Add / Log in Another Account
              </button>
            </div>
          </div>

          {/* Legal & Compliance Center */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '4px' }}>
            <span className="settings-section-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <Shield size={15} color="#818cf8" /> Legal & Policies
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('pulsechat_open_legal', { detail: { tab: 'privacy' } }))}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-main)',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Shield size={13} color="#818cf8" /> Privacy Policy
              </button>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('pulsechat_open_legal', { detail: { tab: 'terms' } }))}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-main)',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <FileText size={13} color="#818cf8" /> Terms of Service
              </button>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('pulsechat_open_legal', { detail: { tab: 'refund' } }))}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-main)',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <RefreshCw size={13} color="#818cf8" /> Refund Policy
              </button>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('pulsechat_open_legal', { detail: { tab: 'contact' } }))}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-main)',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <HelpCircle size={13} color="#818cf8" /> Support & Contact
              </button>
            </div>
          </div>

          {/* Account Actions: Logout & Permanent Deletion (Privacy Policy Section 5) */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              type="button"
              onClick={() => { onClose(); logout(); }}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-main)',
                fontWeight: 600,
                fontSize: '0.88rem',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}
            >
              <LogOut size={16} /> Logout Account
            </button>

            <button
              type="button"
              onClick={() => {
                setDeleteReason('');
                setDeleteDetail('');
                setDeleteConfirmText('');
                setDeleteError('');
                setShowDeleteModal(true);
              }}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                fontWeight: 600,
                fontSize: '0.88rem',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Trash2 size={16} /> Permanently Delete Account
            </button>
          </div>
        </div>

        {/* Blocked Contacts Sub-Modal Overlay */}
        {showBlockedModal && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'var(--bg-card)',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div className="modal-header" style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Ban size={20} color="#ef4444" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)' }}>Blocked Contacts</h3>
              </div>
              <button className="icon-btn-ghost" onClick={() => setShowBlockedModal(false)}><X size={20} /></button>
            </div>

            <div style={{ flex: 1, padding: '1.25rem 1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {loadingBlocked ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0', fontSize: '0.9rem' }}>
                  Loading blocked contacts...
                </div>
              ) : blockedList.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 1rem', fontSize: '0.9rem' }}>
                  <Ban size={36} color="var(--text-muted)" style={{ margin: '0 auto 10px auto', opacity: 0.5 }} />
                  <div>No blocked contacts yet.</div>
                  <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>Contacts you block will appear here.</div>
                </div>
              ) : (
                blockedList.map(contact => (
                  <div
                    key={contact.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--bg-chat)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '10px 14px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <img
                        src={contact.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.username}`}
                        alt="DP"
                        style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {contact.displayName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{contact.username}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleUnblock(contact.id)}
                      className="btn-secondary"
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: 'var(--accent)',
                        borderColor: 'var(--accent)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        flexShrink: 0
                      }}
                    >
                      <Unlock size={14} /> Unblock
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Permanent Account Deletion Modal (Privacy Policy & Play Store Compliant) */}
      {showDeleteModal && (
        <div
          className="modal-overlay"
          style={{ zIndex: 99999 }}
          onClick={() => !isDeletingAccount && setShowDeleteModal(false)}
        >
          <div
            className="modal-card modal-responsive"
            style={{
              maxWidth: '460px',
              width: '92vw',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              borderRadius: '20px',
              background: 'var(--bg-card)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444'
                }}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 700, color: '#ef4444' }}>
                    Permanently Delete Account
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Privacy Policy Section 5: User Rights
                  </span>
                </div>
              </div>
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={() => setShowDeleteModal(false)}
                className="icon-btn-ghost"
                style={{ width: '32px', height: '32px', borderRadius: '50%' }}
              >
                <X size={17} />
              </button>
            </div>

            {/* Warning Text */}
            <div style={{
              padding: '12px',
              borderRadius: '12px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              fontSize: '0.8rem',
              color: 'var(--text-main)',
              lineHeight: 1.5
            }}>
              ⚠️ <strong>Warning:</strong> Closing your account is immediate and permanent. All your chats, messages, friendships, and account records will be permanently wiped. This action cannot be reversed.
            </div>

            {/* Reason Selection Form */}
            <form onSubmit={handleDeleteAccountSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Please tell us why you are deleting your account: <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    'I am switching to another messaging app',
                    'Privacy or security concerns',
                    'Facing technical issues or bugs in the app',
                    'Too many notifications / Taking a break',
                    'Creating a new / fresh account',
                    'Other personal reasons'
                  ].map((r) => (
                    <label
                      key={r}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        background: deleteReason === r ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                        border: deleteReason === r ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid var(--border)',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        color: deleteReason === r ? '#fff' : 'var(--text-muted)'
                      }}
                    >
                      <input
                        type="radio"
                        name="deleteReason"
                        value={r}
                        checked={deleteReason === r}
                        onChange={() => { setDeleteReason(r); setDeleteError(''); }}
                        style={{ accentColor: '#ef4444' }}
                      />
                      <span>{r}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Optional detail */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '5px' }}>
                  Additional Feedback (Optional):
                </label>
                <textarea
                  value={deleteDetail}
                  onChange={(e) => setDeleteDetail(e.target.value)}
                  placeholder="Tell us what we could improve (optional)..."
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-main)',
                    fontSize: '0.8rem',
                    resize: 'none',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Confirmation Input */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '5px' }}>
                  To confirm, type <strong style={{ color: '#ef4444' }}>DELETE</strong> in the box below:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => { setDeleteConfirmText(e.target.value); setDeleteError(''); }}
                  placeholder="DELETE"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border)',
                    color: '#ef4444',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    letterSpacing: '0.05em',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Error Notification */}
              {deleteError && (
                <div style={{ color: '#ef4444', fontSize: '0.78rem', fontWeight: 600 }}>
                  ⚠️ {deleteError}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  disabled={isDeletingAccount}
                  onClick={() => setShowDeleteModal(false)}
                  className="btn-secondary"
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeletingAccount || !deleteReason || deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '10px',
                    background: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: (isDeletingAccount || !deleteReason || deleteConfirmText.trim().toUpperCase() !== 'DELETE') ? 'not-allowed' : 'pointer',
                    opacity: (isDeletingAccount || !deleteReason || deleteConfirmText.trim().toUpperCase() !== 'DELETE') ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)'
                  }}
                >
                  {isDeletingAccount ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      <span>Delete My Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showProModal && (
        <PulseProModal
          initialTab="pro"
          onClose={() => setShowProModal(false)}
        />
      )}
    </div>
  );
}

