import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { Search, Settings, User, LogOut, MessageSquare } from 'lucide-react';

export default function Sidebar({ activeChat, setActiveChat, openProfileModal, openSettingsModal }) {
  const { user, logout, token } = useContext(AuthContext);
  const { onlineUsers } = useContext(SocketContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Search Users
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => setSearchResults(data));
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, token]);

  const handleSelectUser = (selectedUser) => {
    setActiveChat(selectedUser);
    setSearchQuery('');
  };

  return (
    <div style={{ width: '340px', background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* User Header */}
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={openProfileModal}>
          <img src={user.avatar} alt="Profile" style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent)' }} />
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{user.displayName}</h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{user.username}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={openProfileModal} title="Edit Profile (DP/Status)" style={{ background: 'transparent', color: 'var(--text-muted)', padding: '6px' }}><User size={20} /></button>
          <button onClick={openSettingsModal} title="Themes & Settings" style={{ background: 'transparent', color: 'var(--text-muted)', padding: '6px' }}><Settings size={20} /></button>
          <button onClick={logout} title="Logout" style={{ background: 'transparent', color: '#ef4444', padding: '6px' }}><LogOut size={20} /></button>
        </div>
      </div>

      {/* Search Input */}
      <div style={{ padding: '0.75rem 1rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by name or @username..." style={{ width: '100%', padding: '0.6rem 0.6rem 0.6rem 2.2rem', borderRadius: '20px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.85rem' }} />
        </div>
      </div>

      {/* Chat / Search Results List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
        {searchResults.length > 0 ? (
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.5rem 0.5rem' }}>SEARCH RESULTS</p>
            {searchResults.map(u => (
              <div key={u.id} onClick={() => handleSelectUser(u)} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '10px', cursor: 'pointer', background: activeChat?.id === u.id ? 'var(--bg-card)' : 'transparent' }}>
                <div style={{ position: 'relative' }}>
                  <img src={u.avatar} alt="Avatar" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                  {onlineUsers.includes(u.id) && <div style={{ position: 'absolute', right: 0, bottom: 0, width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', border: '2px solid var(--bg-sidebar)' }} />}
                </div>
                <div>
                  <h4 style={{ fontSize: '0.9rem' }}>{u.displayName}</h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{u.username}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.5rem 0.5rem' }}>CHATS</p>
            {activeChat ? (
              <div onClick={() => setActiveChat(activeChat)} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '10px', cursor: 'pointer', background: 'var(--bg-card)' }}>
                <img src={activeChat.avatar} alt="Avatar" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                <div>
                  <h4 style={{ fontSize: '0.9rem' }}>{activeChat.displayName}</h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{activeChat.username}</p>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>Search @username above to start chatting!</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
