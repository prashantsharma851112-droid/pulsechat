import React, { useState, useContext, useEffect, useCallback, useRef } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { Search, Settings, User, LogOut, Users, CheckCircle2, Plus, EyeOff, ShieldAlert, Bell, WifiOff, RotateCw, UserPlus, Clock, Check, Sparkles, Crown, Zap } from 'lucide-react';
import CreateGroupModal from './CreateGroupModal';
import SettingsModal from '../profile/SettingsModal';
import FriendsTab from './FriendsTab';
import PulseProModal from './PulseProModal';
import { BACKEND_URL } from '../../utils/config';
import { requestNotificationPermission, showPushNotification, dismissNotificationBanner, subscribeUserToPush } from '../../utils/notifications';
import {
  getCachedUser,
  getCachedRecentChats,
  setCachedRecentChats,
  getCachedGroups,
  setCachedGroups,
  getCachedAllUsers,
  setCachedAllUsers,
  getCachedFriends,
  setCachedFriends,
  mergeIntoAllUsersCache,
  isDeviceOnline,
  subscribeToNetworkChanges
} from '../../utils/offlineStorage';
import { parseSafeJson } from '../../utils/imageCompressor';

export default function Sidebar({ activeChat, setActiveChat, openProfileModal, openSettingsModal, onOpenFullDp }) {
  const { user, logout, token } = useContext(AuthContext);
  const { socket, onlineUsers, lastNotification } = useContext(SocketContext);
  const currentUid = user?.id || getCachedUser()?.id;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [recentChats, setRecentChats] = useState(() => getCachedRecentChats(currentUid));
  const [groups, setGroups] = useState(() => getCachedGroups(currentUid));
  const [allUsers, setAllUsers] = useState(() => getCachedAllUsers(currentUid));
  const [isOnline, setIsOnline] = useState(() => isDeviceOnline());
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'groups' | 'friends'
  const [friendsSubTab, setFriendsSubTab] = useState('friends');
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [friendIdsSet, setFriendIdsSet] = useState(() => {
    const cached = getCachedFriends(currentUid);
    return new Set(cached.map(f => f.id));
  });
  const [outgoingPendingIds, setOutgoingPendingIds] = useState(new Set());
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const activeChatRef = React.useRef(activeChat);
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  // Listen to cross-component tab switch requests (e.g. clicking on sync notification toast)
  useEffect(() => {
    const handleOpenTab = (e) => {
      if (e.detail?.tab) {
        setActiveTab(e.detail.tab);
        if (e.detail.subTab) {
          setFriendsSubTab(e.detail.subTab);
        }
      }
    };
    window.addEventListener('pulsechat_open_tab', handleOpenTab);
    return () => window.removeEventListener('pulsechat_open_tab', handleOpenTab);
  }, []);

  // Load friendship status and pending friend requests count
  const loadFriendshipInfo = useCallback(async () => {
    if (!token) return;
    try {
      const [reqRes, friendsRes] = await Promise.allSettled([
        fetch(`${BACKEND_URL}/api/friends/requests`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${BACKEND_URL}/api/friends`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (reqRes.status === 'fulfilled' && reqRes.value.ok) {
        const data = await reqRes.value.json();
        if (data?.incoming) setPendingRequestsCount(data.incoming.length);
        if (data?.outgoing) {
          setOutgoingPendingIds(new Set(data.outgoing.map(r => r.receiverId)));
        }
      }

      if (friendsRes.status === 'fulfilled' && friendsRes.value.ok) {
        const fData = await friendsRes.value.json();
        if (fData?.friends) {
          setFriendIdsSet(new Set(fData.friends.map(f => f.id)));
          if (user?.id) {
            setCachedFriends(user.id, fData.friends);
          }
        }
      }
    } catch {}
  }, [token]);

  useEffect(() => {
    loadFriendshipInfo();
  }, [loadFriendshipInfo]);

  // Real-time zero-millisecond socket sync for friend requests
  useEffect(() => {
    if (!socket) return;

    const handleReqReceived = (data) => {
      // Instant 0ms badge increment
      setPendingRequestsCount(prev => prev + 1);
      loadFriendshipInfo();
    };

    const handleReqAccepted = (data) => {
      if (data?.friend?.id) {
        setFriendIdsSet(prev => new Set([...prev, data.friend.id]));
        setOutgoingPendingIds(prev => {
          const next = new Set(prev);
          next.delete(data.friend.id);
          return next;
        });
      }
      setPendingRequestsCount(prev => Math.max(0, prev - 1));
      loadFriendshipInfo();
    };

    const handleReqRejected = (data) => {
      if (data?.userId) {
        setOutgoingPendingIds(prev => {
          const next = new Set(prev);
          next.delete(data.userId);
          return next;
        });
      }
      loadFriendshipInfo();
    };

    const handleReqCancelled = () => {
      setPendingRequestsCount(prev => Math.max(0, prev - 1));
      loadFriendshipInfo();
    };

    const handleFriendRemoved = (data) => {
      const removedId = data?.targetId || data?.userId;
      if (removedId) {
        setFriendIdsSet(prev => {
          const next = new Set(prev);
          next.delete(removedId);
          return next;
        });
      }
      loadFriendshipInfo();
    };

    socket.on('friend_request_received', handleReqReceived);
    socket.on('friend_request_accepted', handleReqAccepted);
    socket.on('friend_request_rejected', handleReqRejected);
    socket.on('friend_request_cancelled', handleReqCancelled);
    socket.on('friend_removed', handleFriendRemoved);

    return () => {
      socket.off('friend_request_received', handleReqReceived);
      socket.off('friend_request_accepted', handleReqAccepted);
      socket.off('friend_request_rejected', handleReqRejected);
      socket.off('friend_request_cancelled', handleReqCancelled);
      socket.off('friend_removed', handleFriendRemoved);
    };
  }, [socket, loadFriendshipInfo]);

  const handleSendFriendRequest = async (e, targetUserId) => {
    e.stopPropagation();
    if (!token || !targetUserId) return;
    try {
      setOutgoingPendingIds(prev => new Set([...prev, targetUserId]));
      const res = await fetch(`${BACKEND_URL}/api/friends/request/${targetUserId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data?.status === 'accepted') {
        setFriendIdsSet(prev => new Set([...prev, targetUserId]));
        setOutgoingPendingIds(prev => {
          const next = new Set(prev);
          next.delete(targetUserId);
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to send friend request:', err);
    }
  };

  // When user becomes available (after login / token restore), load data from cache immediately
  useEffect(() => {
    if (user?.id) {
      const cached = getCachedRecentChats(user.id);
      if (cached.length > 0) setRecentChats(cached);
      const cachedGroups = getCachedGroups(user.id);
      if (cachedGroups.length > 0) setGroups(cachedGroups);
      const cachedUsers = getCachedAllUsers(user.id);
      if (cachedUsers.length > 0) setAllUsers(cachedUsers);
    }
  }, [user?.id]);

  // Monitor network online/offline state
  useEffect(() => {
    const unsubscribe = subscribeToNetworkChanges((online) => {
      setIsOnline(online);
      if (online) {
        loadRecentChats();
        loadGroups();
        loadAllUsers();
      }
    });
    return unsubscribe;
  }, [user?.id]);

  // Listen for local chat updates (e.g. offline message sent in ChatWindow)
  useEffect(() => {
    const handleRecentUpdate = () => {
      if (user?.id) {
        setRecentChats(getCachedRecentChats(user.id));
      }
    };
    window.addEventListener('pulsechat_recent_updated', handleRecentUpdate);
    return () => window.removeEventListener('pulsechat_recent_updated', handleRecentUpdate);
  }, [user?.id]);

  // Notification Permission State — respect localStorage dismiss flag
  const [notifPermission, setNotifPermission] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (localStorage.getItem('pulsechat_notif_dismissed') === 'true') return 'dismissed';
      return Notification.permission;
    }
    return 'granted';
  });

  // Next-Gen Feature States
  const [silentMode, setSilentMode] = useState(false);
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      loadRecentChats();
      loadGroups();
      loadAllUsers();
      if (socket) {
        if (!socket.connected) {
          socket.connect();
        }
        if (user?.id) {
          socket.emit('setup', user.id);
        }
      }
      window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));
    } catch (e) {
      console.warn('Manual refresh error:', e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 700);
    }
  };

  const loadRecentChats = useCallback(() => {
    if (!token) return;
    fetch(`${BACKEND_URL}/api/users/recent`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => parseSafeJson(res))
      .then(data => {
        if (Array.isArray(data)) {
          const localUsers = getCachedAllUsers(user?.id) || [];
          const uMap = new Map();
          localUsers.forEach(u => {
            if (u.id) uMap.set(u.id, u);
            if (u._id) uMap.set(u._id, u);
            if (u.username) uMap.set(u.username, u);
          });

          const mapped = data.map(item => {
            const fresh = uMap.get(item.id) || (item.username ? uMap.get(item.username) : null);
            let res = item;
            if (fresh && fresh.avatar) {
              res = { ...res, avatar: fresh.avatar, displayName: fresh.displayName || res.displayName };
            }
            if (activeChatRef.current && res.id === activeChatRef.current.id) {
              res = { ...res, unreadCount: 0 };
            }
            return res;
          });
          setRecentChats(mapped);
          if (user?.id) {
            setCachedRecentChats(user.id, mapped);
          }
        }
      })
      .catch(() => {
        // Offline: restore from cache
        if (user?.id) {
          const cached = getCachedRecentChats(user.id);
          if (cached.length > 0) setRecentChats(cached);
        }
      });
  }, [token, user?.id]);

  const loadGroups = useCallback(() => {
    if (!token) return;
    fetch(`${BACKEND_URL}/api/groups`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => parseSafeJson(res))
      .then(data => {
        if (Array.isArray(data)) {
          setGroups(data);
          if (user?.id) {
            setCachedGroups(user.id, data);
          }
        }
      })
      .catch(() => {
        // Offline: restore from cache
        if (user?.id) {
          const cached = getCachedGroups(user.id);
          if (cached.length > 0) setGroups(cached);
        }
      });
  }, [token, user?.id]);

  const loadAllUsers = useCallback(() => {
    if (!token) return;
    fetch(`${BACKEND_URL}/api/users`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => parseSafeJson(res))
      .then(data => {
        if (Array.isArray(data)) {
          setAllUsers(data);
          if (user?.id) {
            setCachedAllUsers(user.id, data);
          }
        }
      })
      .catch(() => {
        // Offline: already loaded from cache in state
      });
  }, [token, user?.id]);

  // Auto-sync fresh avatars from allUsers into recentChats
  useEffect(() => {
    if (allUsers.length > 0 && recentChats.length > 0) {
      const uMap = new Map();
      allUsers.forEach(u => {
        if (u.id) uMap.set(u.id, u);
        if (u._id) uMap.set(u._id, u);
        if (u.username) uMap.set(u.username, u);
      });
      let changed = false;
      const synced = recentChats.map(item => {
        const fresh = uMap.get(item.id) || (item.username ? uMap.get(item.username) : null);
        if (fresh && fresh.avatar && fresh.avatar !== item.avatar) {
          changed = true;
          return { ...item, avatar: fresh.avatar, displayName: fresh.displayName || item.displayName };
        }
        return item;
      });
      if (changed) {
        setRecentChats(synced);
        if (user?.id) setCachedRecentChats(user.id, synced);
      }
    }
  }, [allUsers]);

  useEffect(() => {
    loadRecentChats();
    loadGroups();
    loadAllUsers();
  }, [loadRecentChats, loadGroups, loadAllUsers]);

  useEffect(() => {
    if (lastNotification) {
      loadRecentChats();
    }
  }, [lastNotification, loadRecentChats]);

  useEffect(() => {
    if (activeChat) {
      setRecentChats(prev => prev.map(u => u.id === activeChat.id ? { ...u, unreadCount: 0 } : u));
    }
  }, [activeChat]);

  useEffect(() => {
    if (!socket) return;

    // Instant local read update (0ms, no network roundtrip needed)
    const handleChatRead = ({ chatId, userId }) => {
      if (userId === user?.id) {
        setRecentChats(prev => prev.map(c => {
          if (c.id === chatId || (chatId && chatId.includes(c.id))) {
            return { ...c, unreadCount: 0 };
          }
          return c;
        }));
      }
    };
    socket.on('chat_read_update', handleChatRead);

    const handleNewUser = (newUser) => {
      if (!newUser || newUser.id === user?.id) return;
      setAllUsers(prev => {
        if (prev.some(u => u.id === newUser.id)) return prev;
        const next = [newUser, ...prev];
        if (user?.id) setCachedAllUsers(user.id, next);
        return next;
      });
    };

    const handleProfileUpdate = (data) => {
      if (!data) return;
      const { userId, userMongoId, username, displayName, avatar, status } = data;

      const isMatch = (u) => {
        if (!u) return false;
        if (u.id && (u.id === userId || (userMongoId && u.id === userMongoId))) return true;
        if (u._id && (u._id === userId || (userMongoId && u._id === userMongoId))) return true;
        if (username && u.username === username) return true;
        return false;
      };

      setAllUsers(prev => {
        const next = prev.map(u => isMatch(u) ? {
          ...u,
          ...(displayName !== undefined && displayName !== '' && { displayName }),
          ...(avatar !== undefined && avatar !== '' && { avatar }),
          ...(status !== undefined && { status })
        } : u);
        if (user?.id) setCachedAllUsers(user.id, next);
        return next;
      });

      setRecentChats(prev => {
        const next = prev.map(u => isMatch(u) ? {
          ...u,
          ...(displayName !== undefined && displayName !== '' && { displayName }),
          ...(avatar !== undefined && avatar !== '' && { avatar })
        } : u);
        if (user?.id) setCachedRecentChats(user.id, next);
        return next;
      });
    };

    socket.on('new_user_registered', handleNewUser);
    socket.on('user_profile_updated', handleProfileUpdate);

    const handleWindowEvent = (e) => {
      if (e.detail?.updates) {
        handleProfileUpdate({ userId: e.detail.targetUserId, ...e.detail.updates });
      }
    };
    window.addEventListener('pulsechat_user_profile_updated', handleWindowEvent);

    // Instant Group Updates Sync
    const handleGroupUpdated = (data) => {
      if (!data) return;
      const targetId = data.groupId || data.id || data._id;
      const updates = data.updates || data;
      setGroups(prev => {
        const next = prev.map(g => {
          if (g.id === targetId || g._id === targetId) {
            return {
              ...g,
              name: updates.name || g.name,
              avatar: updates.avatar || g.avatar,
              description: updates.description !== undefined ? updates.description : g.description
            };
          }
          return g;
        });
        if (user?.id) setCachedGroups(user.id, next);
        return next;
      });

      setRecentChats(prev => {
        const next = prev.map(c => {
          if (c.isGroup && (c.id === targetId || c._id === targetId)) {
            return {
              ...c,
              displayName: updates.name || c.displayName || c.name,
              name: updates.name || c.name,
              avatar: updates.avatar || c.avatar,
              description: updates.description !== undefined ? updates.description : c.description
            };
          }
          return c;
        });
        if (user?.id) setCachedRecentChats(user.id, next);
        return next;
      });
    };

    socket.on('group_updated', handleGroupUpdated);

    const handleWindowGroupEvent = (e) => {
      if (e.detail) {
        handleGroupUpdated(e.detail);
      }
    };
    window.addEventListener('pulsechat_group_updated', handleWindowGroupEvent);

    return () => {
      socket.off('chat_read_update', handleChatRead);
      socket.off('new_user_registered', handleNewUser);
      socket.off('user_profile_updated', handleProfileUpdate);
      socket.off('group_updated', handleGroupUpdated);
      window.removeEventListener('pulsechat_user_profile_updated', handleWindowEvent);
      window.removeEventListener('pulsechat_group_updated', handleWindowGroupEvent);
    };
  }, [socket, user?.id]);

  // Search Users — instant 0ms local cache display + 150ms debounced server search
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase().replace(/^@/, '');
    if (q.length === 0) {
      setSearchResults([]);
      return;
    }

    // 1. Immediately show local cache results (0ms instant response)
    const localUsers = getCachedAllUsers(user?.id) || [];
    const localRecent = getCachedRecentChats(user?.id) || [];

    const seenIds = new Set();
    const combined = [];
    for (const u of [...localUsers, ...localRecent]) {
      if (u && u.id && !seenIds.has(u.id)) {
        seenIds.add(u.id);
        combined.push(u);
      }
    }

    const localMatches = combined.filter(u => {
      const nameMatch = (u.displayName || '').toLowerCase().includes(q);
      const usernameMatch = (u.username || '').toLowerCase().includes(q);
      const emailMatch = (u.email || '').toLowerCase().includes(q);
      return nameMatch || usernameMatch || emailMatch;
    });

    setSearchResults(localMatches);

    // 2. Debounced network search (150ms) to avoid server lag & fetch any new users
    if (!token) return;
    const timer = setTimeout(() => {
      fetch(`${BACKEND_URL}/api/users/search?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(async (res) => {
          if (!res.ok) return;
          const text = await res.text();
          try {
            const data = JSON.parse(text);
            if (Array.isArray(data)) {
              if (user?.id && data.length > 0) mergeIntoAllUsersCache(user.id, data);
              const serverIds = new Set(data.map(u => u.id));
              const merged = [
                ...data,
                ...localMatches.filter(u => !serverIds.has(u.id))
              ];
              setSearchResults(merged);
            }
          } catch (e) {}
        })
        .catch(() => {});
    }, 150);

    return () => clearTimeout(timer);
  }, [searchQuery, token, user?.id]);

  const handleSelectUser = (selectedUser) => {
    setActiveChat(selectedUser);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSelectGroup = (group) => {
    setActiveChat({
      ...group,
      isGroup: true,
      displayName: group.name,
      id: group.id
    });
    setSearchQuery('');
    setSearchResults([]);
  };

  const handlePanicWipe = () => {
    if (socket && user) {
      socket.emit('panic_wipe', { userId: user.id });
      setRecentChats([]);
      setActiveChat(null);
    }
    setShowPanicModal(false);
  };

  // Contacts to show when no search query & no recent chats
  const contactsNotInRecent = allUsers.filter(u => !recentChats.some(r => r.id === u.id));

  return (
    <div className={`sidebar-container ${activeChat ? 'mobile-hidden' : ''}`}>
      {/* WhatsApp-Style Top App Header */}
      <div className="sidebar-header" style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', borderBottom: '1px solid var(--border)', background: 'var(--bg-sidebar)' }}>
        {/* Brand & User Chip */}
        <div
          className="user-profile-badge"
          onClick={openProfileModal}
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0, cursor: 'pointer' }}
          title="Click to view & edit your profile"
        >
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <img
              src={user?.avatar}
              alt="Profile"
              className="user-avatar"
              onError={(e) => {
                e.target.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user?.username || 'Pulse')}`;
              }}
              style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent)' }}
            />
            {user?.isEmailVerified && (
              <CheckCircle2
                size={14}
                color="#10b981"
                style={{ position: 'absolute', bottom: 0, right: 0, background: '#fff', borderRadius: '50%' }}
              />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.displayName || user?.username || 'PulseChat'}
              </h3>
              {user?.isPro && (
                <span style={{
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  background: 'linear-gradient(90deg, #f59e0b, #eab308)',
                  color: '#000',
                  padding: '1px 6px',
                  borderRadius: '6px',
                  flexShrink: 0,
                  boxShadow: '0 2px 6px rgba(245, 158, 11, 0.3)'
                }}>
                  👑 PRO
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                @{user?.username}
              </p>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setShowProModal(true);
                }}
                style={{
                  fontSize: '0.72rem',
                  color: '#f59e0b',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                  cursor: 'pointer'
                }}
                title="Your Pulse Sparks Balance. Click to open Sparks store!"
              >
                <Zap size={11} fill="#f59e0b" /> {user?.pulseSparks ?? 50}
              </span>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => setShowProModal(true)}
            title="PulseChat Pro & Sparks Store"
            className="icon-btn-ghost"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: user?.isPro ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(239, 68, 68, 0.2))' : 'var(--bg-card)',
              color: '#f59e0b',
              border: user?.isPro ? '1px solid rgba(245, 158, 11, 0.4)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Crown size={19} />
          </button>
          <button
            onClick={handleManualRefresh}
            title="Refresh chats & connection"
            className="icon-btn-ghost"
            style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--bg-card)', color: isRefreshing ? 'var(--accent)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <RotateCw size={18} style={{ transform: isRefreshing ? 'rotate(360deg)' : 'none', transition: 'transform 0.6s ease' }} />
          </button>
          <button
            onClick={() => setShowCreateGroupModal(true)}
            title="Create New Group"
            className="icon-btn-ghost"
            style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--bg-card)', color: 'var(--accent)' }}
          >
            <Plus size={20} />
          </button>
          <button
            onClick={() => setShowSettingsModal(true)}
            title="App Settings & Options"
            className="icon-btn-ghost"
            style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--bg-card)' }}
          >
            <Settings size={20} color="var(--text-main)" />
          </button>
        </div>
      </div>

      {/* WhatsApp-Style Navigation Tabs: Chats vs Groups */}
      <div className="sidebar-tabs" style={{ display: 'flex', borderBottom: '2px solid var(--border)', background: 'var(--bg-sidebar)' }}>
        <button
          className={`tab-btn ${activeTab === 'chats' ? 'active' : ''}`}
          onClick={() => setActiveTab('chats')}
          style={{
            flex: 1,
            padding: '0.85rem',
            background: 'transparent',
            color: activeTab === 'chats' ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: '0.95rem',
            fontWeight: 700,
            borderBottom: activeTab === 'chats' ? '3px solid var(--accent)' : '3px solid transparent',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <span>CHATS</span>
          {recentChats.reduce((acc, c) => acc + (c.unreadCount || 0), 0) > 0 && (
            <span className="unread-badge" style={{ fontSize: '0.72rem', padding: '1px 6px', height: '18px' }}>
              {recentChats.reduce((acc, c) => acc + (c.unreadCount || 0), 0)}
            </span>
          )}
        </button>
        <button
          className={`tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
          onClick={() => setActiveTab('groups')}
          style={{
            flex: 1,
            padding: '0.85rem 0.5rem',
            background: 'transparent',
            color: activeTab === 'groups' ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: '0.92rem',
            fontWeight: 700,
            borderBottom: activeTab === 'groups' ? '3px solid var(--accent)' : '3px solid transparent',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <span>GROUPS</span>
          <span style={{ fontSize: '0.75rem', background: 'var(--hover-bg)', padding: '2px 7px', borderRadius: '10px', color: 'var(--text-muted)' }}>
            {groups.length}
          </span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'friends' ? 'active' : ''}`}
          onClick={() => setActiveTab('friends')}
          style={{
            flex: 1,
            padding: '0.85rem 0.5rem',
            background: 'transparent',
            color: activeTab === 'friends' ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: '0.92rem',
            fontWeight: 700,
            borderBottom: activeTab === 'friends' ? '3px solid var(--accent)' : '3px solid transparent',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <span>SYNC</span>
          {pendingRequestsCount > 0 && (
            <span style={{
              background: '#ef4444',
              color: '#fff',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '10px',
              lineHeight: 1.2
            }}>
              {pendingRequestsCount}
            </span>
          )}
        </button>
      </div>

      {/* Offline Indicator Banner — only shows "Offline mode · Waiting for network" */}
      {!isOnline && (
        <div style={{
          background: 'rgba(234, 179, 8, 0.16)',
          borderBottom: '1px solid rgba(234, 179, 8, 0.35)',
          color: '#eab308',
          padding: '6px 14px',
          fontSize: '0.78rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <WifiOff size={14} style={{ flexShrink: 0 }} />
          <span>Offline mode · Waiting for network</span>
        </div>
      )}

      {/* WhatsApp-Style Search Input (Hidden on Friends tab as it has its own search) */}
      {activeTab !== 'friends' && (
        <div style={{ padding: '0.65rem 1rem', background: 'var(--bg-sidebar)' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search or start new chat..."
              className="form-input"
              style={{ paddingLeft: '2.5rem', borderRadius: '24px', fontSize: '0.92rem', paddingBlock: '0.65rem' }}
            />
          </div>
        </div>
      )}

      {/* Enable Notification Banner — only show if not dismissed & not already granted/denied */}
      {notifPermission === 'default' && (
        <div style={{
          margin: '0.4rem 0.75rem',
          padding: '0.65rem 0.85rem',
          borderRadius: '12px',
          background: 'rgba(99, 102, 241, 0.12)',
          border: '1px solid var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <Bell size={18} color="var(--accent)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-main)', lineHeight: 1.25 }}>
              Enable notifications for background messages
            </span>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            <button
              onClick={async () => {
                const granted = await requestNotificationPermission(true, token);
                setNotifPermission(granted ? 'granted' : 'denied');
                if (granted) {
                  showPushNotification('PulseChat Notifications Active! 🔔', 'You will now receive message notifications outside the app.');
                }
              }}
              className="btn-primary"
              style={{ padding: '4px 12px', fontSize: '0.78rem', borderRadius: '8px' }}
            >
              Allow
            </button>
            <button
              onClick={() => {
                dismissNotificationBanner();
                setNotifPermission('dismissed');
              }}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '4px 8px',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
              title="Dismiss — won't ask again"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* WhatsApp Chat / Group List Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.4rem', position: 'relative' }}>

        {/* SEARCH RESULTS — shown when user types in search box (works offline too) */}
        {searchQuery.trim().length > 0 ? (
          <div>
            <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', padding: '0.5rem 0.75rem', letterSpacing: '0.03em' }}>
              SEARCH RESULTS
            </p>
            {searchResults.length > 0 ? (
              searchResults.map(u => (
                <div
                  key={u.id}
                  onClick={() => u.isGroup ? handleSelectGroup(u) : handleSelectUser(u)}
                  className={`chat-item-row ${activeChat?.id === u.id ? 'active' : ''}`}
                  style={{ padding: '0.85rem 0.75rem', gap: '0.85rem' }}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <img
                      src={u.avatar}
                      alt="Avatar"
                      onError={(e) => {
                        e.target.src = u.isGroup
                          ? `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(u.name || 'Group')}`
                          : `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(u.username || u.displayName || 'User')}`;
                      }}
                      style={{ width: '48px', height: '48px', borderRadius: u.isGroup ? '14px' : '50%', objectFit: 'cover' }}
                    />
                    {!u.isGroup && !silentMode && onlineUsers.includes(u.id) && <div className="online-indicator-dot" style={{ width: '12px', height: '12px' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.displayName || u.name}
                      </h4>
                      {!u.isGroup && (
                        friendIdsSet.has(u.id) ? (
                          <span className="pulse-sync-btn synced" title="Pulse Frequency Synced">
                            <Sparkles size={12} /> Synced
                          </span>
                        ) : outgoingPendingIds.has(u.id) ? (
                          <span className="pulse-sync-btn pending" title="Pulse Sync Pending">
                            <Clock size={12} /> Beaming...
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="pulse-sync-btn sync"
                            onClick={(e) => handleSendFriendRequest(e, u.id)}
                            title="Sync Pulse Frequency to connect"
                          >
                            <Sparkles size={12} /> ⚡ Sync
                          </button>
                        )
                      )}
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.isGroup ? (u.description || `${u.members?.length || 0} members`) : `@${u.username}`}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.92rem' }}>
                <Search size={36} style={{ opacity: 0.25, marginBottom: '0.5rem' }} />
                <p style={{ margin: 0 }}>No contacts found for "{searchQuery}"</p>
                {!isOnline && <p style={{ fontSize: '0.78rem', marginTop: '0.4rem', color: '#eab308' }}>You are offline — only cached contacts shown</p>}
              </div>
            )}
          </div>

        ) : activeTab === 'friends' ? (
          /* FRIENDS TAB */
          <FriendsTab
            setActiveChat={handleSelectUser}
            onRequestsCountChange={setPendingRequestsCount}
            initialSubTab={friendsSubTab}
            onOpenFullDp={onOpenFullDp}
          />

        ) : activeTab === 'groups' ? (
          /* GROUPS TAB */
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem' }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', margin: 0, letterSpacing: '0.03em' }}>GROUPS ({groups.length})</p>
              <button
                onClick={() => setShowCreateGroupModal(true)}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}
              >
                + New Group
              </button>
            </div>

            {groups.length > 0 ? (
              groups.map(g => (
                <div
                  key={g.id}
                  onClick={() => handleSelectGroup(g)}
                  className={`chat-item-row ${activeChat?.id === g.id ? 'active' : ''}`}
                  style={{ padding: '0.85rem 0.75rem', gap: '0.85rem' }}
                >
                  <img
                    src={g.avatar}
                    alt="Group Avatar"
                    onError={(e) => {
                      e.target.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(g.name || 'Group')}`;
                    }}
                    style={{ width: '48px', height: '48px', borderRadius: '14px', objectFit: 'cover', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '2px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.description || `${g.members?.length || 0} members`}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.92rem' }}>
                <Users size={48} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                <p style={{ margin: 0 }}>No groups yet.</p>
                <button
                  onClick={() => setShowCreateGroupModal(true)}
                  className="btn-primary"
                  style={{ marginTop: '1rem', padding: '0.6rem 1.2rem', fontSize: '0.88rem' }}
                >
                  + Create First Group
                </button>
              </div>
            )}
          </div>

        ) : (
          /* CHATS TAB */
          <div>
            {/* Recent Conversations */}
            {recentChats.length > 0 && (
              <>
                <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', padding: '0.5rem 0.75rem', letterSpacing: '0.03em' }}>CHATS</p>
                {recentChats.map(u => (
                  <div
                    key={u.id}
                    onClick={() => handleSelectUser(u)}
                    className={`chat-item-row ${activeChat?.id === u.id ? 'active' : ''}`}
                    style={{ padding: '0.85rem 0.75rem', gap: '0.85rem' }}
                  >
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <img
                        src={u.avatar}
                        alt="Avatar"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenFullDp) onOpenFullDp(u.avatar, u.displayName, u.username);
                        }}
                        onError={(e) => {
                          e.target.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(u.username || u.displayName || 'User')}`;
                        }}
                        style={{ width: '48px', height: '48px', borderRadius: '50%', cursor: 'pointer', objectFit: 'cover' }}
                        title="Click to view full screen DP"
                      />
                      {!silentMode && onlineUsers.includes(u.id) && <div className="online-indicator-dot" style={{ width: '12px', height: '12px' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h4 style={{ fontSize: '1.02rem', fontWeight: u.unreadCount > 0 ? 700 : 600, margin: 0, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span>{u.displayName}</span>
                          {u.isPro && (
                            <span style={{ fontSize: '0.62rem', fontWeight: 800, background: 'linear-gradient(90deg, #f59e0b, #eab308)', color: '#000', padding: '0px 5px', borderRadius: '6px' }}>
                              👑 PRO
                            </span>
                          )}
                        </h4>
                        {u.unreadCount > 0 && (
                          <span className="unread-badge" style={{ marginLeft: '6px' }}>
                            {u.unreadCount}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '2px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.lastMessage ? u.lastMessage : `@${u.username}`}
                      </p>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Contacts Section — shown when there are cached users to start a new chat */}
            {contactsNotInRecent.length > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: recentChats.length > 0 ? '0.75rem 0.75rem 0.5rem' : '0.5rem 0.75rem' }}>
                  <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.03em', margin: 0 }}>
                    {recentChats.length > 0 ? 'DISCOVER PULSES' : 'PULSES'}
                  </p>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    ⚡ Sync to connect
                  </span>
                </div>
                {contactsNotInRecent.map(u => (
                  <div
                    key={u.id}
                    onClick={() => handleSelectUser(u)}
                    className={`chat-item-row ${activeChat?.id === u.id ? 'active' : ''}`}
                    style={{ padding: '0.85rem 0.75rem', gap: '0.85rem' }}
                  >
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <img
                        src={u.avatar}
                        alt="Avatar"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenFullDp) onOpenFullDp(u.avatar, u.displayName, u.username);
                        }}
                        onError={(e) => {
                          e.target.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(u.username || u.displayName || 'User')}`;
                        }}
                        style={{ width: '48px', height: '48px', borderRadius: '50%', cursor: 'pointer', objectFit: 'cover' }}
                        title="Click to view full screen DP"
                      />
                      {!silentMode && onlineUsers.includes(u.id) && <div className="online-indicator-dot" style={{ width: '12px', height: '12px' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ fontSize: '1.02rem', fontWeight: 600, margin: 0, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.displayName}
                        </h4>
                        {friendIdsSet.has(u.id) ? (
                          <span className="pulse-sync-btn synced" title="Pulse Frequency Synced">
                            <Sparkles size={12} /> Synced
                          </span>
                        ) : outgoingPendingIds.has(u.id) ? (
                          <span className="pulse-sync-btn pending" title="Pulse Sync Pending">
                            <Clock size={12} /> Beaming...
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="pulse-sync-btn sync"
                            onClick={(e) => handleSendFriendRequest(e, u.id)}
                            title="Sync Pulse Frequency to connect"
                          >
                            <Sparkles size={12} /> ⚡ Sync
                          </button>
                        )}
                      </div>
                      <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '2px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        @{u.username}
                      </p>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Empty state — only if truly no data at all */}
            {recentChats.length === 0 && contactsNotInRecent.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.92rem' }}>
                <p style={{ margin: 0 }}>No conversations yet.</p>
                <p style={{ fontSize: '0.82rem', marginTop: '0.4rem' }}>Type @username above to start messaging!</p>
              </div>
            )}
          </div>
        )}

        {/* WhatsApp-Style Mobile Floating Action Button (FAB) */}
        <button
          className="mobile-fab-btn"
          onClick={() => {
            if (activeTab === 'groups') {
              setShowCreateGroupModal(true);
            } else {
              const searchEl = document.querySelector('.sidebar-container input[type="text"]');
              if (searchEl) searchEl.focus();
            }
          }}
          title={activeTab === 'groups' ? 'Create New Group' : 'Start New Chat'}
        >
          {activeTab === 'groups' ? <Users size={24} /> : <Plus size={26} />}
        </button>
      </div>

      {showCreateGroupModal && (
        <CreateGroupModal
          onClose={() => setShowCreateGroupModal(false)}
          preloadedUsers={allUsers}
          onGroupCreated={(newGroup) => {
            loadGroups();
            handleSelectGroup(newGroup);
          }}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          onClose={() => setShowSettingsModal(false)}
          openProfileModal={openProfileModal}
          openCreateGroupModal={() => setShowCreateGroupModal(true)}
          silentMode={silentMode}
          setSilentMode={setSilentMode}
          openPanicModal={() => setShowPanicModal(true)}
        />
      )}

      {/* Panic Wipe Modal */}
      {showPanicModal && (
        <div className="modal-overlay">
          <div className="modal-card modal-responsive" style={{ maxWidth: '380px', textAlign: 'center' }}>
            <div style={{ padding: '1.5rem' }}>
              <ShieldAlert size={44} color="#ef4444" style={{ marginBottom: '0.75rem' }} />
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>
                Encrypted Panic Wipe
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                Are you sure you want to trigger a local Panic Wipe? This will immediately clear all active conversations.
              </p>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowPanicModal(false)}>Cancel</button>
                <button className="btn-primary" style={{ flex: 1, background: '#ef4444' }} onClick={handlePanicWipe}>Wipe All</button>
              </div>
            </div>
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
