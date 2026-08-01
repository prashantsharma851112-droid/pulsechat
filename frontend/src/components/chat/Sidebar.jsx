import React, { useState, useContext, useEffect, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { Search, Settings, User, LogOut, Users, CheckCircle2, Plus, EyeOff, ShieldAlert } from 'lucide-react';
import CreateGroupModal from './CreateGroupModal';
import { BACKEND_URL } from '../../utils/config';

export default function Sidebar({ activeChat, setActiveChat, openProfileModal, openSettingsModal }) {
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

  const loadRecentChats = useCallback(() => {
    fetch(`${BACKEND_URL}/api/users/recent`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setRecentChats(data);
      })
      .catch(() => {});
  }, [token]);

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
    if (activeChat) loadRecentChats();
  }, [activeChat, loadRecentChats]);

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
      {/* User Profile Header */}
      <div className="sidebar-header">
        <div className="user-profile-badge" onClick={openProfileModal}>
          <div style={{ position: 'relative' }}>
            <img src={user?.avatar} alt="Profile" className="user-avatar" />
            {user?.isEmailVerified && (
              <CheckCircle2
                size={14}
                color="#10b981"
                style={{ position: 'absolute', bottom: 0, right: 0, background: '#fff', borderRadius: '50%' }}
              />
            )}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, whiteSpace: 'nowrap' }}>{user?.displayName}</h4>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>@{user?.username}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.2rem' }}>
          <button
            onClick={() => setSilentMode(!silentMode)}
            title={silentMode ? 'Selective Silent Mode Active (Incognito Online)' : 'Selective Silent Mode (Hide Online Status)'}
            className="icon-btn-ghost"
            style={{ color: silentMode ? '#f59e0b' : 'var(--text-muted)' }}
          >
            <EyeOff size={18} />
          </button>
          <button
            onClick={() => setShowPanicModal(true)}
            title="Panic Wipe (Clear Sensitive Chats)"
            className="icon-btn-ghost"
            style={{ color: '#ef4444' }}
          >
            <ShieldAlert size={18} />
          </button>
          <button onClick={() => setShowCreateGroupModal(true)} title="New Group" className="icon-btn-ghost"><Plus size={18} /></button>
          <button onClick={openProfileModal} title="Edit Profile" className="icon-btn-ghost"><User size={18} /></button>
          <button onClick={openSettingsModal} title="Settings" className="icon-btn-ghost"><Settings size={18} /></button>
          <button onClick={logout} title="Logout" className="icon-btn-ghost" style={{ color: '#ef4444' }}><LogOut size={18} /></button>
        </div>
      </div>

      {/* Tabs: Chats vs Groups */}
      <div className="sidebar-tabs">
        <button
          className={`tab-btn ${activeTab === 'chats' ? 'active' : ''}`}
          onClick={() => setActiveTab('chats')}
        >
          Chats
        </button>
        <button
          className={`tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
          onClick={() => setActiveTab('groups')}
        >
          Groups ({groups.length})
        </button>
      </div>

      {/* Search Input */}
      <div style={{ padding: '0.75rem 1rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name or @username..."
            className="form-input"
            style={{ paddingLeft: '2.2rem', borderRadius: '20px' }}
          />
        </div>
      </div>

      {/* List Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
        {searchResults.length > 0 ? (
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.5rem 0.5rem' }}>SEARCH RESULTS</p>
            {searchResults.map(u => (
              <div
                key={u.id}
                onClick={() => handleSelectUser(u)}
                className={`chat-item-row ${activeChat?.id === u.id ? 'active' : ''}`}
              >
                <div style={{ position: 'relative' }}>
                  <img src={u.avatar} alt="Avatar" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                  {!silentMode && onlineUsers.includes(u.id) && <div className="online-indicator-dot" />}
                </div>
                <div>
                  <h4 style={{ fontSize: '0.9rem', margin: 0 }}>{u.displayName}</h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>@{u.username}</p>
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'groups' ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>YOUR GROUPS</p>
              <button
                onClick={() => setShowCreateGroupModal(true)}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
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
                >
                  <img src={g.avatar} alt="Group Avatar" style={{ width: '40px', height: '40px', borderRadius: '12px' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>{g.name}</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.description || `${g.members?.length || 0} members`}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No groups joined yet. Click "+ New Group" to create one!
              </div>
            )}
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.5rem 0.5rem' }}>DIRECT MESSAGES</p>
            {recentChats.length > 0 ? (
              recentChats.map(u => (
                <div
                  key={u.id}
                  onClick={() => handleSelectUser(u)}
                  className={`chat-item-row ${activeChat?.id === u.id ? 'active' : ''}`}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <img src={u.avatar} alt="Avatar" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                    {!silentMode && onlineUsers.includes(u.id) && <div className="online-indicator-dot" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: u.unreadCount > 0 ? 700 : 500, margin: 0 }}>{u.displayName}</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.lastMessageFromMe ? 'You: ' : ''}{u.lastMessage || `@${u.username}`}
                    </p>
                  </div>
                  {u.unreadCount > 0 && (
                    <span className="unread-badge">
                      {u.unreadCount}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>
                Search @username above to start messaging!
              </p>
            )}
          </div>
        )}
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
