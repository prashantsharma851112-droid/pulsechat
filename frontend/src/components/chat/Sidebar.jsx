import React, { useState, useContext, useEffect, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { Search, Settings, User, LogOut, Users, CheckCircle2, Plus, EyeOff, ShieldAlert } from 'lucide-react';
import CreateGroupModal from './CreateGroupModal';
import SettingsModal from '../profile/SettingsModal';
import { BACKEND_URL } from '../../utils/config';

export default function Sidebar({ activeChat, setActiveChat, openProfileModal, openSettingsModal, onOpenFullDp }) {
  const { user, logout, token } = useContext(AuthContext);
  const { socket, onlineUsers, lastNotification } = useContext(SocketContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [recentChats, setRecentChats] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'groups'
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);

  // Next-Gen Feature States
  const [silentMode, setSilentMode] = useState(false);
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const loadRecentChats = useCallback(() => {
    fetch(`${BACKEND_URL}/api/users/recent`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setRecentChats(data.map(item => {
            if (activeChat && item.id === activeChat.id) {
              return { ...item, unreadCount: 0 };
            }
            return item;
          }));
        }
      })
      .catch(() => {});
  }, [token, activeChat]);

  const loadGroups = useCallback(() => {
    fetch(`${BACKEND_URL}/api/groups`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setGroups(data);
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    loadRecentChats();
    loadGroups();
  }, [loadRecentChats, loadGroups]);

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
    const handleChatRead = () => {
      loadRecentChats();
    };
    socket.on('chat_read_update', handleChatRead);
    return () => socket.off('chat_read_update', handleChatRead);
  }, [socket, loadRecentChats]);

  // Search Users
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      fetch(`${BACKEND_URL}/api/users/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setSearchResults(data);
        });
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, token]);

  const handleSelectUser = (selectedUser) => {
    setActiveChat(selectedUser);
    setSearchQuery('');
  };

  const handleSelectGroup = (group) => {
    setActiveChat({
      ...group,
      isGroup: true,
      displayName: group.name,
      id: group.id
    });
    setSearchQuery('');
  };

  const handlePanicWipe = () => {
    if (socket && user) {
      socket.emit('panic_wipe', { userId: user.id });
      setRecentChats([]);
      setActiveChat(null);
    }
    setShowPanicModal(false);
  };

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
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                PulseChat
              </h3>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.displayName} (@{user?.username})
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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

      {/* WhatsApp Chat / Group List Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.4rem', position: 'relative' }}>
        {searchResults.length > 0 ? (
          <div>
            <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', padding: '0.5rem 0.75rem', letterSpacing: '0.03em' }}>SEARCH RESULTS</p>
            {searchResults.map(u => (
              <div
                key={u.id}
                onClick={() => handleSelectUser(u)}
                className={`chat-item-row ${activeChat?.id === u.id ? 'active' : ''}`}
                style={{ padding: '0.85rem 0.75rem', gap: '0.85rem' }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <img src={u.avatar} alt="Avatar" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
                  {!silentMode && onlineUsers.includes(u.id) && <div className="online-indicator-dot" style={{ width: '12px', height: '12px' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>{u.displayName}</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>@{u.username}</p>
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'groups' ? (
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
          <div>
            <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', padding: '0.5rem 0.75rem', letterSpacing: '0.03em' }}>CHATS</p>
            {recentChats.length > 0 ? (
              recentChats.map(u => (
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: u.unreadCount > 0 ? 700 : 600, margin: 0, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.displayName}
                      </h4>
                      {u.lastMessageTime && (
                        <span style={{ fontSize: '0.75rem', color: u.unreadCount > 0 ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0 }}>
                          {u.lastMessageTime}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <p style={{ fontSize: '0.85rem', color: u.unreadCount > 0 ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: u.unreadCount > 0 ? 500 : 400, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.lastMessageFromMe ? 'You: ' : ''}{u.lastMessage || `@${u.username}`}
                      </p>
                      {u.unreadCount > 0 && (
                        <span className="unread-badge" style={{ marginLeft: '6px' }}>
                          {u.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
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
