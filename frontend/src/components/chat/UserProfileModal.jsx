import React, { useState, useEffect, useContext } from 'react';
import { X, CheckCircle2, Phone, Video, Eye, Info, User, ShieldCheck } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { BACKEND_URL } from '../../utils/config';

export default function UserProfileModal({ targetUser, onClose, onStartCall, onOpenFullDp }) {
  const { token } = useContext(AuthContext);
  const { onlineUsers } = useContext(SocketContext);
  const [profileData, setProfileData] = useState(targetUser);
  const [loading, setLoading] = useState(false);

  const isOnline = onlineUsers.includes(targetUser.id);

  useEffect(() => {
    if (targetUser?.id) {
      setLoading(true);
      fetch(`${BACKEND_URL}/api/users/${targetUser.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data && !data.error) {
            setProfileData(prev => ({ ...prev, ...data }));
          }
        })
        .catch(err => console.error("Error fetching user profile:", err))
        .finally(() => setLoading(false));
    }
  }, [targetUser, token]);

  const userToDisplay = profileData || targetUser;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-responsive" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', overflow: 'hidden' }}>
        {/* Header Cover Banner */}
        <div style={{
          height: '110px',
          background: 'linear-gradient(135deg, var(--accent) 0%, #3b82f6 100%)',
          position: 'relative',
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '12px'
        }}>
          <button
            className="icon-btn-ghost"
            onClick={onClose}
            style={{ color: '#fff', background: 'rgba(0,0,0,0.25)', borderRadius: '50%', width: '32px', height: '32px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Profile Avatar & Details */}
        <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', marginTop: '-50px', textAlign: 'center' }}>
          {/* Avatar with Clickable Full DP trigger */}
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '0.75rem' }}>
            <img
              src={userToDisplay.avatar}
              alt={userToDisplay.displayName}
              onClick={() => onOpenFullDp(userToDisplay.avatar, userToDisplay.displayName, userToDisplay.username)}
              style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '4px solid var(--bg-card)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                cursor: 'pointer',
                transition: 'transform 0.2s ease'
              }}
              title="Click to view full screen DP"
            />
            {isOnline && (
              <div
                className="online-indicator-dot"
                style={{ width: '16px', height: '16px', border: '3px solid var(--bg-card)', bottom: '4px', right: '4px' }}
                title="Online Now"
              />
            )}
          </div>

          {/* Display Name & Verified Badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {userToDisplay.displayName}
            </h3>
            {userToDisplay.isEmailVerified && (
              <CheckCircle2 size={18} color="#10b981" title="Verified Account" />
            )}
          </div>
          <p style={{ margin: '2px 0 1rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            @{userToDisplay.username}
          </p>

          {/* Action Quick Buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <button
              className="btn-secondary"
              onClick={() => onOpenFullDp(userToDisplay.avatar, userToDisplay.displayName, userToDisplay.username)}
              style={{ flex: 1, padding: '8px 12px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <Eye size={16} /> View DP
            </button>
            {onStartCall && (
              <>
                <button
                  className="btn-secondary"
                  onClick={() => { onClose(); onStartCall(false); }}
                  style={{ flex: 1, padding: '8px 12px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Phone size={16} /> Voice
                </button>
                <button
                  className="btn-primary"
                  onClick={() => { onClose(); onStartCall(true); }}
                  style={{ flex: 1, padding: '8px 12px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Video size={16} /> Video
                </button>
              </>
            )}
          </div>

          {/* Bio / About Info Box */}
          <div style={{
            background: 'var(--bg-chat)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '1rem',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                <Info size={14} color="var(--accent)" /> About / Bio
              </div>
              <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-main)', lineHeight: 1.45, fontWeight: 500 }}>
                {userToDisplay.status || 'Hey there! I am using PulseChat.'}
              </p>
            </div>

            <div style={{ height: '1px', background: 'var(--border)' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Username:</span>
              <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>@{userToDisplay.username}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Status:</span>
              <span style={{ fontWeight: 600, color: isOnline ? '#10b981' : 'var(--text-muted)' }}>
                {isOnline ? '🟢 Online' : '⚪ Offline'}
              </span>
            </div>

            {userToDisplay.isEmailVerified && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Account Verification:</span>
                <span style={{ fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ShieldCheck size={14} /> Verified
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
