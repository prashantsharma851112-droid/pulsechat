import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { Plus, Sparkles } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';

export default function PulseVibesBar({ onOpenCreateVibe, onOpenVibeViewer }) {
  const { user, token } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);
  const [groupedVibes, setGroupedVibes] = useState([]);
  const [viewedSet, setViewedSet] = useState(new Set());

  const syncViewedSet = () => {
    try {
      const raw = localStorage.getItem('pulsechat_viewed_vibes');
      if (raw) {
        setViewedSet(new Set(JSON.parse(raw)));
      }
    } catch (e) {}
  };

  const isMyId = (id) => {
    if (!id) return false;
    const uId = user?.id;
    const uMongo = user?._id;
    const uName = user?.username;
    return id === uId || id === uMongo || (uMongo && id === uMongo.toString()) || id === uName;
  };

  const isGroupViewed = (group) => {
    if (!group || !group.vibes || group.vibes.length === 0) return true;
    return group.vibes.every(v => viewedSet.has(v.id));
  };

  const fetchActiveVibes = async () => {
    let serverGroups = [];
    if (token) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/vibes/active`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) serverGroups = data;
        }
      } catch (e) {
        console.warn('Backend vibes offline, using local storage.');
      }
    }

    // Load active LocalStorage vibes
    let localVibes = [];
    try {
      const raw = localStorage.getItem('pulsechat_local_vibes');
      if (raw) {
        const items = JSON.parse(raw);
        const now = Date.now();
        localVibes = items.filter(v => (now - new Date(v.createdAt).getTime()) < 24 * 60 * 60 * 1000);
      }
    } catch (e) {}

    // Merge ALL active local vibes grouped by userId (so ANY user's local or socket vibes are visible)
    if (localVibes.length > 0) {
      const localMap = {};
      localVibes.forEach(vibe => {
        const uId = vibe.userId || (vibe.username ? `user_${vibe.username}` : 'local_user');
        if (!localMap[uId]) {
          localMap[uId] = {
            userId: uId,
            username: vibe.username || 'user',
            displayName: vibe.displayName || vibe.username || 'User',
            avatar: vibe.avatar || '',
            vibes: []
          };
        }
        localMap[uId].vibes.push(vibe);
      });

      Object.values(localMap).forEach(localGrp => {
        const existingIdx = combinedGroups.findIndex(g => isMyId(g.userId) ? isMyId(localGrp.userId) : (g.userId === localGrp.userId || (g.username && g.username === localGrp.username)));
        if (existingIdx >= 0) {
          const existingIds = new Set(combinedGroups[existingIdx].vibes.map(v => v.id));
          const newVibes = localGrp.vibes.filter(v => !existingIds.has(v.id));
          combinedGroups[existingIdx].vibes = [...newVibes, ...combinedGroups[existingIdx].vibes];
        } else {
          if (isMyId(localGrp.userId)) {
            combinedGroups.unshift(localGrp);
          } else {
            combinedGroups.push(localGrp);
          }
        }
      });
    }

    setGroupedVibes(combinedGroups);
  };

  useEffect(() => {
    fetchActiveVibes();
    syncViewedSet();

    const interval = setInterval(() => {
      fetchActiveVibes();
      syncViewedSet();
    }, 10000);

    const handleUpdate = () => {
      fetchActiveVibes();
      syncViewedSet();
    };
    window.addEventListener('pulsechat_vibes_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    let bc;
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel('pulsechat_vibes_channel');
      bc.onmessage = () => {
        fetchActiveVibes();
        syncViewedSet();
      };
    }

    if (socket) {
      socket.on('new_vibe_posted', handleUpdate);
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener('pulsechat_vibes_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      if (bc) bc.close();
      if (socket) {
        socket.off('new_vibe_posted', handleUpdate);
      }
    };
  }, [token, user, socket]);

  // Separate user's own vibes from others
  const myVibesGroup = groupedVibes.find(g => isMyId(g.userId));
  const otherVibesGroups = groupedVibes.filter(g => !isMyId(g.userId));

  return (
    <div style={{
      padding: '12px 14px 10px 14px',
      background: 'rgba(0,0,0,0.2)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-main)' }}>
          <Sparkles size={16} color="#f59e0b" />
          <span>Pulse Vibes ⚡</span>
          <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)', fontWeight: 500 }}>(24h Stories)</span>
        </div>
        <button
          onClick={onOpenCreateVibe}
          style={{
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            padding: '3px 9px',
            fontSize: '0.72rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.35)'
          }}
        >
          <Plus size={12} /> Post Vibe
        </button>
      </div>

      {/* Story Bubbles Horizontal Scroll Tray */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        overflowX: 'auto',
        paddingBottom: '4px',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none'
      }}>
        {/* User's own Story Item */}
        <div
          onClick={() => {
            if (myVibesGroup && myVibesGroup.vibes.length > 0) {
              onOpenVibeViewer(myVibesGroup);
            } else {
              onOpenCreateVibe();
            }
          }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
            flexShrink: 0
          }}
        >
          <div style={{
            position: 'relative',
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            padding: '2.5px',
            background: myVibesGroup && myVibesGroup.vibes.length > 0
              ? 'linear-gradient(135deg, #f59e0b, #ec4899, #6366f1)'
              : 'rgba(255,255,255,0.15)',
            boxShadow: myVibesGroup && myVibesGroup.vibes.length > 0
              ? '0 0 12px rgba(245, 158, 11, 0.45)'
              : 'none'
          }}>
            <img
              src={user?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.username || 'user'}`}
              alt="My Vibe"
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                objectFit: 'cover',
                background: '#111'
              }}
            />
            {/* Plus Icon Overlay */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: '#6366f1',
              color: '#fff',
              border: '2px solid var(--bg-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Plus size={11} strokeWidth={3} />
            </div>
          </div>
          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', maxWidth: '58px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            My Vibe
          </span>
        </div>

        {/* Other Users' / Friends' Stories */}
        {otherVibesGroups.map(group => {
          const viewed = isGroupViewed(group);
          return (
            <div
              key={group.userId}
              onClick={() => onOpenVibeViewer(group)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                flexShrink: 0,
                opacity: viewed ? 0.65 : 1
              }}
            >
              <div style={{
                position: 'relative',
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                padding: '2.5px',
                background: viewed
                  ? 'linear-gradient(135deg, #64748b, #94a3b8)'
                  : 'linear-gradient(135deg, #f59e0b, #ec4899, #6366f1)',
                boxShadow: viewed
                  ? 'none'
                  : '0 0 12px rgba(236, 72, 153, 0.45)',
                animation: viewed ? 'none' : 'pulseGlow 2.5s infinite alternate'
              }}>
                <img
                  src={group.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${group.username || 'vibe'}`}
                  alt={group.displayName}
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    background: '#111'
                  }}
                />
              </div>
              <span style={{ fontSize: '0.68rem', fontWeight: 600, color: viewed ? 'var(--text-muted)' : 'var(--text-main)', maxWidth: '58px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {group.displayName ? group.displayName.split(' ')[0] : 'User'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
