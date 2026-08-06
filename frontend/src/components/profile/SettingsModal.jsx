import React, { useContext } from 'react';
import { ThemeContext } from '../../context/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import { X, Check, User, Plus, EyeOff, ShieldAlert, LogOut, Settings as SettingsIcon, Sparkles } from 'lucide-react';

const THEMES = [
  { id: 'dark', name: '🌙 Dark Mode', color: '#6366f1' },
  { id: 'light', name: '☀️ Light Mode', color: '#4f46e5' },
  { id: 'emerald', name: '💬 Emerald Green (WhatsApp)', color: '#10b981' },
  { id: 'neon', name: '⚡ Cyberpunk Neon', color: '#ec4899' },
  { id: 'sunset', name: '🌅 Sunset Rose', color: '#f43f5e' }
];

export default function SettingsModal({
  onClose,
  openProfileModal,
  openCreateGroupModal,
  silentMode,
  setSilentMode,
  openPanicModal
}) {
  const { theme, changeTheme } = useContext(ThemeContext);
  const { user, logout } = useContext(AuthContext);

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
              <img
                src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`}
                alt="DP"
                style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent)' }}
              />
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
              Privacy & Security
            </span>

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
      </div>
    </div>
  );
}

