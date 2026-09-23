import React, { useState, useEffect, useContext } from 'react';
import { X, CheckCircle2, Phone, Video, Eye, Info, User, ShieldCheck, Clock, Ban, Unlock, UserPlus, UserCheck, Loader2, Sparkles, Zap } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { BACKEND_URL } from '../../utils/config';
import PulseVipBadge from '../common/PulseVipBadge';

export default function UserProfileModal({ targetUser, onClose, onStartCall, onOpenFullDp }) {
  const { user, token, blockUser, unblockUser } = useContext(AuthContext);
  const { socket, onlineUsers } = useContext(SocketContext);
  const [profileData, setProfileData] = useState(targetUser);
  const [loading, setLoading] = useState(false);
  const [disappearingEnabled, setDisappearingEnabled] = useState(false);
  const [friendStatus, setFriendStatus] = useState({ status: 'none', requestId: null });
  const [friendLoading, setFriendLoading] = useState(false);

  const isOnline = onlineUsers.includes(targetUser.id);
  const isBlocked = Boolean(user?.blockedUsers && user.blockedUsers.includes(targetUser.id));
  const chatId = user?.id && targetUser?.id ? [user.id, targetUser.id].sort().join('_') : null;

  const fetchFriendStatus = async () => {
    if (!targetUser?.id || targetUser.id === user?.id) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/friends/status/${targetUser.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data && data.status) {
        setFriendStatus(data);
      }
    } catch (err) {
      console.error("Error fetching friend status:", err);
    }
  };

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

      fetchFriendStatus();

      // Fetch chat settings (disappearing messages)
      if (chatId) {
        fetch(`${BACKEND_URL}/api/messages/settings/${chatId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(setting => {
            if (setting) {
              setDisappearingEnabled(Boolean(setting.disappearingEnabled));
            }
          })
          .catch(() => {});
      }
    }
  }, [targetUser?.id, token, chatId]);

  // Real-time DP / Profile sync
  useEffect(() => {
    const handleProfileUpdate = (data) => {
      if (!data) return;
      const isTarget = targetUser && (
        targetUser.id === data.userId ||
        (data.userMongoId && (targetUser.id === data.userMongoId || targetUser._id === data.userMongoId)) ||
        (data.username && targetUser.username === data.username)
      );
      if (isTarget) {
        setProfileData(prev => ({
          ...prev,
          ...(data.displayName !== undefined && data.displayName !== '' && { displayName: data.displayName }),
          ...(data.avatar !== undefined && data.avatar !== '' && { avatar: data.avatar }),
          ...(data.status !== undefined && { status: data.status })
        }));
      }
    };

    if (socket) socket.on('user_profile_updated', handleProfileUpdate);
    const handleWindowEvent = (e) => {
      if (e.detail?.updates) {
        handleProfileUpdate({ userId: e.detail.targetUserId, ...e.detail.updates });
      }
    };
    window.addEventListener('pulsechat_user_profile_updated', handleWindowEvent);

    return () => {
      if (socket) socket.off('user_profile_updated', handleProfileUpdate);
      window.removeEventListener('pulsechat_user_profile_updated', handleWindowEvent);
    };
  }, [socket, targetUser]);

  // Real-time socket sync for friend status changes
  useEffect(() => {
    if (!socket || !targetUser?.id) return;

    const handleReqRecv = (data) => {
      const sId = data?.senderId || data?.sender?.id || data?.request?.senderId || data?.request?.sender?.id;
      if (sId === targetUser.id) {
        setFriendStatus({ status: 'pending_received', requestId: data?.requestId || data?.id || data?.request?.id });
      }
    };

    const handleReqAccepted = (data) => {
      if (data.friend?.id === targetUser.id) {
        setFriendStatus({ status: 'friends' });
      }
    };

    const handleReqCancelled = (data) => {
      if (data.requestId === friendStatus.requestId) {
        setFriendStatus({ status: 'none', requestId: null });
      }
    };

    const handleReqRejected = (data) => {
      if (data.requestId === friendStatus.requestId) {
        setFriendStatus({ status: 'none', requestId: null });
      }
    };

    const handleFriendRemoved = (data) => {
      if (data.userId === targetUser.id) {
        setFriendStatus({ status: 'none', requestId: null });
      }
    };

    socket.on('friend_request_received', handleReqRecv);
    socket.on('friend_request_accepted', handleReqAccepted);
    socket.on('friend_request_cancelled', handleReqCancelled);
    socket.on('friend_request_rejected', handleReqRejected);
    socket.on('friend_removed', handleFriendRemoved);

    return () => {
      socket.off('friend_request_received', handleReqRecv);
      socket.off('friend_request_accepted', handleReqAccepted);
      socket.off('friend_request_cancelled', handleReqCancelled);
      socket.off('friend_request_rejected', handleReqRejected);
      socket.off('friend_removed', handleFriendRemoved);
    };
  }, [socket, targetUser, friendStatus.requestId]);

  const handleSendFriendRequest = async () => {
    if (!targetUser?.id || friendLoading) return;
    setFriendLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/friends/request/${targetUser.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        if (data.status === 'accepted') {
          setFriendStatus({ status: 'friends' });
        } else {
          setFriendStatus({ status: 'pending_sent', requestId: data.request?.id });
        }
      } else {
        alert(data.error || 'Failed to send friend request');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFriendLoading(false);
    }
  };

  const handleAcceptFriendRequest = async () => {
    if (!friendStatus.requestId || friendLoading) return;
    const prevStatus = { ...friendStatus };
    setFriendStatus({ status: 'friends' }); // 0ms Optimistic update
    setFriendLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/friends/accept/${friendStatus.requestId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        setFriendStatus(prevStatus);
      }
    } catch (e) {
      console.error(e);
      setFriendStatus(prevStatus);
    } finally {
      setFriendLoading(false);
    }
  };

  const handleCancelFriendRequest = async () => {
    if (!friendStatus.requestId || friendLoading) return;
    setFriendLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/friends/cancel/${friendStatus.requestId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setFriendStatus({ status: 'none', requestId: null });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFriendLoading(false);
    }
  };

  const handleRejectFriendRequest = async () => {
    if (!friendStatus.requestId || friendLoading) return;
    setFriendLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/friends/reject/${friendStatus.requestId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setFriendStatus({ status: 'none', requestId: null });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFriendLoading(false);
    }
  };

  const handleUnfriend = async () => {
    if (!window.confirm(`Are you sure you want to remove ${userToDisplay.displayName} from your friends?`)) return;
    setFriendLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/friends/${targetUser.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setFriendStatus({ status: 'none', requestId: null });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFriendLoading(false);
    }
  };

  const handleToggleDisappearing = async () => {
    if (!chatId) return;
    const newState = !disappearingEnabled;
    setDisappearingEnabled(newState);
    try {
      if (socket) {
        socket.emit('toggle_disappearing', { chatId, enabled: newState, userId: user?.id });
      } else {
        await fetch(`${BACKEND_URL}/api/messages/settings/${chatId}/disappearing`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ enabled: newState })
        });
      }
    } catch (e) {
      console.error("Failed to toggle disappearing:", e);
    }
  };

  const handleBlockToggle = async () => {
    if (!targetUser?.id) return;
    if (isBlocked) {
      await unblockUser(targetUser.id);
    } else {
      if (window.confirm(`Block ${targetUser.displayName || targetUser.username}? You won't receive messages or calls from them.`)) {
        await blockUser(targetUser.id);
      }
    }
  };

  const userToDisplay = profileData || targetUser;
  const validAvatar = userToDisplay?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userToDisplay?.username || 'user'}`;

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
          <div
            className={userToDisplay?.isPro ? 'pro-neon-avatar pro-neon-avatar-lg' : ''}
            style={{ position: 'relative', display: 'inline-block', marginBottom: '0.75rem' }}
          >
            <img
              src={validAvatar}
              alt={userToDisplay.displayName}
              onClick={() => onOpenFullDp(validAvatar, userToDisplay.displayName, userToDisplay.username)}
              style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: userToDisplay?.isPro ? 'none' : '4px solid var(--bg-card)',
                boxShadow: userToDisplay?.isPro ? 'none' : '0 8px 24px rgba(0,0,0,0.3)',
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
            {userToDisplay?.isPro && (
              <PulseVipBadge size={20} showLabel={true} />
            )}
          </div>
          <p style={{ margin: '2px 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            @{userToDisplay.username}
          </p>

          {/* Friend Status & Action (Friend count is strictly hidden for privacy) */}
          {user?.id !== userToDisplay?.id && (
            <div style={{ marginBottom: '1.1rem' }}>
              {friendLoading ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px', background: 'var(--bg-chat)', color: 'var(--text-muted)', fontSize: '0.82rem', border: '1px solid var(--border)' }}>
                  <Loader2 size={14} className="animate-spin" /> Updating...
                </div>
              ) : friendStatus.status === 'friends' ? (
                <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: '#10b981',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    border: '1px solid rgba(16, 185, 129, 0.25)'
                  }}>
                    <Sparkles size={14} /> Synced
                  </div>
                  <button
                    onClick={handleUnfriend}
                    title="Unsync Pulse Frequency"
                    style={{
                      padding: '5px 10px',
                      borderRadius: '16px',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef4444'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                  >
                    Unsync
                  </button>
                </div>
              ) : friendStatus.status === 'pending_sent' ? (
                <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    background: 'rgba(245, 158, 11, 0.12)',
                    color: '#f59e0b',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    border: '1px solid rgba(245, 158, 11, 0.25)'
                  }}>
                    📡 Beaming Pulse...
                  </div>
                  <button
                    onClick={handleCancelFriendRequest}
                    title="Cancel Pulse Beam"
                    style={{
                      padding: '5px 10px',
                      borderRadius: '16px',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border)',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : friendStatus.status === 'pending_received' ? (
                <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                  <button
                    onClick={handleAcceptFriendRequest}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 14px',
                      borderRadius: '20px',
                      background: 'var(--accent)',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
                    }}
                  >
                    <Zap size={14} /> Sync Frequency
                  </button>
                  <button
                    onClick={handleRejectFriendRequest}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '20px',
                      background: 'transparent',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      fontSize: '0.78rem',
                      cursor: 'pointer'
                    }}
                  >
                    Decline
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleSendFriendRequest}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 16px',
                    borderRadius: '20px',
                    background: 'var(--accent)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.25)'
                  }}
                >
                  <Zap size={14} /> Sync Frequency
                </button>
              )}
            </div>
          )}

          {/* Action Quick Buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <button
              className="btn-secondary"
              onClick={() => onOpenFullDp(validAvatar, userToDisplay.displayName, userToDisplay.username)}
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

            <div style={{ height: '1px', background: 'var(--border)' }} />

            {/* Disappearing Messages (24h) Toggle */}
            <div
              onClick={handleToggleDisappearing}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 0',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} color="var(--accent)" />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Disappearing Messages (24h)</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Auto-delete messages after 24 hours</div>
                </div>
              </div>

              <div style={{
                width: '36px',
                height: '20px',
                borderRadius: '10px',
                background: disappearingEnabled ? 'var(--accent)' : 'var(--border)',
                position: 'relative',
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: '#fff',
                  position: 'absolute',
                  top: '2px',
                  left: disappearingEnabled ? '18px' : '2px',
                  transition: 'all 0.2s ease'
                }} />
              </div>
            </div>

            <div style={{ height: '1px', background: 'var(--border)' }} />

            {/* Block / Unblock Contact Button */}
            <button
              onClick={handleBlockToggle}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '10px',
                background: isBlocked ? 'rgba(99, 102, 241, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: isBlocked ? 'var(--accent)' : '#ef4444',
                fontWeight: 600,
                fontSize: '0.85rem',
                border: isBlocked ? '1px solid var(--accent)' : '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                marginTop: '4px'
              }}
            >
              {isBlocked ? <Unlock size={16} /> : <Ban size={16} />}
              {isBlocked ? 'Unblock Contact' : 'Block Contact'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
