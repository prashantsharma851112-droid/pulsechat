import React, { useState, useContext } from 'react';
import { ThemeContext } from '../../context/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import { X, Check, User, Plus, EyeOff, ShieldAlert, LogOut, Settings as SettingsIcon, Sparkles, Bell, Ban, Unlock, Users, ArrowRightLeft, UserCheck, Trash2 } from 'lucide-react';
import { requestNotificationPermission, showPushNotification } from '../../utils/notifications';
import { BACKEND_URL } from '../../utils/config';

const THEMES = [
  { id: 'light', name: '☀️ Light Mode (Brightness)', color: '#4f46e5' },
  { id: 'dark', name: '🌙 Dark Mode', color: '#6366f1' },
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
  onOpenFullDp
}) {
  const { theme, changeTheme } = useContext(ThemeContext);
  const { user, logout, toggleHideReadReceipts, unblockUser, token, savedAccounts, switchAccount, addAccount, removeSavedAccount } = useContext(AuthContext);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedList, setBlockedList] = useState([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

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
        style={{ maxWidth: '420px', padding: 0, overflow: 'hidden' }}
      >
        {/* Header Bar */}
        <div className="modal-header" style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SettingsIcon size={20} color="var(--accent)" />
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)' }}>Settings & Options</h3>
          </div>
          <button className="icon-btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '80vh', overflowY: 'auto' }}>
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
                    border: user?.isPro ? 'none' : '2px solid var(--accent)',
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Group Actions
            </span>

            {openCreateGroupModal && (
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
            )}
          </div>

          {/* Privacy & Modes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Notifications & Privacy
            </span>

            {/* Push Notifications Toggle / Test */}
            <div
              onClick={async () => {
                const granted = await requestNotificationPermission();
                if (granted) {
                  showPushNotification('PulseChat Notifications Active! 🔔', 'Notifications are enabled and working perfectly outside the app.');
                } else {
                  alert('Please allow notification permissions in your browser or phone app settings.');
                }
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
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bell size={18} color="var(--accent)" />
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>App Notifications (Push)</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {typeof window !== 'undefined' && window.Notification && Notification.permission === 'granted'
                      ? 'Enabled (Tap to test)'
                      : 'Tap to enable background alerts'}
                  </div>
                </div>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: typeof window !== 'undefined' && window.Notification && Notification.permission === 'granted' ? '#10b981' : 'var(--accent)' }}>
                {typeof window !== 'undefined' && window.Notification && Notification.permission === 'granted' ? 'Active ✓' : 'Enable'}
              </span>
            </div>

            {setSilentMode && (
              <div
                onClick={() => setSilentMode(!silentMode)}
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
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: silentMode ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <EyeOff size={18} color={silentMode ? '#f59e0b' : 'var(--text-muted)'} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>Incognito Silent Mode</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Hide your online status indicator</div>
                  </div>
                </div>
                <div style={{
                  width: '36px',
                  height: '20px',
                  borderRadius: '10px',
                  background: silentMode ? '#f59e0b' : 'var(--border)',
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
                    left: silentMode ? '18px' : '2px',
                    transition: 'all 0.2s ease'
                  }} />
                </div>
              </div>
            )}

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
          </div>

          {/* Color Themes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              App Theme
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {THEMES.map(t => (
                <div
                  key={t.id}
                  onClick={() => changeTheme(t.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'var(--bg-card)',
                    border: theme === t.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: t.color, border: '2px solid rgba(255,255,255,0.2)' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)' }}>{t.name}</span>
                  </div>
                  {theme === t.id && <Check size={16} color="var(--accent)" />}
                </div>
              ))}
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

          {/* Account Logout */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '4px' }}>
            <button
              onClick={() => { onClose(); logout(); }}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                fontWeight: 600,
                fontSize: '0.88rem',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <LogOut size={16} /> Logout Account
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
    </div>
  );
}

