import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { Plus } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';
import { getCachedAllUsers } from '../../utils/offlineStorage';

export default function PulseVibesBar({ onOpenCreateVibe, onOpenVibeViewer, onOpenVibeSelector, myAura }) {
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

    let combinedGroups = [...serverGroups];

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
          const currentList = combinedGroups[existingIdx].vibes || [];
          const merged = [...localGrp.vibes, ...currentList];
          const uniqueVibes = [];
          merged.forEach(v => {
            const isDup = uniqueVibes.some(uv => 
              uv.id === v.id || 
              (uv.caption === v.caption && uv.mediaUrl === v.mediaUrl && Math.abs(new Date(uv.createdAt).getTime() - new Date(v.createdAt).getTime()) < 25000)
            );
            if (!isDup) uniqueVibes.push(v);
          });
          combinedGroups[existingIdx].vibes = uniqueVibes;
        } else {
          if (isMyId(localGrp.userId)) {
            combinedGroups.unshift(localGrp);
          } else {
            combinedGroups.push(localGrp);
          }
        }
      });
    }

    // STRICT DEDUPLICATION AND CHRONOLOGICAL SORTING FOR EVERY GROUP:
    // Jo new lagaya vo aage (newest first, index 0), jo pehle lagaya tha vo last (oldest last)!
    combinedGroups.forEach(grp => {
      if (Array.isArray(grp.vibes)) {
        const seen = new Set();
        const cleanList = [];
        grp.vibes.forEach(v => {
          const contentKey = `${v.caption || ''}_${v.mediaUrl || ''}_${Math.floor(new Date(v.createdAt).getTime() / 25000)}`;
          if (!seen.has(v.id) && !seen.has(contentKey)) {
            seen.add(v.id);
            seen.add(contentKey);
            cleanList.push(v);
          }
        });
        // Sort newest first (b.createdAt - a.createdAt)
        cleanList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        grp.vibes = cleanList;
      }
    });

    // Remove empty groups and ensure my group is at the top
    combinedGroups = combinedGroups.filter(g => g.vibes && g.vibes.length > 0);
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

  const getGroupCrowns = (group) => {
    let king = Boolean(group?.hasKingCrown);
    let silver = Boolean(group?.hasSilverCrown);
    let streak = Boolean(group?.hasStreakCrown);

    if (!king && !silver && !streak && user?.id) {
      try {
        const cachedUsers = getCachedAllUsers(user.id || user._id);
        if (Array.isArray(cachedUsers)) {
          const matched = cachedUsers.find(u =>
            u.id === group?.userId ||
            u._id === group?.userId ||
            (u.username && group?.username && u.username.toLowerCase() === group.username.toLowerCase())
          );
          if (matched) {
            king = Boolean(matched.hasKingCrown);
            silver = Boolean(matched.hasSilverCrown);
            streak = Boolean(matched.hasStreakCrown);
          }
        }
      } catch (e) {}
    }
    return { king, silver, streak };
  };

  const myCrowns = getGroupCrowns(myVibesGroup);
  const myHasKing = Boolean(user?.hasKingCrown || myVibesGroup?.hasKingCrown || myCrowns.king);
  const myHasSilver = Boolean(user?.hasSilverCrown || myVibesGroup?.hasSilverCrown || myCrowns.silver);
  const myHasStreak = Boolean(user?.hasStreakCrown || myVibesGroup?.hasStreakCrown || myCrowns.streak);

  return (
    <div style={{
      padding: '10px 14px 8px 14px',
      background: 'rgba(0,0,0,0.2)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
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
            const allGroupsList = [
              ...(myVibesGroup && myVibesGroup.vibes?.length ? [myVibesGroup] : []),
              ...otherVibesGroups
            ];
            if (myVibesGroup && Array.isArray(myVibesGroup.vibes) && myVibesGroup.vibes.length > 0) {
              onOpenVibeViewer(myVibesGroup, allGroupsList);
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
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            padding: '2.5px',
            background: (myVibesGroup && Array.isArray(myVibesGroup.vibes) && myVibesGroup.vibes.length > 0)
              ? 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)'
              : 'rgba(255,255,255,0.18)',
            boxShadow: (myVibesGroup && Array.isArray(myVibesGroup.vibes) && myVibesGroup.vibes.length > 0)
              ? '0 0 14px rgba(220, 39, 67, 0.45)'
              : 'none'
          }}>
            {myHasKing ? (
              <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', fontSize: '1rem', filter: 'drop-shadow(0 2px 4px rgba(245, 158, 11, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 #1 Gold Leaderboard King">👑</div>
            ) : myHasSilver ? (
              <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', fontSize: '1rem', filter: 'drop-shadow(0 2px 4px rgba(203, 213, 225, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 #2 Silver Leaderboard Champion">👑</div>
            ) : myHasStreak ? (
              <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', fontSize: '1rem', filter: 'drop-shadow(0 2px 4px rgba(239, 68, 68, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 7-Day Gaming Streak Crown">👑</div>
            ) : null}
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', padding: '2px', background: 'var(--bg-card, #0f172a)' }}>
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
            </div>
            {/* Plus Icon Overlay */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: '#38bdf8',
              color: '#fff',
              border: '2px solid var(--bg-card, #0f172a)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.5)'
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
          if (!group || !Array.isArray(group.vibes) || group.vibes.length === 0) return null;
          const viewed = isGroupViewed(group);
          const crowns = getGroupCrowns(group);

          return (
            <div
              key={group.userId}
              onClick={() => {
                const allGroupsList = [
                  ...(myVibesGroup && myVibesGroup.vibes?.length ? [myVibesGroup] : []),
                  ...otherVibesGroups
                ];
                onOpenVibeViewer(group, allGroupsList);
              }}
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
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                padding: '2.5px',
                background: viewed
                  ? 'rgba(255, 255, 255, 0.22)'
                  : 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                boxShadow: viewed
                  ? 'none'
                  : '0 0 14px rgba(220, 39, 67, 0.45)',
                animation: viewed ? 'none' : 'pulseGlow 2.5s infinite alternate'
              }}>
                {crowns.king ? (
                  <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', fontSize: '1rem', filter: 'drop-shadow(0 2px 4px rgba(245, 158, 11, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 #1 Gold Leaderboard King">👑</div>
                ) : crowns.silver ? (
                  <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', fontSize: '1rem', filter: 'drop-shadow(0 2px 4px rgba(203, 213, 225, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 #2 Silver Leaderboard Champion">👑</div>
                ) : crowns.streak ? (
                  <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', fontSize: '1rem', filter: 'drop-shadow(0 2px 4px rgba(239, 68, 68, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 7-Day Gaming Streak Crown">👑</div>
                ) : null}
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', padding: '2px', background: 'var(--bg-card, #0f172a)' }}>
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
