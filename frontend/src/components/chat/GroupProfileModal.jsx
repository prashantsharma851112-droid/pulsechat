import React, { useState, useEffect, useContext, useRef } from 'react';
import { X, Users, Camera, Edit2, Check, UserPlus, Trash2, LogOut, Phone, Video, ShieldCheck, Search, Eye } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { BACKEND_URL } from '../../utils/config';

export default function GroupProfileModal({ group, onClose, onGroupUpdated, onStartCall, onOpenFullDp }) {
  const { user: currentUser, token } = useContext(AuthContext);
  const { onlineUsers } = useContext(SocketContext);

  const [groupData, setGroupData] = useState(group);
  const [memberUsers, setMemberUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Edit fields
  const [editName, setEditName] = useState(group.name || group.displayName || '');
  const [editDesc, setEditDesc] = useState(group.description || '');
  const [editAvatar, setEditAvatar] = useState(group.avatar || '');

  // Add Member section
  const [showAddMember, setShowAddMember] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [searchMemberQuery, setSearchMemberQuery] = useState('');
  const [selectedToAdd, setSelectedToAdd] = useState([]);

  const fileInputRef = useRef(null);
  const isAdmin = groupData.adminId === currentUser?.id;

  const fetchGroupDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/groups/${group.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data) {
        setGroupData(data);
        if (data.memberUsers) setMemberUsers(data.memberUsers);
        setEditName(data.name || '');
        setEditDesc(data.description || '');
        setEditAvatar(data.avatar || '');
      }
    } catch (err) {
      console.error('Error fetching group details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (group?.id) {
      fetchGroupDetails();
    }
  }, [group?.id]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setEditAvatar(event.target.result);
        if (!isEditing) setIsEditing(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveGroupEdit = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/groups/${group.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim(),
          avatar: editAvatar
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update group');

      setGroupData(data);
      if (data.memberUsers) setMemberUsers(data.memberUsers);
      setIsEditing(false);
      if (onGroupUpdated) onGroupUpdated(data);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Open Add Member Picker
  const handleOpenAddMember = async () => {
    setShowAddMember(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        const currentMemberIds = groupData.members || [];
        setAvailableUsers(data.filter(u => !currentMemberIds.includes(u.id)));
      }
    } catch (err) {
      console.error('Error fetching users to add:', err);
    }
  };

  const handleAddMemberSubmit = async (userId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/groups/${group.id}/add-member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId })
      });

      if (res.ok) {
        await fetchGroupDetails();
        setShowAddMember(false);
        if (onGroupUpdated) onGroupUpdated({ ...groupData });
      }
    } catch (err) {
      console.error('Failed to add member:', err);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/groups/${group.id}/remove-member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId })
      });

      const data = await res.json();
      if (res.ok) {
        setGroupData(data);
        if (data.memberUsers) setMemberUsers(data.memberUsers);
        if (onGroupUpdated) onGroupUpdated(data);
      }
    } catch (err) {
      console.error('Failed to remove member:', err);
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm('Are you sure you want to leave this group?')) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/groups/${group.id}/leave`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        onClose();
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to leave group:', err);
    }
  };

  const filteredAddUsers = availableUsers.filter(u => {
    const q = searchMemberQuery.trim().toLowerCase().replace(/^@/, '');
    if (!q) return true;
    return (
      (u.displayName && u.displayName.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q))
    );
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card modal-responsive modal-card-animated"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '440px', overflow: 'hidden' }}
      >
        {/* Banner Cover */}
        <div style={{
          height: '110px',
          background: 'linear-gradient(135deg, var(--accent) 0%, #10b981 100%)',
          position: 'relative',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          padding: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', fontSize: '0.85rem', fontWeight: 600, background: 'rgba(0,0,0,0.3)', padding: '4px 10px', borderRadius: '12px' }}>
            <Users size={14} /> Group Info
          </div>
          <button
            className="icon-btn-ghost"
            onClick={onClose}
            style={{ color: '#fff', background: 'rgba(0,0,0,0.25)', borderRadius: '50%', width: '32px', height: '32px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Profile Content */}
        <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', marginTop: '-45px', textAlign: 'center' }}>
          {/* Avatar with DP Edit Trigger */}
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '0.75rem' }}>
            <img
              src={isEditing ? editAvatar : groupData.avatar}
              alt="Group DP"
              onClick={() => onOpenFullDp && onOpenFullDp(isEditing ? editAvatar : groupData.avatar, groupData.name, 'group')}
              style={{
                width: '96px',
                height: '96px',
                borderRadius: '24px',
                objectFit: 'cover',
                border: '4px solid var(--bg-card)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                cursor: 'pointer'
              }}
              title="Click to view full screen DP"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Change Group DP"
              style={{
                position: 'absolute',
                bottom: '2px',
                right: '-4px',
                background: 'var(--accent)',
                color: '#fff',
                border: '3px solid var(--bg-card)',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
              }}
            >
              <Camera size={15} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>

          {/* Group Name & Description Edit */}
          {isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px', marginBottom: '1rem' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Group Name"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                style={{ textAlign: 'center', fontWeight: 600 }}
              />
              <input
                type="text"
                className="form-input"
                placeholder="Group Description"
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                style={{ textAlign: 'center', fontSize: '0.85rem' }}
              />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <button type="button" className="btn-secondary" style={{ padding: '6px 14px', fontSize: '0.8rem' }} onClick={() => setIsEditing(false)}>Cancel</button>
                <button type="button" className="btn-primary" style={{ padding: '6px 16px', fontSize: '0.8rem' }} onClick={handleSaveGroupEdit} disabled={loading}>
                  {loading ? 'Saving...' : 'Save Group Info'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {groupData.name}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="icon-btn-ghost"
                  title="Edit Group Info & DP"
                  style={{ width: '28px', height: '28px' }}
                >
                  <Edit2 size={15} color="var(--accent)" />
                </button>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                {groupData.description || 'No group bio provided'}
              </p>
            </div>
          )}

          {/* Quick Actions */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '1.25rem' }}>
            <button
              className="btn-secondary"
              onClick={handleOpenAddMember}
              style={{ flex: 1, padding: '8px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
            >
              <UserPlus size={15} color="var(--accent)" /> Add Member
            </button>
            <button
              className="btn-secondary"
              onClick={handleLeaveGroup}
              style={{ padding: '8px 12px', fontSize: '0.8rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <LogOut size={15} /> Leave
            </button>
          </div>

          {/* Add Member Drawer */}
          {showAddMember && (
            <div style={{ background: 'var(--bg-chat)', border: '1px solid var(--border)', borderRadius: '14px', padding: '12px', marginBottom: '1.25rem', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>Add People to Group</span>
                <button className="icon-btn-ghost" onClick={() => setShowAddMember(false)} style={{ padding: '4px' }}><X size={16} /></button>
              </div>

              <div className="animated-search-wrapper" style={{ marginBottom: '8px' }}>
                <Search size={15} className="animated-search-icon" />
                <input
                  type="text"
                  className="animated-search-input"
                  placeholder="Search user to add..."
                  value={searchMemberQuery}
                  onChange={e => setSearchMemberQuery(e.target.value)}
                  style={{ padding: '8px 10px' }}
                />
              </div>

              <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {filteredAddUsers.length === 0 ? (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '8px' }}>No available users to add</span>
                ) : (
                  filteredAddUsers.map(u => (
                    <div
                      key={u.id}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: '8px', background: 'var(--bg-card)' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img src={u.avatar} alt="User" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
                        <span style={{ fontSize: '0.83rem', fontWeight: 500, color: 'var(--text-main)' }}>{u.displayName}</span>
                      </div>
                      <button
                        className="btn-primary"
                        onClick={() => handleAddMemberSubmit(u.id)}
                        style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px' }}
                      >
                        Add
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Members List */}
          <div style={{ background: 'var(--bg-chat)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1rem', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Group Members ({memberUsers.length})
              </span>
            </div>

            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {memberUsers.map(m => {
                const isOnline = onlineUsers.includes(m.id);
                const isMemberAdmin = m.id === groupData.adminId;
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '10px',
                      background: 'var(--bg-card)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ position: 'relative' }}>
                        <img src={m.avatar} alt={m.displayName} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                        {isOnline && <div className="online-indicator-dot" style={{ width: '10px', height: '10px', border: '2px solid var(--bg-card)' }} />}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>{m.displayName}</span>
                          {isMemberAdmin && (
                            <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: '6px' }}>
                              Admin
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>@{m.username}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {m.id !== currentUser?.id && onStartCall && (
                        <>
                          <button
                            className="icon-btn-ghost"
                            onClick={() => { onClose(); onStartCall(false, m); }}
                            title={`Voice Call ${m.displayName}`}
                            style={{ padding: '6px' }}
                          >
                            <Phone size={15} color="var(--accent)" />
                          </button>
                          <button
                            className="icon-btn-ghost"
                            onClick={() => { onClose(); onStartCall(true, m); }}
                            title={`Video Call ${m.displayName}`}
                            style={{ padding: '6px' }}
                          >
                            <Video size={15} color="var(--accent)" />
                          </button>
                        </>
                      )}

                      {isAdmin && m.id !== currentUser?.id && (
                        <button
                          className="icon-btn-ghost"
                          onClick={() => handleRemoveMember(m.id)}
                          title="Remove from group"
                          style={{ padding: '6px', color: '#ef4444' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
