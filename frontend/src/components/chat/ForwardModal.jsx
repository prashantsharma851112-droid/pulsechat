import React, { useState, useMemo } from 'react';
import { X, Search, Check, Send, Users, Shield } from 'lucide-react';
import { getCachedRecentChats, getCachedGroups, getCachedAllUsers } from '../../utils/offlineStorage';
import PulseVipBadge from '../common/PulseVipBadge';

export default function ForwardModal({ message, onClose, onForward, currentUserId }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTargets, setSelectedTargets] = useState([]);
  const [isSending, setIsSending] = useState(false);

  // Load available forward targets
  const candidateTargets = useMemo(() => {
    const targets = [];
    const seenIds = new Set();

    // 1. Recent chats
    const recent = getCachedRecentChats(currentUserId) || [];
    recent.forEach(c => {
      const id = c.id || c._id;
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        targets.push({
          id,
          name: c.displayName || c.username || c.name || 'Chat',
          avatar: c.avatar,
          isGroup: !!c.isGroup,
          isPro: !!c.isPro,
          hasKingCrown: !!c.hasKingCrown,
          hasSilverCrown: !!c.hasSilverCrown,
          hasStreakCrown: !!c.hasStreakCrown
        });
      }
    });

    // 2. Groups
    const groups = getCachedGroups(currentUserId) || [];
    groups.forEach(g => {
      const id = g.id || g._id;
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        targets.push({
          id,
          name: g.name || g.displayName || 'Group',
          avatar: g.avatar,
          isGroup: true,
          isPro: false
        });
      }
    });

    // 3. All known users
    const allUsers = getCachedAllUsers(currentUserId) || [];
    allUsers.forEach(u => {
      const id = u.id || u._id;
      if (id && id !== currentUserId && !seenIds.has(id)) {
        seenIds.add(id);
        targets.push({
          id,
          name: u.displayName || u.username || 'Pulse User',
          avatar: u.avatar,
          isGroup: false,
          isPro: !!u.isPro,
          hasKingCrown: !!u.hasKingCrown,
          hasSilverCrown: !!u.hasSilverCrown,
          hasStreakCrown: !!u.hasStreakCrown
        });
      }
    });

    return targets;
  }, [currentUserId]);

  const filteredTargets = useMemo(() => {
    if (!searchQuery.trim()) return candidateTargets;
    const q = searchQuery.toLowerCase();
    return candidateTargets.filter(t => t.name.toLowerCase().includes(q));
  }, [candidateTargets, searchQuery]);

  const toggleSelect = (target) => {
    setSelectedTargets(prev => {
      const exists = prev.some(t => t.id === target.id);
      if (exists) {
        return prev.filter(t => t.id !== target.id);
      } else {
        return [...prev, target];
      }
    });
  };

  const handleConfirmForward = async () => {
    if (selectedTargets.length === 0 || isSending) return;
    setIsSending(true);
    try {
      await onForward(selectedTargets, message);
      onClose();
    } catch (err) {
      console.error('Error forwarding message:', err);
      setIsSending(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={onClose}>
      <div
        className="modal-card modal-responsive"
        style={{
          maxWidth: '440px',
          width: '92vw',
          maxHeight: '80vh',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'var(--bg-card)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Forward Message
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Select chats or contacts to share with
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-btn-ghost"
            style={{ width: '34px', height: '34px', borderRadius: '50%' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Message Preview snippet */}
        <div style={{
          padding: '10px 18px',
          background: 'rgba(99, 102, 241, 0.08)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div style={{
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1
          }}>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Forwarding: </span>
            {message?.type === 'image' ? '📷 Photo' :
             message?.type === 'audio' ? '🎵 Voice Note' :
             message?.type === 'gift' ? '🎁 Sticker' :
             message?.type === 'poll' ? '📊 Poll' :
             (message?.content || 'Message')}
          </div>
        </div>

        {/* Search Input */}
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
          <div className="input-with-icon" style={{ position: 'relative', width: '100%' }}>
            <Search
              size={17}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none'
              }}
            />
            <input
              type="text"
              placeholder="Search contacts and groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 14px 9px 38px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                color: 'var(--text-main)',
                fontSize: '0.86rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {/* List of Contacts/Chats */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0', minHeight: '180px', maxHeight: '320px' }}>
          {filteredTargets.length === 0 ? (
            <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No chats or contacts found
            </div>
          ) : (
            filteredTargets.map(target => {
              const isSelected = selectedTargets.some(t => t.id === target.id);
              return (
                <div
                  key={target.id}
                  onClick={() => toggleSelect(target)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 18px',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                    <div style={{ position: 'relative' }}>
                      <img
                        src={target.avatar || (target.isGroup
                          ? `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(target.name)}`
                          : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(target.name)}`
                        )}
                        alt={target.name}
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: target.isGroup ? '10px' : '50%',
                          objectFit: 'cover',
                          border: target.hasKingCrown
                            ? '2px solid #fbbf24'
                            : target.hasSilverCrown
                            ? '2px solid #cbd5e1'
                            : target.hasStreakCrown
                            ? '2px solid #f97316'
                            : '1px solid rgba(255,255,255,0.1)'
                        }}
                      />
                      {target.hasKingCrown && (
                        <span style={{ position: 'absolute', top: '-6px', right: '-4px', fontSize: '13px' }}>👑</span>
                      )}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {target.name}
                        </span>
                        {target.isGroup && (
                          <span style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>
                            Group
                          </span>
                        )}
                        {!target.isGroup && target.isPro && (
                          <PulseVipBadge size={14} showLabel={false} />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Selection Checkbox */}
                  <div style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '6px',
                    border: isSelected ? 'none' : '2px solid rgba(255,255,255,0.2)',
                    background: isSelected ? 'var(--accent)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                    marginLeft: '12px'
                  }}>
                    {isSelected && <Check size={14} color="#fff" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          borderTop: '1px solid var(--border)',
          background: 'rgba(0,0,0,0.2)'
        }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {selectedTargets.length} selected
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              style={{ padding: '6px 14px', fontSize: '0.82rem', borderRadius: '10px' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmForward}
              disabled={selectedTargets.length === 0 || isSending}
              className="btn-primary"
              style={{
                padding: '6px 18px',
                fontSize: '0.82rem',
                borderRadius: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                opacity: selectedTargets.length === 0 || isSending ? 0.5 : 1,
                cursor: selectedTargets.length === 0 || isSending ? 'not-allowed' : 'pointer'
              }}
            >
              <Send size={14} />
              <span>{isSending ? 'Forwarding...' : `Forward (${selectedTargets.length})`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
