import React, { useState, useEffect, useContext, useRef } from 'react';
import { X, Users, Check, Search, Camera, Image, Sparkles } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { BACKEND_URL } from '../../utils/config';

const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/identicon/svg?seed=group1',
  'https://api.dicebear.com/7.x/identicon/svg?seed=group2',
  'https://api.dicebear.com/7.x/identicon/svg?seed=group3',
  'https://api.dicebear.com/7.x/identicon/svg?seed=group4',
  'https://api.dicebear.com/7.x/bottts/svg?seed=cyber',
  'https://api.dicebear.com/7.x/bottts/svg?seed=pulse'
];

export default function CreateGroupModal({ onClose, onGroupCreated }) {
  const { token, user: currentUser } = useContext(AuthContext);
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState(PRESET_AVATARS[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setAllUsers(data.filter(u => u.id !== currentUser?.id));
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const toggleUserSelection = (userId) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAvatar(event.target.result);
      };
      reader.readAsDataURL(file);
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

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create group');

      if (onGroupCreated) onGroupCreated(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = allUsers.filter(u => {
    const q = searchQuery.trim().toLowerCase().replace(/^@/, '');
    if (!q) return true;
    const nameMatch = u.displayName ? u.displayName.toLowerCase().includes(q) : false;
    const usernameMatch = u.username ? u.username.toLowerCase().includes(q) : false;
    return nameMatch || usernameMatch;
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
            <div className="animated-search-wrapper" style={{ marginBottom: '10px' }}>
              <Search size={18} className="animated-search-icon" />
              <input
                type="text"
                className="animated-search-input"
                placeholder="Search users by name or @username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* User List scroll container */}
            <div style={{ maxHeight: '190px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '14px', padding: '6px', background: 'var(--bg-chat)' }}>
              {filteredUsers.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No users found</div>
              ) : (
                filteredUsers.map(u => {
                  const isSelected = selectedUserIds.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => toggleUserSelection(u.id)}
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

