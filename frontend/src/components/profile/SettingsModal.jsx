import React, { useState, useContext } from 'react';
import { ThemeContext } from '../../context/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import { 
  X, Check, User, Plus, EyeOff, ShieldAlert, LogOut, Settings as SettingsIcon, 
  Sparkles, Bell, BellOff, Ban, Unlock, Users, ArrowRightLeft, UserCheck, Trash2, 
  Crown, Lock, Shield, FileText, HelpCircle, RefreshCw, AlertTriangle, Loader2,
  ChevronRight, ArrowLeft, HardDrive, Palette, Info, Mail, Compass, Send, CheckCircle2, MessageSquare
} from 'lucide-react';
import { requestNotificationPermission, showPushNotification } from '../../utils/notifications';
import { BACKEND_URL } from '../../utils/config';
import PulseProModal from '../chat/PulseProModal';
import PulseVipBadge from '../common/PulseVipBadge';
import AppFeatureTourModal from '../common/AppFeatureTourModal';
import LegalModal from '../common/LegalModal';
import { useBackHandler } from '../../utils/backNavigation';

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
  const { 
    user, logout, deleteAccount, toggleHideReadReceipts, toggleHideOnlineStatus, 
    toggleAutoCleanup, runInstantCleanup, unblockUser, token, savedAccounts, 
    switchAccount, addAccount, removeSavedAccount 
  } = useContext(AuthContext);

  // Active Category Section: null (Main List) | 'notifications' | 'privacy' | 'storage' | 'themes' | 'about'
  const [activeSection, setActiveSection] = useState(null);

  // Sub-modal states
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedList, setBlockedList] = useState([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [showTourModal, setShowTourModal] = useState(false);
  const [legalViewTab, setLegalViewTab] = useState(null);

  // Storage Cleanup States
  const [cleaningStorage, setCleaningStorage] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [cleanupDays, setCleanupDays] = useState(30);

  // Notifications State
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('pulsechat_notifications_enabled') !== 'false';
  });

  // Account Permanent Deletion States (Google Play & GDPR Policy compliant)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteDetail, setDeleteDetail] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // In-App Support Message Query States
  const [supportSubject, setSupportSubject] = useState('General Query');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportEmail, setSupportEmail] = useState(user?.email || '');
  const [supportSubmitting, setSupportSubmitting] = useState(false);
  const [supportSuccessMsg, setSupportSuccessMsg] = useState('');
  const [supportError, setSupportError] = useState('');

  const handleSupportSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!supportMessage.trim()) {
      setSupportError('Please describe your query or problem before sending.');
      return;
    }
    const finalEmail = (supportEmail || user?.email || '').trim();
    if (!finalEmail) {
      setSupportError('Please provide a valid registered email address so we can reply.');
      return;
    }

    setSupportSubmitting(true);
    setSupportError('');
    setSupportSuccessMsg('');
    try {
      const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('pulsechat_token') : null);
      const res = await fetch(`${BACKEND_URL}/api/admin/support/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`
        },
        body: JSON.stringify({
          subject: supportSubject,
          message: supportMessage.trim(),
          email: finalEmail
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSupportSuccessMsg(`✅ Query submitted successfully to Admin Dashboard!\n\nOur team will review your message and reply directly to your registered email: ${finalEmail}.`);
        setSupportMessage('');
      } else {
        setSupportError(data.error || 'Failed to submit query. Please try again.');
      }
    } catch (err) {
      setSupportError('Network error submitting query. Please check your connection.');
    } finally {
      setSupportSubmitting(false);
    }
  };

  // Hardware/Swipe Back button hierarchy:
  // Sub-modals -> Active category section -> Close Settings modal
  useBackHandler(() => {
    if (legalViewTab) { setLegalViewTab(null); return; }
    if (showDeleteModal) { setShowDeleteModal(false); return; }
    if (showBlockedModal) { setShowBlockedModal(false); return; }
    if (showTourModal) { setShowTourModal(false); return; }
    if (showProModal) { setShowProModal(false); return; }
    if (activeSection) { setActiveSection(null); return; }
    onClose();
  }, true);

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
      const daysNum = Math.max(1, parseInt(cleanupDays, 10) || 30);
      const res = await runInstantCleanup(daysNum);
      if (res && res.success) {
        setCleanupResult({ 
          type: 'success', 
          msg: `Cleaned ${res.deletedCount || 0} old messages (${daysNum}+ days old) from local storage and cache!` 
        });
      } else {
        setCleanupResult({ type: 'error', msg: res?.error || 'Storage cleanup failed. Please try again.' });
      }
    } catch (e) {
      setCleanupResult({ type: 'error', msg: 'Cleanup error occurred.' });
    } finally {
      setCleaningStorage(false);
      setTimeout(() => setCleanupResult(null), 6000);
    }
  };

  const handleToggleNotifications = async () => {
    const nextState = !notificationsEnabled;
    setNotificationsEnabled(nextState);
    localStorage.setItem('pulsechat_notifications_enabled', String(nextState));

    if (nextState) {
      const granted = await requestNotificationPermission(true, token);
      if (granted) {
        showPushNotification('Notifications Enabled 🔔', 'You will receive incoming message sounds and alerts.');
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

  // Section titles mapping
  const getSectionTitle = () => {
    switch (activeSection) {
      case 'notifications': return 'Notifications';
      case 'privacy': return 'Privacy & Security';
      case 'storage': return 'Storage & Data';
      case 'themes': return 'Appearance & Themes';
      case 'about': return 'App Info & Legal';
      default: return 'Settings';
    }
  };

  const currentThemeObj = THEMES.find(t => t.id === theme) || THEMES[0];

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div
        className="modal-card modal-responsive modal-card-animated"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '440px',
          width: '95vw',
          maxHeight: '90dvh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '20px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7)'
        }}
      >
        {/* Header Bar */}
        <div 
          className="modal-header" 
          style={{ 
            padding: '1.1rem 1.4rem', 
            borderBottom: '1px solid var(--border)', 
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-card)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {activeSection ? (
              <button
                type="button"
                onClick={() => setActiveSection(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  padding: 0
                }}
                title="Back to Settings"
              >
                <ArrowLeft size={18} />
              </button>
            ) : (
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SettingsIcon size={18} color="var(--accent)" />
              </div>
            )}
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {getSectionTitle()}
            </h3>
          </div>
          <button className="icon-btn-ghost" onClick={onClose} title="Close Settings">
            <X size={20} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ padding: '1.2rem 1.3rem 2.2rem 1.3rem', display: 'flex', flexDirection: 'column', gap: '1.1rem', flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          
          {/* ==============================================================
              VIEW 0: MAIN SETTINGS MENU (Categorized Hub)
              ============================================================== */}
          {!activeSection && (
            <>
              {/* User Profile Summary Card */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(245, 158, 11, 0.08))',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '14px',
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
                        width: '50px',
                        height: '50px',
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
                      title="Click to view full photo"
                    />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user?.displayName}
                      </h4>
                      {user?.isPro && <PulseVipBadge size={14} showLabel={false} />}
                    </div>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>@{user?.username}</p>
                  </div>
                </div>

                {openProfileModal && (
                  <button
                    className="btn-secondary"
                    onClick={() => { onClose(); openProfileModal(); }}
                    style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, borderRadius: '10px' }}
                  >
                    <User size={14} color="var(--accent)" /> Edit Profile
                  </button>
                )}
              </div>

              {/* Categorized Menu List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Preferences & Tools
                </span>

                {/* 1. Notifications Category */}
                <div
                  onClick={() => setActiveSection('notifications')}
                  className="user-select-card"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: notificationsEnabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {notificationsEnabled ? <Bell size={18} color="#10b981" /> : <BellOff size={18} color="#ef4444" />}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Notifications
                        <span style={{ fontSize: '0.66rem', fontWeight: 800, padding: '1px 6px', borderRadius: '6px', background: notificationsEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: notificationsEnabled ? '#10b981' : '#ef4444' }}>
                          {notificationsEnabled ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Message alerts, push notifications & sounds
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={18} color="var(--text-muted)" />
                </div>

                {/* 2. Privacy & Security Category */}
                <div
                  onClick={() => setActiveSection('privacy')}
                  className="user-select-card"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Shield size={18} color="var(--accent)" />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        Privacy & Security
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Blue ticks, online status, blocked users, account deletion
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={18} color="var(--text-muted)" />
                </div>

                {/* 3. Storage & Data Cleanup Category */}
                <div
                  onClick={() => setActiveSection('storage')}
                  className="user-select-card"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <HardDrive size={18} color="#10b981" />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        Storage & Data Cleanup
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Auto-cleanup (keeps last 7 days) & cache cleaner
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={18} color="var(--text-muted)" />
                </div>

                {/* 4. Appearance & Themes Category */}
                <div
                  onClick={() => setActiveSection('themes')}
                  className="user-select-card"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(236, 72, 153, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Palette size={18} color="#ec4899" />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Appearance & Themes
                        <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-muted)' }}>
                          {currentThemeObj.name.split(' ')[0]}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        AMOLED, Dark, Light & VIP Pro glowing themes
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={18} color="var(--text-muted)" />
                </div>

                {/* 5. App Info & Legal Category */}
                <div
                  onClick={() => setActiveSection('about')}
                  className="user-select-card"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Info size={18} color="#38bdf8" />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        App Info, Contact & Legal
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Version, contact support, privacy policies & terms
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={18} color="var(--text-muted)" />
                </div>

                {/* App Feature Tour Direct Shortcut */}
                <div
                  onClick={() => setShowTourModal(true)}
                  className="user-select-card"
                  style={{
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.12))',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                      <Compass size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        Feature Tour Guide
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Visual guide showing all features & button locations
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={18} color="var(--accent)" />
                </div>
              </div>

              {/* Account Management & Logout */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={16} color="var(--accent)" />
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Switch Account
                    </span>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {savedAccounts?.length || 1} saved
                  </span>
                </div>

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
                          <img
                            src={acc.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${acc.username}`}
                            alt={acc.displayName}
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: isActive ? '2px solid var(--accent)' : '1px solid var(--border)'
                            }}
                          />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {acc.displayName || acc.username}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              @{acc.username}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          {isActive ? (
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)', background: 'var(--bg-card)', padding: '3px 8px', borderRadius: '8px', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', gap: '4px' }}>
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

                  <button
                    onClick={() => {
                      onClose();
                      addAccount();
                    }}
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

                {/* Logout Button */}
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
                    fontSize: '0.86rem',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    marginTop: '4px'
                  }}
                >
                  <LogOut size={16} /> Logout Account
                </button>
              </div>
            </>
          )}

          {/* ==============================================================
              VIEW 1: NOTIFICATIONS SECTION
              ============================================================== */}
          {activeSection === 'notifications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                onClick={handleToggleNotifications}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '14px',
                  padding: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: notificationsEnabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {notificationsEnabled ? <Bell size={18} color="#10b981" /> : <BellOff size={18} color="#ef4444" />}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Message Notifications
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '1px 6px', borderRadius: '6px', background: notificationsEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: notificationsEnabled ? '#10b981' : '#ef4444' }}>
                        {notificationsEnabled ? 'ENABLED' : 'MUTED'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {notificationsEnabled
                        ? 'Sound, pop-up alerts & push notifications are active'
                        : 'All notification sounds and visual popups are muted'}
                    </div>
                  </div>
                </div>

                <div style={{
                  width: '38px',
                  height: '22px',
                  borderRadius: '11px',
                  background: notificationsEnabled ? '#10b981' : 'var(--border)',
                  position: 'relative',
                  transition: 'all 0.2s ease',
                  flexShrink: 0
                }}>
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: '2px',
                    left: notificationsEnabled ? '18px' : '2px',
                    transition: 'all 0.2s ease'
                  }} />
                </div>
              </div>

              {/* Notification Details & Test Card */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border)',
                borderRadius: '14px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  When notifications are enabled, you receive instant alerts for incoming chats, group mentions, and voice/video calls even when the app is in the background.
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    const granted = await requestNotificationPermission(true, token);
                    if (granted) {
                      showPushNotification('PulseChat Test Alert 🔔', 'Your notification system is working perfectly!');
                    } else {
                      alert('Please grant notification permission in your browser or device system settings.');
                    }
                  }}
                  className="btn-secondary"
                  style={{
                    padding: '8px 14px',
                    fontSize: '0.82rem',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Bell size={14} color="var(--accent)" /> Send Test Notification Alert
                </button>
              </div>
            </div>
          )}

          {/* ==============================================================
              VIEW 2: PRIVACY & SECURITY SECTION
              ============================================================== */}
          {activeSection === 'privacy' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Hide Read Receipts (Unseen Privacy Mode) */}
              <div
                onClick={() => toggleHideReadReceipts(!user?.hideReadReceipts)}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '14px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: user?.hideReadReceipts ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <EyeOff size={18} color={user?.hideReadReceipts ? 'var(--accent)' : 'var(--text-muted)'} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Hide Read Receipts (Ghost Seen)
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Read messages without sending blue ticks or seen timestamps
                    </div>
                  </div>
                </div>
                <div style={{
                  width: '38px',
                  height: '22px',
                  borderRadius: '11px',
                  background: user?.hideReadReceipts ? 'var(--accent)' : 'var(--border)',
                  position: 'relative',
                  transition: 'all 0.2s ease',
                  flexShrink: 0
                }}>
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: '2px',
                    left: user?.hideReadReceipts ? '18px' : '2px',
                    transition: 'all 0.2s ease'
                  }} />
                </div>
              </div>

              {/* Hide Online Status (Incognito) */}
              <div
                onClick={() => {
                  if (!user?.isPro) {
                    setShowProModal(true);
                    return;
                  }
                  toggleHideOnlineStatus(!user?.hideOnlineStatus);
                }}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '14px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: user?.hideOnlineStatus ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <EyeOff size={18} color={user?.hideOnlineStatus ? '#f59e0b' : 'var(--text-muted)'} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Hide Online Status
                      <span style={{ fontSize: '0.64rem', fontWeight: 800, padding: '1px 5px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                        <Crown size={10} /> PRO
                      </span>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {user?.hideOnlineStatus
                        ? 'Your green online dot indicator is hidden from everyone'
                        : 'Hide your active online presence across all chats'}
                    </div>
                  </div>
                </div>
                <div style={{
                  width: '38px',
                  height: '22px',
                  borderRadius: '11px',
                  background: user?.hideOnlineStatus ? '#f59e0b' : 'var(--border)',
                  position: 'relative',
                  transition: 'all 0.2s ease',
                  flexShrink: 0
                }}>
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: '2px',
                    left: user?.hideOnlineStatus ? '18px' : '2px',
                    transition: 'all 0.2s ease'
                  }} />
                </div>
              </div>

              {/* Blocked Contacts Manager Button */}
              <div
                onClick={() => {
                  setShowBlockedModal(true);
                  fetchBlockedList();
                }}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '14px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Ban size={18} color="#ef4444" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>Blocked Contacts</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Manage blocked users and unblock contacts</div>
                  </div>
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', background: 'var(--hover-bg)', padding: '2px 8px', borderRadius: '12px' }}>
                  {user?.blockedUsers?.length || 0}
                </span>
              </div>

              {/* Panic Wipe Button */}
              {openPanicModal && (
                <button
                  type="button"
                  onClick={() => { onClose(); openPanicModal(); }}
                  style={{
                    width: '100%',
                    background: 'rgba(239, 68, 68, 0.08)',
                    padding: '12px 14px',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ShieldAlert size={18} color="#ef4444" />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#ef4444' }}>Panic Wipe Chats</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Immediately wipe active chats on this device</div>
                    </div>
                  </div>
                  <ChevronRight size={18} color="#ef4444" />
                </button>
              )}

              {/* Permanent Account Deletion Card */}
              <div style={{
                background: 'rgba(239, 68, 68, 0.06)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '14px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginTop: '6px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Trash2 size={16} color="#ef4444" />
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ef4444' }}>
                    Delete Account Permanently
                  </span>
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  In accordance with Google Play & privacy policies, you can permanently erase your account, all chats, and user profile data.
                </div>
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
                    marginTop: '4px',
                    padding: '8px 14px',
                    borderRadius: '10px',
                    background: '#ef4444',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={14} /> Request Permanent Account Deletion
                </button>
              </div>
            </div>
          )}

          {/* ==============================================================
              VIEW 3: STORAGE & DATA CLEANUP SECTION (Local Storage & Cache)
              ============================================================== */}
          {activeSection === 'storage' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Auto Cleanup Background Toggle */}
              <div
                onClick={() => toggleAutoCleanup(user?.autoCleanupEnabled === false)}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '14px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <RefreshCw size={18} color="#10b981" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Auto-Cleanup (Background)
                      <span style={{ fontSize: '0.66rem', fontWeight: 800, padding: '1px 6px', borderRadius: '6px', background: user?.autoCleanupEnabled !== false ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: user?.autoCleanupEnabled !== false ? '#10b981' : '#ef4444' }}>
                        {user?.autoCleanupEnabled !== false ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Keeps last 7 days safe & automatically cleans older messages and cache
                    </div>
                  </div>
                </div>
                <div style={{
                  width: '38px',
                  height: '22px',
                  borderRadius: '11px',
                  background: user?.autoCleanupEnabled !== false ? '#10b981' : 'var(--border)',
                  position: 'relative',
                  transition: 'all 0.2s ease',
                  flexShrink: 0
                }}>
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: '2px',
                    left: user?.autoCleanupEnabled !== false ? '18px' : '2px',
                    transition: 'all 0.2s ease'
                  }} />
                </div>
              </div>

              {/* Custom Storage Cleaner (User Enters Days & Cleans Storage) */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(99, 102, 241, 0.08))',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '16px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <HardDrive size={18} color="#10b981" />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Custom Storage Cleaner
                    </h4>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Purge old messages & media from local storage and cache
                    </p>
                  </div>
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  Enter the number of days below. All messages older than this threshold will be cleaned from your phone's storage and cache, freeing up space and speeding up the app.
                </div>

                {/* Days Input and Quick Chips */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    Delete messages older than (in Days):
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={cleanupDays}
                      onChange={(e) => setCleanupDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      style={{
                        width: '80px',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-main)',
                        fontWeight: 700,
                        fontSize: '0.92rem',
                        textAlign: 'center',
                        outline: 'none'
                      }}
                    />
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Days
                    </span>
                  </div>

                  {/* Preset Quick Chips */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                    {[7, 15, 30, 60, 90].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setCleanupDays(d)}
                        style={{
                          padding: '4px 10px',
                          fontSize: '0.74rem',
                          borderRadius: '8px',
                          border: cleanupDays === d ? '1px solid #10b981' : '1px solid var(--border)',
                          background: cleanupDays === d ? '#10b981' : 'rgba(255, 255, 255, 0.05)',
                          color: cleanupDays === d ? '#000' : 'var(--text-main)',
                          cursor: 'pointer',
                          fontWeight: cleanupDays === d ? 700 : 500,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {d} Days
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clean Button */}
                <button
                  type="button"
                  onClick={handleRunInstantCleanup}
                  disabled={cleaningStorage}
                  style={{
                    marginTop: '4px',
                    border: 'none',
                    outline: 'none',
                    cursor: cleaningStorage ? 'wait' : 'pointer',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    color: '#000',
                    background: '#10b981',
                    padding: '10px 16px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {cleaningStorage ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Cleaning Local Storage & Cache...</span>
                    </>
                  ) : (
                    <>
                      <HardDrive size={16} />
                      <span>Clean Storage Now ({cleanupDays}+ Days Old)</span>
                    </>
                  )}
                </button>

                {cleanupResult && (
                  <div style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: cleanupResult.type === 'success' ? '#10b981' : '#ef4444',
                    background: cleanupResult.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    border: cleanupResult.type === 'success' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
                  }}>
                    {cleanupResult.msg}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==============================================================
              VIEW 4: APPEARANCE & THEMES SECTION
              ============================================================== */}
          {activeSection === 'themes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Select an interface theme. Midnight AMOLED themes are optimized for battery saving on AMOLED / OLED mobile screens.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {THEMES.map(t => {
                  const isUserProActive = Boolean(user?.isPro && user?.proExpiresAt && new Date(user.proExpiresAt) > new Date());
                  const isLocked = t.isPro && !isUserProActive;
                  const isSelected = theme === t.id;

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
                        padding: '11px 14px',
                        borderRadius: '12px',
                        background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-card)',
                        border: isSelected ? '2px solid var(--accent)' : (t.isPro ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border)'),
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: t.color,
                          border: '2px solid rgba(255,255,255,0.3)',
                          flexShrink: 0
                        }} />
                        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {t.name}
                          {t.isPro && <Crown size={12} color="#f59e0b" />}
                        </span>
                      </div>

                      {isSelected ? (
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Check size={14} color="#fff" />
                        </div>
                      ) : isLocked ? (
                        <Lock size={15} color="#f59e0b" />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ==============================================================
              VIEW 5: APP INFO, CONTACT & LEGAL SECTION
              ============================================================== */}
          {activeSection === 'about' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* App Info Card */}
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '16px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px'
              }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.4rem', fontWeight: 800 }}>
                  ⚡
                </div>
                <h4 style={{ margin: '4px 0 0 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  PulseChat
                </h4>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Version 2.4.0 (Build 2026.10)
                </div>
                <div style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 600, marginTop: '2px' }}>
                  ● System Online & Connected
                </div>
              </div>

              {/* Direct Support Message Form */}
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <MessageSquare size={16} color="var(--accent)" />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)', display: 'block' }}>
                        Direct Support & Helpdesk
                      </span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Send a message directly to Admin Dashboard
                      </span>
                    </div>
                  </div>
                </div>

                {/* Important Notice: Response to Registered Email */}
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  fontSize: '0.78rem',
                  color: 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px'
                }}>
                  <Info size={15} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '2px' }}>
                      Official Email Response Guarantee
                    </div>
                    <div>
                      When you submit your query, our Admin will review it and send the response directly to your registered email address.
                    </div>
                  </div>
                </div>

                {/* Success Message Banner */}
                {supportSuccessMsg && (
                  <div style={{
                    padding: '12px',
                    borderRadius: '10px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    color: '#10b981',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    lineHeight: 1.4,
                    whiteSpace: 'pre-line'
                  }}>
                    {supportSuccessMsg}
                  </div>
                )}

                {/* Error Banner */}
                {supportError && (
                  <div style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#ef4444',
                    fontSize: '0.78rem',
                    fontWeight: 600
                  }}>
                    ⚠️ {supportError}
                  </div>
                )}

                {/* Form Fields */}
                <form onSubmit={handleSupportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Registered Email Confirmation */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Registered Email (where reply will be received):
                    </label>
                    <input
                      type="email"
                      value={supportEmail}
                      onChange={(e) => setSupportEmail(e.target.value)}
                      placeholder="your.registered.email@example.com"
                      required
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-main)',
                        fontSize: '0.82rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Topic / Subject Selection */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Query Topic / Category:
                    </label>
                    <select
                      value={supportSubject}
                      onChange={(e) => setSupportSubject(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-main)',
                        fontSize: '0.82rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="General Query">💬 General Query / Help</option>
                      <option value="Bug Report / App Issue">🐛 Bug Report / App Issue</option>
                      <option value="Account & Login Support">🔐 Account & Login Support</option>
                      <option value="Pulse VIP / Subscription">👑 Pulse VIP / Subscription Query</option>
                      <option value="Refund & Billing">💳 Refund & Billing</option>
                      <option value="Feature Suggestion">💡 Feature Suggestion</option>
                      <option value="Other Inquiry">📝 Other Inquiry</option>
                    </select>
                  </div>

                  {/* Message Description */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Describe your problem or question:
                    </label>
                    <textarea
                      value={supportMessage}
                      onChange={(e) => setSupportMessage(e.target.value)}
                      placeholder="Write your question, issue or feedback here in detail..."
                      rows={4}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-main)',
                        fontSize: '0.82rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                        resize: 'vertical',
                        lineHeight: 1.4
                      }}
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={supportSubmitting}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.86rem',
                      cursor: supportSubmitting ? 'not-allowed' : 'pointer',
                      opacity: supportSubmitting ? 0.7 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {supportSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Submitting to Admin Dashboard...</span>
                      </>
                    ) : (
                      <>
                        <Send size={15} />
                        <span>Submit Message to Admin</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* App Feature Tour Trigger */}
              <button
                type="button"
                onClick={() => setShowTourModal(true)}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15))',
                  border: '1px solid rgba(99, 102, 241, 0.35)',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  color: 'var(--text-main)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Compass size={18} color="var(--accent)" />
                  <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Feature Tour Guide</span>
                </div>
                <ChevronRight size={16} color="var(--accent)" />
              </button>

              {/* Legal Policies Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Legal & Compliance
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setLegalViewTab('privacy')}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-main)',
                      padding: '10px 12px',
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
                    <Shield size={14} color="#818cf8" /> Privacy Policy
                  </button>
                  <button
                    type="button"
                    onClick={() => setLegalViewTab('terms')}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-main)',
                      padding: '10px 12px',
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
                    <FileText size={14} color="#818cf8" /> Terms of Service
                  </button>
                  <button
                    type="button"
                    onClick={() => setLegalViewTab('refund')}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-main)',
                      padding: '10px 12px',
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
                    <RefreshCw size={14} color="#818cf8" /> Refund Policy
                  </button>
                  <button
                    type="button"
                    onClick={() => setLegalViewTab('contact')}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-main)',
                      padding: '10px 12px',
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
                    <HelpCircle size={14} color="#818cf8" /> Support Channel
                  </button>
                </div>
              </div>

              {/* Master Admin Dashboard (Discreetly placed inside App Info & Legal) */}
              {openAdminModal && (
                <div style={{ marginTop: '6px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => { onClose(); openAdminModal(); }}
                    className="user-select-card"
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(99, 102, 241, 0.1))',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                        <ShieldAlert size={17} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          Master Admin Dashboard
                          {user?.isAdmin && (
                            <span style={{ fontSize: '0.62rem', padding: '1px 6px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', fontWeight: 800 }}>
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          System control panel, metrics & support desk
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={17} color="#f59e0b" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ==============================================================
            SUB-MODALS (Blocked Contacts, Delete Account, Tour, VIP)
            ============================================================== */}

        {/* Blocked Contacts Sheet */}
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
            <div className="modal-header" style={{ padding: '1.2rem 1.4rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Ban size={18} color="#ef4444" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)' }}>Blocked Contacts</h3>
              </div>
              <button className="icon-btn-ghost" onClick={() => setShowBlockedModal(false)}><X size={20} /></button>
            </div>

            <div style={{ flex: 1, padding: '1.2rem 1.4rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {loadingBlocked ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0', fontSize: '0.9rem' }}>
                  Loading blocked contacts...
                </div>
              ) : blockedList.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 1rem', fontSize: '0.9rem' }}>
                  <Ban size={36} color="var(--text-muted)" style={{ margin: '0 auto 10px auto', opacity: 0.5 }} />
                  <div>No blocked contacts yet.</div>
                  <div style={{ fontSize: '0.76rem', marginTop: '4px' }}>Contacts you block will appear here.</div>
                </div>
              ) : (
                blockedList.map(contact => (
                  <div
                    key={contact.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '10px 14px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <img
                        src={contact.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.username}`}
                        alt={contact.displayName}
                        style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>{contact.displayName || contact.username}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>@{contact.username}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnblock(contact.id)}
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.78rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Unlock size={13} /> Unblock
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Permanent Account Deletion Modal Overlay */}
        {showDeleteModal && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(8px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem'
            }}
          >
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1.5px solid #ef4444',
                borderRadius: '18px',
                padding: '1.4rem',
                maxWidth: '380px',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: '0 20px 50px rgba(239, 68, 68, 0.35)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={20} color="#ef4444" />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#ef4444' }}>
                    Permanently Delete Account
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Action cannot be undone
                  </p>
                </div>
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                This will permanently delete your account, chats, and files from storage and cloud servers. Please tell us why you are deleting:
              </div>

              {/* Reason Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '5px' }}>
                  Reason for deletion: <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    'Switching to another account',
                    'Privacy & security concerns',
                    'Too many notifications / distracting',
                    'Not using the app anymore',
                    'Other reason'
                  ].map((r) => (
                    <label
                      key={r}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.76rem',
                        color: deleteReason === r ? 'var(--text-main)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '5px 8px',
                        borderRadius: '6px',
                        background: deleteReason === r ? 'rgba(239, 68, 68, 0.12)' : 'transparent',
                        border: deleteReason === r ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid transparent'
                      }}
                    >
                      <input
                        type="radio"
                        name="delete_reason"
                        value={r}
                        checked={deleteReason === r}
                        onChange={() => { setDeleteReason(r); setDeleteError(''); }}
                      />
                      <span>{r}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Confirmation Input */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                  Type <strong style={{ color: '#ef4444' }}>DELETE</strong> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => { setDeleteConfirmText(e.target.value); setDeleteError(''); }}
                  placeholder="DELETE"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border)',
                    color: '#ef4444',
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    letterSpacing: '0.05em',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {deleteError && (
                <div style={{ color: '#ef4444', fontSize: '0.74rem', fontWeight: 600 }}>
                  ⚠️ {deleteError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  disabled={isDeletingAccount}
                  onClick={() => setShowDeleteModal(false)}
                  className="btn-secondary"
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '0.82rem' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingAccount || !deleteReason || deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
                  onClick={handleDeleteAccountSubmit}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    background: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: (isDeletingAccount || !deleteReason || deleteConfirmText.trim().toUpperCase() !== 'DELETE') ? 'not-allowed' : 'pointer',
                    opacity: (isDeletingAccount || !deleteReason || deleteConfirmText.trim().toUpperCase() !== 'DELETE') ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  {isDeletingAccount ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      <span>Delete Account</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Feature Tour Modal Triggered from Settings */}
        {showTourModal && (
          <AppFeatureTourModal
            onClose={() => setShowTourModal(false)}
            onOpenPro={() => {
              setShowTourModal(false);
              setShowProModal(true);
            }}
          />
        )}

        {/* Pulse Pro / VIP Modal */}
        {showProModal && (
          <PulseProModal
            initialTab="pro"
            onClose={() => setShowProModal(false)}
          />
        )}

        {/* Legal Policies Modal (Privacy, Terms, Refund, Contact) */}
        {legalViewTab && (
          <LegalModal
            initialTab={legalViewTab}
            onClose={() => setLegalViewTab(null)}
          />
        )}
      </div>
    </div>
  );
}
