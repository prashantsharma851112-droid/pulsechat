import React, { useState, useContext, useEffect, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { Search, Settings, User, LogOut, Users, CheckCircle2, Plus, EyeOff, ShieldAlert, Bell, WifiOff, RotateCw } from 'lucide-react';
import CreateGroupModal from './CreateGroupModal';
import SettingsModal from '../profile/SettingsModal';
import { BACKEND_URL } from '../../utils/config';
import { requestNotificationPermission, showPushNotification, dismissNotificationBanner, subscribeUserToPush } from '../../utils/notifications';
import {
  getCachedRecentChats,
  setCachedRecentChats,
  getCachedGroups,
  setCachedGroups,
  getCachedAllUsers,
  setCachedAllUsers,
  mergeIntoAllUsersCache,
  isDeviceOnline,
  subscribeToNetworkChanges
} from '../../utils/offlineStorage';

export default function Sidebar({ activeChat, setActiveChat, openProfileModal, openSettingsModal, onOpenFullDp }) {
  const { user, logout, token } = useContext(AuthContext);
  const { socket, onlineUsers, lastNotification } = useContext(SocketContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [recentChats, setRecentChats] = useState(() => getCachedRecentChats(user?.id));
  const [groups, setGroups] = useState(() => getCachedGroups(user?.id));
  const [allUsers, setAllUsers] = useState(() => getCachedAllUsers(user?.id));
  const [isOnline, setIsOnline] = useState(() => isDeviceOnline());
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'groups'
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);

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
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const mapped = data.map(item => {
            if (activeChat && item.id === activeChat.id) {
              return { ...item, unreadCount: 0 };
            }
            return item;
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
  }, [token, activeChat, user?.id]);

  const loadGroups = useCallback(() => {
    if (!token) return;
    fetch(`${BACKEND_URL}/api/groups`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
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
      .then(res => res.json())
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
      loadRecentChats();
    }
  }, [activeChat, loadRecentChats]);

  useEffect(() => {
    if (!socket) return;
    const handleRefresh = () => {
      loadRecentChats();
    };
    socket.on('chat_read_update', handleRefresh);
    socket.on('messages_delivered', handleRefresh);
    socket.on('message_delivered_update', handleRefresh);
    return () => {
      socket.off('chat_read_update', handleRefresh);
      socket.off('messages_delivered', handleRefresh);
      socket.off('message_delivered_update', handleRefresh);
    };
  }, [socket, loadRecentChats]);

  // Search Users — offline-first: always search cache first, then try network
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length === 0) {
      setSearchResults([]);
      return;
    }

    // 1. Immediately show local cache results (works offline too)
    const localUsers = getCachedAllUsers(user?.id) || [];
    const localRecent = getCachedRecentChats(user?.id) || [];

    // Merge allUsers + recentChats to search across both lists (deduplicate by id)
    const seenIds = new Set();
    const combined = [];
    for (const u of [...localUsers, ...localRecent]) {
      if (!seenIds.has(u.id)) {
        seenIds.add(u.id);
        combined.push(u);
      }
    }

    const localMatches = combined.filter(u => {
      const nameMatch = (u.displayName || '').toLowerCase().includes(q);
      const usernameMatch = (u.username || '').toLowerCase().includes(q);
      return nameMatch || usernameMatch;
    });

    setSearchResults(localMatches);

    // 2. Also try network if online (merge fresh results)
    if (isOnline) {
      fetch(`${BACKEND_URL}/api/users/search?q=${encodeURIComponent(searchQuery.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            // Cache the new users we discovered
            if (user?.id) mergeIntoAllUsersCache(user.id, data);
            // Merge with local matches (deduplicate)
            const serverIds = new Set(data.map(u => u.id));
            const merged = [
              ...data,
              ...localMatches.filter(u => !serverIds.has(u.id))
            ];
            setSearchResults(merged);
          }
        })
        .catch(() => {
          // Already showing local results, nothing to do
        });
    }
  }, [searchQuery, token, user?.id, isOnline]);

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
            <img src={user?.avatar} alt="Profile" className="user-avatar" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent)' }} />
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
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              @{user?.username}
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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
            padding: '0.85rem',
            background: 'transparent',
            color: activeTab === 'groups' ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: '0.95rem',
            fontWeight: 700,
            borderBottom: activeTab === 'groups' ? '3px solid var(--accent)' : '3px solid transparent',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <span>GROUPS</span>
          <span style={{ fontSize: '0.75rem', background: 'var(--hover-bg)', padding: '2px 7px', borderRadius: '10px', color: 'var(--text-muted)' }}>
            {groups.length}
          </span>
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

      {/* WhatsApp-Style Search Input */}
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
                      style={{ width: '48px', height: '48px', borderRadius: u.isGroup ? '14px' : '50%', objectFit: 'cover' }}
                    />
                    {!u.isGroup && !silentMode && onlineUsers.includes(u.id) && <div className="online-indicator-dot" style={{ width: '12px', height: '12px' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.displayName || u.name}
                    </h4>
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
                  <img src={g.avatar} alt="Group Avatar" style={{ width: '48px', height: '48px', borderRadius: '14px', objectFit: 'cover', flexShrink: 0 }} />
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
                        style={{ width: '48px', height: '48px', borderRadius: '50%', cursor: 'pointer', objectFit: 'cover' }}
                        title="Click to view full screen DP"
                      />
                      {!silentMode && onlineUsers.includes(u.id) && <div className="online-indicator-dot" style={{ width: '12px', height: '12px' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h4 style={{ fontSize: '1.02rem', fontWeight: u.unreadCount > 0 ? 700 : 600, margin: 0, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.displayName}
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
                <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', padding: recentChats.length > 0 ? '0.75rem 0.75rem 0.5rem' : '0.5rem 0.75rem', letterSpacing: '0.03em' }}>
                  {recentChats.length > 0 ? 'MORE CONTACTS' : 'CONTACTS'}
                </p>
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
                        style={{ width: '48px', height: '48px', borderRadius: '50%', cursor: 'pointer', objectFit: 'cover' }}
                        title="Click to view full screen DP"
                      />
                      {!silentMode && onlineUsers.includes(u.id) && <div className="online-indicator-dot" style={{ width: '12px', height: '12px' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontSize: '1.02rem', fontWeight: 600, margin: 0, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.displayName}
                      </h4>
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
    </div>
  );
}
