import React, { useState, useEffect, useContext, useMemo } from 'react';
import { X, CheckCircle2, Phone, Video, Eye, Info, User, ShieldCheck, Clock, Ban, Unlock, UserPlus, UserCheck, Loader2, Sparkles, Zap, Image as ImageIcon, FileText, Link2, Film, Download, ExternalLink } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { BACKEND_URL } from '../../utils/config';
import PulseVipBadge from '../common/PulseVipBadge';
import VibeAuraRing, { resolveUserAura } from '../common/VibeAuraRing';
import { getCachedAllUsers, getCachedFriends, setCachedFriends, getCachedMessages } from '../../utils/offlineStorage';

export default function UserProfileModal({ targetUser, onClose, onStartCall, onOpenFullDp }) {
  const { user, token, blockUser, unblockUser } = useContext(AuthContext);
  const { socket, onlineUsers, vibeAuras } = useContext(SocketContext);
  const [profileData, setProfileData] = useState(targetUser);
  const [loading, setLoading] = useState(false);
  const [disappearingEnabled, setDisappearingEnabled] = useState(false);
  const [friendStatus, setFriendStatus] = useState({ status: 'none', requestId: null });
  const [friendLoading, setFriendLoading] = useState(false);

  const isOnline = onlineUsers.includes(targetUser.id);
  const isBlocked = Boolean(user?.blockedUsers && user.blockedUsers.includes(targetUser.id));
  const chatId = user?.id && targetUser?.id ? [user.id, targetUser.id].sort().join('_') : null;

  // Shared Media, Files & Links States
  const [sharedTab, setSharedTab] = useState('media'); // 'media' | 'files' | 'links'
  const [sharedMessages, setSharedMessages] = useState(() => {
    if (!chatId) return [];
    return getCachedMessages(chatId) || [];
  });

  const sharedMediaItems = useMemo(() => {
    return (sharedMessages || []).filter(m => (m.type === 'image' || m.type === 'video') && m.mediaUrl && !m.isFogSnap && !m.isViewOnce);
  }, [sharedMessages]);

  const sharedFilesItems = useMemo(() => {
    return (sharedMessages || []).filter(m => (m.type === 'document' || m.fileName) && m.mediaUrl);
  }, [sharedMessages]);

  const sharedLinksItems = useMemo(() => {
    const list = [];
    (sharedMessages || []).forEach(m => {
      if (m.type === 'text' && m.content) {
        const matches = m.content.match(/https?:\/\/[^\s]+/g);
        if (matches) {
          matches.forEach(url => list.push({ url, timestamp: m.timestamp, id: m.id }));
        }
      }
    });
    return list;
  }, [sharedMessages]);

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

      // Fetch chat settings & shared messages
      if (chatId) {
        const cached = getCachedMessages(chatId) || [];
        if (cached.length > 0) setSharedMessages(cached);

        if (token) {
          fetch(`${BACKEND_URL}/api/messages/${chatId}?limit=100`, {
            headers: { Authorization: `Bearer ${token}` }
          })
            .then(res => res.json())
            .then(data => {
              if (Array.isArray(data)) {
                setSharedMessages(data);
              }
            })
            .catch(() => {});
        }

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

  // Real-time DP / Profile / Vibe sync
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
          ...(data.isPro !== undefined && { isPro: Boolean(data.isPro) }),
          ...(data.proTier !== undefined && { proTier: data.proTier }),
          ...(data.customBadge !== undefined && { customBadge: data.customBadge }),
          ...(data.displayName !== undefined && data.displayName !== '' && { displayName: data.displayName }),
          ...(data.avatar !== undefined && data.avatar !== '' && { avatar: data.avatar }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.vibeAura !== undefined && { vibeAura: data.vibeAura })
        }));
      }
    };

    const handleVibeUpdate = (cleanAura) => {
      if (!cleanAura) return;
      const isTarget = targetUser && (
        targetUser.id === cleanAura.userId ||
        targetUser._id === cleanAura.userId ||
        (cleanAura.userMongoId && (targetUser.id === cleanAura.userMongoId || targetUser._id === cleanAura.userMongoId)) ||
        (cleanAura.username && targetUser.username === cleanAura.username)
      );
      if (isTarget) {
        const isCleared = Boolean(cleanAura.cleared || cleanAura.auraType === 'none' || (!cleanAura.mood && !cleanAura.isLowBattery && !cleanAura.inGame));
        setProfileData(prev => ({
          ...prev,
          vibeAura: isCleared ? null : cleanAura
        }));
      }
    };

    if (socket) {
      socket.on('user_profile_updated', handleProfileUpdate);
      socket.on('vibe_aura_updated', handleVibeUpdate);
    }
    const handleWindowEvent = (e) => {
      if (e.detail?.updates) {
        handleProfileUpdate({ userId: e.detail.targetUserId, ...e.detail.updates });
      }
    };
    window.addEventListener('pulsechat_user_profile_updated', handleWindowEvent);

    return () => {
      if (socket) {
        socket.off('user_profile_updated', handleProfileUpdate);
        socket.off('vibe_aura_updated', handleVibeUpdate);
      }
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
        if (user?.id) {
          const curFriends = getCachedFriends(user.id);
          const next = curFriends.filter(f => f.id !== targetUser.id && f._id !== targetUser.id);
          setCachedFriends(user.id, next);
        }
        window.dispatchEvent(new CustomEvent('pulsechat_friend_removed', { detail: { targetId: targetUser.id } }));
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

  const cachedMatch = user?.id ? getCachedAllUsers(user.id)?.find(u =>
    u.id === targetUser?.id || u.id === targetUser?._id || (targetUser?.username && u.username === targetUser.username)
  ) : null;
  const userToDisplay = {
    ...cachedMatch,
    ...targetUser,
    ...profileData,
    isPro: Boolean(profileData?.isPro ?? targetUser?.isPro ?? cachedMatch?.isPro)
  };
  const validAvatar = userToDisplay?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userToDisplay?.username || 'user'}`;

  const userAura = resolveUserAura(userToDisplay, vibeAuras);
  const hasVibe = Boolean(userAura);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-responsive" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', width: '100%', maxHeight: '90dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header Cover Banner */}
        <div style={{
          height: '110px',
          background: 'linear-gradient(135deg, var(--accent) 0%, #3b82f6 100%)',
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '12px',
          flexShrink: 0
        }}>
          {/* Top Left: VIP Badge (opposite side of close cross button) */}
          {userToDisplay?.isPro ? (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(251, 191, 36, 0.45)',
              borderRadius: '20px',
              padding: '4px 10px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
              backdropFilter: 'blur(8px)'
            }}>
              <PulseVipBadge size={18} showLabel={true} />
            </div>
          ) : <div />}

          <button
            className="icon-btn-ghost"
            onClick={onClose}
            style={{ color: '#fff', background: 'rgba(0,0,0,0.25)', borderRadius: '50%', width: '32px', height: '32px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Profile Avatar & Details */}
        <div style={{ padding: '0 1.5rem 2.5rem 1.5rem', marginTop: '-50px', textAlign: 'center', flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {/* Avatar with Clickable Full DP trigger */}
          <div
            className={userToDisplay?.isPro ? 'pro-neon-avatar pro-neon-avatar-lg' : ''}
            style={{ position: 'relative', display: 'inline-block', marginBottom: '0.75rem' }}
          >
            {userToDisplay?.hasKingCrown ? (
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
            ) : userToDisplay?.hasSilverCrown ? (
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
            ) : userToDisplay?.hasStreakCrown ? (
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
            <VibeAuraRing auraData={userAura} size={100} showNoteBubble={true} hasCrown={Boolean(userToDisplay?.hasKingCrown || userToDisplay?.hasSilverCrown || userToDisplay?.hasStreakCrown)}>
              <img
                src={validAvatar}
                alt={userToDisplay.displayName}
                onClick={() => onOpenFullDp(validAvatar, userToDisplay.displayName, userToDisplay.username)}
                style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: userToDisplay?.hasKingCrown
                    ? '3.5px solid #fbbf24'
                    : userToDisplay?.hasSilverCrown
                    ? '3.5px solid #cbd5e1'
                    : userToDisplay?.hasStreakCrown
                    ? '3.5px solid #f97316'
                    : (userToDisplay?.isPro ? 'none' : '4px solid var(--bg-card)'),
                  boxShadow: userToDisplay?.isPro ? 'none' : '0 8px 24px rgba(0,0,0,0.3)',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease',
                  display: 'block'
                }}
                title="Click to view full screen DP"
              />
            </VibeAuraRing>
            {isOnline && (
              <div
                className="online-indicator-dot"
                style={{ width: '16px', height: '16px', border: '3px solid var(--bg-card)', bottom: '4px', right: '4px', zIndex: 4 }}
                title="Online Now"
              />
            )}
          </div>

          {/* Display Name */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {userToDisplay.displayName}
            </h3>
          </div>
          <p style={{ margin: '2px 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            @{userToDisplay.username}
          </p>

          {/* Live Vibe Aura Badge */}
          {hasVibe && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 14px',
              borderRadius: '20px',
              background: `${userAura.auraColor || '#10b981'}18`,
              border: `1.5px solid ${userAura.auraColor || '#10b981'}55`,
              color: 'var(--text-main)',
              fontSize: '0.84rem',
              fontWeight: 700,
              marginBottom: '0.9rem',
              boxShadow: `0 2px 10px ${userAura.auraColor || '#10b981'}25`,
              letterSpacing: '0.2px'
            }}>
              <span style={{ fontSize: '1rem' }}>{userAura.emoji || '⚡'}</span>
              <span>
                {userAura.isLowBattery
                  ? `Low Battery (${userAura.batteryLevel || '<20'}%)`
                  : (userAura.inGame ? `Playing ${userAura.inGame}` : userAura.mood)}
              </span>
            </div>
          )}

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

          {/* WhatsApp / Telegram-Style Shared Media, Documents & Links Section */}
          <div style={{
            background: 'var(--bg-chat)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '14px',
            marginBottom: '14px',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '0.2px' }}>
                Shared Media & Links
              </span>
            </div>

            {/* Tab selector */}
            <div style={{ display: 'flex', gap: '6px', background: 'var(--hover-bg)', padding: '3px', borderRadius: '10px', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => setSharedTab('media')}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  borderRadius: '8px',
                  border: 'none',
                  background: sharedTab === 'media' ? 'var(--accent)' : 'transparent',
                  color: sharedTab === 'media' ? '#fff' : 'var(--text-muted)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease'
                }}
              >
                <ImageIcon size={13} />
                <span>Media ({sharedMediaItems.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setSharedTab('files')}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  borderRadius: '8px',
                  border: 'none',
                  background: sharedTab === 'files' ? 'var(--accent)' : 'transparent',
                  color: sharedTab === 'files' ? '#fff' : 'var(--text-muted)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease'
                }}
              >
                <FileText size={13} />
                <span>Files ({sharedFilesItems.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setSharedTab('links')}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  borderRadius: '8px',
                  border: 'none',
                  background: sharedTab === 'links' ? 'var(--accent)' : 'transparent',
                  color: sharedTab === 'links' ? '#fff' : 'var(--text-muted)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease'
                }}
              >
                <Link2 size={13} />
                <span>Links ({sharedLinksItems.length})</span>
              </button>
            </div>

            {/* Tab 1: Media Grid (Photos & Videos) */}
            {sharedTab === 'media' && (
              <div>
                {sharedMediaItems.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                    {sharedMediaItems.map((m, idx) => (
                      <div
                        key={m.id || idx}
                        onClick={() => {
                          if (m.type === 'video') {
                            window.open(m.mediaUrl, '_blank');
                          } else if (onOpenFullDp) {
                            onOpenFullDp(m.mediaUrl, 'Shared Photo', userToDisplay.username);
                          }
                        }}
                        style={{
                          position: 'relative',
                          aspectRatio: '1',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          background: 'rgba(0,0,0,0.2)',
                          cursor: 'pointer'
                        }}
                        title="Click to view full photo"
                      >
                        {m.type === 'video' ? (
                          <>
                            <video src={m.mediaUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.6)', borderRadius: '4px', padding: '2px 4px', display: 'flex', alignItems: 'center' }}>
                              <Film size={11} color="#fff" />
                            </div>
                          </>
                        ) : (
                          <img
                            src={m.mediaUrl}
                            alt="Shared media"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            loading="lazy"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '1.2rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    No photos or videos shared yet
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Files List */}
            {sharedTab === 'files' && (
              <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {sharedFilesItems.length > 0 ? (
                  sharedFilesItems.map((f, idx) => (
                    <div
                      key={f.id || idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: 'var(--hover-bg)',
                        border: '1px solid var(--border)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                        <FileText size={18} color="var(--accent)" style={{ flexShrink: 0 }} />
                        <div style={{ overflow: 'hidden', minWidth: 0 }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.fileName || 'Attachment'}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {f.fileSize || 'Document'}
                          </div>
                        </div>
                      </div>
                      <a
                        href={f.mediaUrl}
                        download={f.fileName || 'pulse_file'}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--accent)', padding: '4px', display: 'flex' }}
                        title="Download file"
                      >
                        <Download size={15} />
                      </a>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '1.2rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    No documents shared yet
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Links List */}
            {sharedTab === 'links' && (
              <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {sharedLinksItems.length > 0 ? (
                  sharedLinksItems.map((l, idx) => (
                    <a
                      key={idx}
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: 'var(--hover-bg)',
                        border: '1px solid var(--border)',
                        textDecoration: 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                        <Link2 size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.url}
                        </div>
                      </div>
                      <ExternalLink size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    </a>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '1.2rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    No web links shared yet
                  </div>
                )}
              </div>
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

            {hasVibe && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Zap size={14} color={userAura.auraColor || 'var(--accent)'} /> Live Vibe:
                </span>
                <span style={{
                  fontWeight: 600,
                  color: userAura.auraColor || 'var(--accent)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span>{userAura.emoji || '⚡'}</span>
                  <span>
                    {userAura.isLowBattery
                      ? `Low Battery (${userAura.batteryLevel || '<20'}%)`
                      : (userAura.inGame ? `Playing ${userAura.inGame}` : userAura.mood)}
                  </span>
                </span>
              </div>
            )}

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
