import React, { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { X, Music, Trash2, Zap, Eye } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';
import { playSound } from '../../utils/audio';

export default function VibeViewerModal({ vibeGroup, onClose, onRefresh }) {
  const { user, token, updateUserProfile } = useContext(AuthContext);
  const vibes = vibeGroup?.vibes || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [sparksMsg, setSparksMsg] = useState('');
  const currentVibe = vibes[currentIndex] || vibes[0];
  const timerRef = useRef(null);

  const currentUserId = user?.id || user?._id || 'local_user';
  const isMine = currentVibe?.userId === currentUserId || vibeGroup?.userId === currentUserId;

  // Mark current story as viewed
  useEffect(() => {
    if (currentVibe && token && !isMine && currentVibe.id && !currentVibe.id.startsWith('vibe_')) {
      fetch(`${BACKEND_URL}/api/vibes/view/${currentVibe.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }
  }, [currentVibe?.id, token, isMine]);

  // Story Auto-Advance Progress Bar Timer (5s per story)
  useEffect(() => {
    setProgress(0);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          if (currentIndex < vibes.length - 1) {
            setCurrentIndex(c => c + 1);
            return 0;
          } else {
            clearInterval(timerRef.current);
            onClose();
            return 100;
          }
        }
        return prev + 2;
      });
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, vibes.length, onClose]);

  const handleNext = () => {
    if (currentIndex < vibes.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleReact = async (emoji, tipSparks = 0) => {
    if (!currentVibe) return;
    playSound('pop');

    if (tipSparks > 0) {
      setSparksMsg(`⚡ Tipped ${tipSparks} Sparks to ${vibeGroup?.displayName || 'User'}!`);
      const currentSparks = user?.pulseSparks || 100;
      const newBalance = Math.max(0, currentSparks - tipSparks);
      if (updateUserProfile) {
        updateUserProfile({ ...user, pulseSparks: newBalance });
      }
      setTimeout(() => setSparksMsg(''), 3000);
    }

    if (token && currentVibe.id && !currentVibe.id.startsWith('vibe_')) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/vibes/react/${currentVibe.id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ emoji, tipSparks })
        });
        const data = await res.json();
        if (data.success && data.remainingSparks !== undefined && updateUserProfile) {
          updateUserProfile({ ...user, pulseSparks: data.remainingSparks });
        }
      } catch (e) {}
    }
  };

  const handleDelete = async () => {
    if (!currentVibe) return;

    // Delete from LocalStorage if present
    try {
      const raw = localStorage.getItem('pulsechat_local_vibes');
      if (raw) {
        const items = JSON.parse(raw);
        const filtered = items.filter(v => v.id !== currentVibe.id);
        localStorage.setItem('pulsechat_local_vibes', JSON.stringify(filtered));
      }
    } catch (e) {}

    window.dispatchEvent(new CustomEvent('pulsechat_vibes_updated'));

    if (token && currentVibe.id && !currentVibe.id.startsWith('vibe_')) {
      try {
        await fetch(`${BACKEND_URL}/api/vibes/${currentVibe.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (e) {}
    }

    if (onRefresh) onRefresh();
    onClose();
  };

  if (!currentVibe) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1400, background: 'rgba(0,0,0,0.92)' }}>
      <div
        style={{
          position: 'relative',
          maxWidth: '420px',
          width: '100%',
          height: 'min(760px, 92dvh)',
          borderRadius: '24px',
          overflow: 'hidden',
          background: currentVibe.mediaUrl ? '#000' : currentVibe.bgGradient,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
          border: '1px solid rgba(255,255,255,0.15)'
        }}
      >
        {/* Top Progress Bars */}
        <div style={{
          position: 'absolute',
          top: 12,
          left: 12,
          right: 12,
          display: 'flex',
          gap: '4px',
          zIndex: 10
        }}>
          {vibes.map((v, i) => (
            <div
              key={v.id || i}
              style={{
                flex: 1,
                height: '3px',
                borderRadius: '2px',
                background: 'rgba(255,255,255,0.3)',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  height: '100%',
                  background: '#fff',
                  width: i < currentIndex ? '100%' : i === currentIndex ? `${progress}%` : '0%',
                  transition: 'width 0.1s linear'
                }}
              />
            </div>
          ))}
        </div>

        {/* Top Header info (Creator avatar & Close) */}
        <div style={{
          position: 'absolute',
          top: 24,
          left: 14,
          right: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10,
          color: '#fff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img
              src={vibeGroup?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${vibeGroup?.username || 'user'}`}
              alt={vibeGroup?.displayName}
              style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #fff' }}
            />
            <div>
              <div style={{ fontSize: '0.86rem', fontWeight: 800, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                {vibeGroup?.displayName || 'User'}
              </div>
              <div style={{ fontSize: '0.68rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Music size={11} /> {currentVibe.soundtrack !== 'none' ? currentVibe.soundtrack : 'Vibe Story'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isMine && (
              <button
                onClick={handleDelete}
                className="icon-btn-ghost"
                title="Delete Story"
                style={{ color: '#ef4444', background: 'rgba(0,0,0,0.4)', borderRadius: '50%' }}
              >
                <Trash2 size={16} />
              </button>
            )}
            <button
              onClick={onClose}
              className="icon-btn-ghost"
              style={{ color: '#fff', background: 'rgba(0,0,0,0.4)', borderRadius: '50%' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Media or Text Content Body */}
        <div
          onClick={(e) => {
            const width = e.currentTarget.offsetWidth;
            const clickX = e.nativeEvent.offsetX;
            if (clickX < width / 3) handlePrev();
            else handleNext();
          }}
          style={{
            flex: 1,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          {currentVibe.mediaUrl ? (
            <img
              src={currentVibe.mediaUrl}
              alt="Vibe Content"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <h2 style={{
              color: '#fff',
              fontSize: '1.45rem',
              fontWeight: 800,
              textAlign: 'center',
              lineHeight: 1.4,
              textShadow: '0 2px 10px rgba(0,0,0,0.8)',
              padding: '0 10px'
            }}>
              {currentVibe.caption}
            </h2>
          )}

          {/* Caption Overlay if Media present */}
          {currentVibe.mediaUrl && currentVibe.caption && (
            <div style={{
              position: 'absolute',
              bottom: '80px',
              left: '16px',
              right: '16px',
              background: 'rgba(0,0,0,0.65)',
              backdropFilter: 'blur(8px)',
              padding: '10px 14px',
              borderRadius: '14px',
              color: '#fff',
              fontSize: '0.9rem',
              fontWeight: 600,
              textAlign: 'center'
            }}>
              {currentVibe.caption}
            </div>
          )}

          {/* Toast Msg for Sparks Tip */}
          {sparksMsg && (
            <div style={{
              position: 'absolute',
              top: '80px',
              background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
              color: '#fff',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 800,
              boxShadow: '0 4px 15px rgba(245, 158, 11, 0.5)',
              animation: 'pulseModalPop 0.2s'
            }}>
              {sparksMsg}
            </div>
          )}
        </div>

        {/* Bottom Reaction Bar */}
        <div style={{
          padding: '14px 16px',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10
        }}>
          {isMine ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem', fontWeight: 600 }}>
              <Eye size={16} color="#6366f1" />
              <span>{currentVibe.views?.length || 0} Views</span>
              {currentVibe.sparksEarned > 0 && (
                <span style={{ color: '#f59e0b', marginLeft: '10px' }}>⚡ {currentVibe.sparksEarned} Sparks Tipped!</span>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'space-between' }}>
              {/* Quick Emojis */}
              <div style={{ display: 'flex', gap: '6px' }}>
                {['❤️', '🔥', '😂', '👏'].map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => handleReact(emoji)}
                    style={{
                      background: 'rgba(255,255,255,0.12)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '36px',
                      height: '36px',
                      fontSize: '1.1rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Tip Sparks Button */}
              <button
                onClick={() => handleReact('⚡', 10)}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '7px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 3px 10px rgba(245, 158, 11, 0.4)'
                }}
              >
                <Zap size={14} fill="#fff" /> Tip 10 Sparks
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
