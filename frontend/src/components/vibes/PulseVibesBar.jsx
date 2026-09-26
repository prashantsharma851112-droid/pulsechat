import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { Plus, Sparkles, Flame, Eye, Music } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';
import PulseVipBadge from '../common/PulseVipBadge';

export default function PulseVibesBar({ onOpenCreateVibe, onOpenVibeViewer }) {
  const { user, token } = useContext(AuthContext);
  const [groupedVibes, setGroupedVibes] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchActiveVibes = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/vibes/active`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setGroupedVibes(data);
      }
    } catch (e) {
      console.warn('Error loading active vibes:', e);
    }
  };

  useEffect(() => {
    fetchActiveVibes();
    const interval = setInterval(fetchActiveVibes, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [token]);

  // Separate user's own vibes from others
  const myVibesGroup = groupedVibes.find(g => g.userId === user?.id);
  const otherVibesGroups = groupedVibes.filter(g => g.userId !== user?.id);

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

        {/* Other Users' Stories */}
        {otherVibesGroups.map(group => (
          <div
            key={group.userId}
            onClick={() => onOpenVibeViewer(group)}
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
              background: 'linear-gradient(135deg, #f59e0b, #ec4899, #6366f1)',
              boxShadow: '0 0 12px rgba(236, 72, 153, 0.45)',
              animation: 'pulseGlow 2.5s infinite alternate'
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
            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-main)', maxWidth: '58px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {group.displayName.split(' ')[0]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
