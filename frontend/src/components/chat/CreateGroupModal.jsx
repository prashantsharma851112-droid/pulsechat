import React, { useState, useEffect, useContext, useRef } from 'react';
import { X, Users, Check, Search, Camera, Image, Sparkles, Loader2 } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { BACKEND_URL } from '../../utils/config';
import { getCachedAllUsers, mergeIntoAllUsersCache, getCachedRecentChats } from '../../utils/offlineStorage';
import { compressImage, parseSafeJson } from '../../utils/imageCompressor';

const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/identicon/svg?seed=group1',
  'https://api.dicebear.com/7.x/identicon/svg?seed=group2',
  'https://api.dicebear.com/7.x/identicon/svg?seed=group3',
  'https://api.dicebear.com/7.x/identicon/svg?seed=group4',
  'https://api.dicebear.com/7.x/bottts/svg?seed=cyber',
  'https://api.dicebear.com/7.x/bottts/svg?seed=pulse'
];

export default function CreateGroupModal({ onClose, onGroupCreated, preloadedUsers = [] }) {
  const { token, user: currentUser } = useContext(AuthContext);
  const { socket } = useContext(SocketContext) || {};
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState(PRESET_AVATARS[0]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Instant offline cache + preloaded users preload so members show with 0ms latency
  const [allUsers, setAllUsers] = useState(() => {
    const passed = Array.isArray(preloadedUsers) ? preloadedUsers : [];
    const cached = getCachedAllUsers(currentUser?.id) || [];
    const recent = getCachedRecentChats(currentUser?.id) || [];
    const map = new Map();
    [...passed, ...cached, ...recent].forEach(u => {
      if (u && u.id && u.id !== currentUser?.id && !u.isGroup) {
        map.set(u.id, u);
      }
    });
    return Array.from(map.values());
  });

  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [selectedUsersMap, setSelectedUsersMap] = useState({}); // Keep selected users safe across searches
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(() => allUsers.length === 0);
  const [isSearchingServer, setIsSearchingServer] = useState(false);
  const [error, setError] = useState('');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (token) {
      fetchUsers();
    }
  }, [token, currentUser?.id]);

  // Live socket event for any new user registered while modal is open
  useEffect(() => {
    if (!socket) return;
    const handleNewUser = (newUser) => {
      if (newUser && newUser.id && newUser.id !== currentUser?.id) {
        setAllUsers(prev => {
          if (prev.some(u => u.id === newUser.id)) return prev;
          return [newUser, ...prev];
        });
      }
    };
    socket.on('new_user_registered', handleNewUser);
    return () => socket.off('new_user_registered', handleNewUser);
  }, [socket, currentUser?.id]);

  const fetchUsers = async () => {
    try {
      // Fetch both all users and friends in parallel
      const [usersRes, friendsRes] = await Promise.allSettled([
        fetch(`${BACKEND_URL}/api/users`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${BACKEND_URL}/api/friends`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const loadedList = [];
      if (usersRes.status === 'fulfilled' && usersRes.value.ok) {
        const uData = await parseSafeJson(usersRes.value);
        if (Array.isArray(uData)) loadedList.push(...uData);
      }
      if (friendsRes.status === 'fulfilled' && friendsRes.value.ok) {
        const fData = await parseSafeJson(friendsRes.value);
        if (fData?.friends && Array.isArray(fData.friends)) loadedList.push(...fData.friends);
      }

      if (loadedList.length > 0) {
        const cleanList = loadedList.filter(u => u && u.id && u.id !== currentUser?.id);
        setAllUsers(prev => {
          const map = new Map();
          prev.forEach(u => map.set(u.id, u));
          cleanList.forEach(u => map.set(u.id, u));
          return Array.from(map.values());
        });
        if (currentUser?.id) {
          mergeIntoAllUsersCache(currentUser.id, cleanList);
        }
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setInitialLoading(false);
    }
  };

  // Live dynamic debounced search to find ANY user in database
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase().replace(/^@/, '');
    if (!q) {
      setIsSearchingServer(false);
      return;
    }

    setIsSearchingServer(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/users/search?q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const serverResults = await parseSafeJson(res);
        if (Array.isArray(serverResults) && serverResults.length > 0) {
          const cleanServerUsers = serverResults.filter(u => u && u.id && u.id !== currentUser?.id);
          setAllUsers(prev => {
            const map = new Map();
            cleanServerUsers.forEach(u => map.set(u.id, u));
            prev.forEach(u => {
              if (!map.has(u.id)) map.set(u.id, u);
            });
            return Array.from(map.values());
          });
          if (currentUser?.id) {
            mergeIntoAllUsersCache(currentUser.id, cleanServerUsers);
          }
        }
      } catch (e) {
        console.warn('Live search error:', e);
      } finally {
        setIsSearchingServer(false);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [searchQuery, token, currentUser?.id]);

  const toggleUserSelection = (targetUser) => {
    const userId = targetUser.id;
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
      setSelectedUsersMap(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
      setSelectedUsersMap(prev => ({
        ...prev,
        [userId]: targetUser
      }));
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file, 360, 360, 0.82);
        setAvatar(compressed);
      } catch (err) {
        setError(err.message || 'Failed to process group avatar');
      } finally {
        e.target.value = '';
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setError('Please enter a group name.');
      return;
    }
    if (selectedUserIds.length === 0) {
      setError('Please select at least 1 member to create a group.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/groups/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: groupName.trim(),
          description: description.trim(),
          avatar,
          memberIds: selectedUserIds
        })
      });

      const data = await parseSafeJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to create group');

      if (onGroupCreated) onGroupCreated(data);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = allUsers.filter(u => {
    const q = searchQuery.trim().toLowerCase().replace(/^@/, '');
    if (!q) return true;
    const nameMatch = u.displayName ? u.displayName.toLowerCase().includes(q) : false;
    const usernameMatch = u.username ? u.username.toLowerCase().includes(q) : false;
    const emailMatch = u.email ? u.email.toLowerCase().includes(q) : false;
    return nameMatch || usernameMatch || emailMatch;
  });

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-responsive modal-card-animated" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} color="var(--accent)" />
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)' }}>Create New Group</h3>
          </div>
          <button className="icon-btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <div className="error-banner">{error}</div>}

          {/* Group Avatar DP Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div className="group-avatar-ring" onClick={() => fileInputRef.current?.click()} title="Click to upload Group DP">
              <img
                src={avatar}
                alt="Group DP"
                style={{ width: '76px', height: '76px', borderRadius: '22px', objectFit: 'cover', border: '2px solid var(--accent)', boxShadow: '0 4px 14px rgba(0,0,0,0.3)' }}
              />
              <div className="edit-overlay">
                <Camera size={22} />
              </div>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            <button
              type="button"
              onClick={() => setShowAvatarPicker(!showAvatarPicker)}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Sparkles size={14} /> {showAvatarPicker ? 'Hide Avatar Presets' : 'Choose Preset Avatar'}
            </button>

            {showAvatarPicker && (
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '6px 0', width: '100%', justifyContent: 'center' }}>
                {PRESET_AVATARS.map((url, index) => (
                  <img
                    key={index}
                    src={url}
                    alt="Preset"
                    onClick={() => setAvatar(url)}
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      border: avatar === url ? '2px solid var(--accent)' : '1px solid var(--border)',
                      padding: '2px',
                      background: 'var(--bg-card)',
                      transition: 'all 0.2s ease'
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="form-label">Group Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Developers Club 🚀"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="form-label">Description (Optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="What is this group about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ margin: 0 }}>Select Members ({selectedUserIds.length} selected)</label>
            </div>

            {/* Glowing Animated Search Bar */}
            <div className="animated-search-wrapper" style={{ marginBottom: '10px', position: 'relative' }}>
              <Search size={18} className="animated-search-icon" />
              <input
                type="text"
                className="animated-search-input"
                placeholder="Search users by name, @username, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {isSearchingServer && (
                <Loader2 size={16} className="animate-spin" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)' }} />
              )}
            </div>

            {/* User List scroll container */}
            <div style={{ maxHeight: '190px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '14px', padding: '6px', background: 'var(--bg-chat)' }}>
              {initialLoading && allUsers.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent)' }} />
                  <span>Loading contacts...</span>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {isSearchingServer ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent)' }} />
                      <span>Searching for "{searchQuery}"...</span>
                    </div>
                  ) : (searchQuery.trim() ? `No users found matching "${searchQuery}". Check spelling or try @username.` : 'No contacts available yet.')}
                </div>
              ) : (
                filteredUsers.map(u => {
                  const isSelected = selectedUserIds.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => toggleUserSelection(u)}
                      className={`user-select-card ${isSelected ? 'selected' : ''}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src={u.avatar} alt="User" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '0.88rem', color: 'var(--text-main)' }}>{u.displayName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{u.username}</div>
                        </div>
                      </div>
                      <div style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '6px',
                        border: isSelected ? 'none' : '2px solid var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isSelected ? 'var(--accent)' : 'transparent',
                        transition: 'all 0.2s ease'
                      }}>
                        {isSelected && <Check size={14} color="#fff" className="check-pop-icon" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

