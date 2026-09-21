import React, { useState, useEffect, useContext, useRef } from 'react';
import { X, Users, Camera, Edit2, Check, UserPlus, Trash2, LogOut, Phone, Video, ShieldCheck, Search, Eye, Clock, CheckCircle2 } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { BACKEND_URL } from '../../utils/config';
import { compressImage, parseSafeJson } from '../../utils/imageCompressor';
import { updateGroupInStorage } from '../../utils/offlineStorage';

export default function GroupProfileModal({ group, onClose, onGroupUpdated, onStartCall, onOpenFullDp }) {
  const { user: currentUser, token } = useContext(AuthContext);
  const { socket, onlineUsers } = useContext(SocketContext);

  const [groupData, setGroupData] = useState(group);
  const [memberUsers, setMemberUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [disappearingEnabled, setDisappearingEnabled] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

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
  const targetGroupId = group?.id || group?._id;

  const fetchGroupDetails = async () => {
    if (!targetGroupId) return;
    try {
      setLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/groups/${targetGroupId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await parseSafeJson(res);
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
    if (targetGroupId) {
      fetchGroupDetails();
    }
  }, [targetGroupId]);

  // Fetch disappearing messages setting for this group
  useEffect(() => {
    if (!targetGroupId || !token) return;
    fetch(`${BACKEND_URL}/api/messages/settings/${targetGroupId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => parseSafeJson(r))
      .then(data => {
        if (data?.disappearingEnabled !== undefined) {
          setDisappearingEnabled(data.disappearingEnabled);
        }
      })
      .catch(() => {});
  }, [targetGroupId, token]);

  const handleToggleDisappearing = () => {
    if (!socket) return;
    const newVal = !disappearingEnabled;
    setDisappearingEnabled(newVal);
    socket.emit('toggle_disappearing', { chatId: group.id, enabled: newVal });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file, 360, 360, 0.82);
        setEditAvatar(compressed);
        if (!isEditing) setIsEditing(true);
      } catch (err) {
        alert(err.message || 'Failed to process image');
      } finally {
        e.target.value = '';
      }
    }
  };

  const handleSaveGroupEdit = async () => {
    if (!editName.trim()) {
      setSaveError('Group name cannot be empty');
      return;
    }
    try {
      setLoading(true);
      setSaveError('');
      const targetId = group?.id || group?._id;
      const res = await fetch(`${BACKEND_URL}/api/groups/${targetId}`, {
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

      const data = await parseSafeJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to update group');

      setGroupData(data);
      if (data.memberUsers) setMemberUsers(data.memberUsers);
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      // Instant multi-cache sync across storage, components, and sidebar
      updateGroupInStorage(data.id || targetId, data, currentUser?.id);
      if (onGroupUpdated) onGroupUpdated(data);
    } catch (err) {
      console.error('Error updating group:', err);
      setSaveError(err.message || 'Failed to update group.');
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
      const data = await parseSafeJson(res);
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
      const res = await fetch(`${BACKEND_URL}/api/groups/${targetGroupId}/add-member`, {
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
      const res = await fetch(`${BACKEND_URL}/api/groups/${targetGroupId}/remove-member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId })
      });

      const data = await parseSafeJson(res);
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
      const res = await fetch(`${BACKEND_URL}/api/groups/${targetGroupId}/leave`, {
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
              {saveError && (
                <div style={{ color: '#ef4444', fontSize: '0.8rem', textAlign: 'center', background: 'rgba(239,68,68,0.12)', padding: '6px 10px', borderRadius: '8px' }}>
                  ⚠️ {saveError}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <button type="button" className="btn-secondary" style={{ padding: '6px 14px', fontSize: '0.8rem' }} onClick={() => setIsEditing(false)}>Cancel</button>
                <button type="button" className="btn-primary" style={{ padding: '6px 16px', fontSize: '0.8rem' }} onClick={handleSaveGroupEdit} disabled={loading}>
                  {loading ? 'Saving...' : 'Save Group Info'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: '1.25rem' }}>
              {saveSuccess && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.8rem', fontWeight: 600, background: 'rgba(16,185,129,0.15)', padding: '4px 12px', borderRadius: '12px', marginBottom: '8px' }}>
                  <CheckCircle2 size={15} /> Group Info Saved!
                </div>
              )}
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

          {/* Disappearing Messages Toggle */}
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--bg-chat)', border: '1px solid var(--border)',
              borderRadius: '12px', padding: '10px 14px', marginBottom: '1rem', cursor: 'pointer'
            }}
            onClick={handleToggleDisappearing}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={16} color={disappearingEnabled ? 'var(--accent)' : 'var(--text-muted)'} />
              <div>
                <div style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  Disappearing Messages
                </div>
                <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                  {disappearingEnabled ? 'Messages delete after 24h' : 'Off — messages are kept'}
                </div>
              </div>
            </div>
            <div style={{
              width: '40px', height: '22px', borderRadius: '11px', position: 'relative', flexShrink: 0,
              background: disappearingEnabled ? 'var(--accent)' : 'var(--border)', transition: 'background 0.2s'
            }}>
              <div style={{
                position: 'absolute', top: '3px',
                left: disappearingEnabled ? '21px' : '3px',
                width: '16px', height: '16px', borderRadius: '50%',
                background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
              }} />
            </div>
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
