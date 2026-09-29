import React, { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { X, Music, Trash2, Zap, Eye, Send, Users, Volume2, VolumeX, Disc } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';
import { playSound } from '../../utils/audio';
import { updateRecentChatSnippet, getCachedAllUsers } from '../../utils/offlineStorage';

import ChatLiveWallpaper from '../chat/ChatLiveWallpaper';

export default function VibeViewerModal({ vibeGroup, onClose, onRefresh }) {
  const { user, token, updateUserProfile } = useContext(AuthContext);
  const vibes = vibeGroup?.vibes || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [sparksMsg, setSparksMsg] = useState('');
  const [replyText, setReplyText] = useState('');
  const [showViewersSheet, setShowViewersSheet] = useState(false);
  const [liveViews, setLiveViews] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const currentVibe = vibes[currentIndex] || vibes[0];
  const timerRef = useRef(null);
  const audioRef = useRef(null);

  const currentUserId = user?.id || user?._id || 'local_user';
  const isMine = currentVibe?.userId === currentUserId || vibeGroup?.userId === currentUserId;

  const isKing = vibeGroup?.hasKingCrown || (isMine && user?.hasKingCrown);
  const isSilver = vibeGroup?.hasSilverCrown || (isMine && user?.hasSilverCrown);
  const isStreak = vibeGroup?.hasStreakCrown || (isMine && user?.hasStreakCrown);

  let hasKing = Boolean(isKing);
  let hasSilver = Boolean(isSilver);
  let hasStreak = Boolean(isStreak);

  if (!hasKing && !hasSilver && !hasStreak && user?.id) {
    try {
      const cachedUsers = getCachedAllUsers(user.id || user._id);
      if (Array.isArray(cachedUsers)) {
        const targetKey = vibeGroup?.userId || currentVibe?.userId;
        const targetUsername = vibeGroup?.username || currentVibe?.username;
        const matched = cachedUsers.find(u =>
          u.id === targetKey ||
          u._id === targetKey ||
          (u.username && targetUsername && u.username.toLowerCase() === targetUsername.toLowerCase())
        );
        if (matched) {
          hasKing = Boolean(matched.hasKingCrown);
          hasSilver = Boolean(matched.hasSilverCrown);
          hasStreak = Boolean(matched.hasStreakCrown);
        }
      }
    } catch (e) {}
  }

  // Mark current story as viewed in LocalStorage and send view ping to Backend
  useEffect(() => {
    if (currentVibe && currentVibe.id) {
      setLiveViews(currentVibe.views || []);

      // Always fetch fresh live views for THIS specific story ID
      if (token && currentVibe.id) {
        fetch(`${BACKEND_URL}/api/vibes/views/${currentVibe.id}?t=${Date.now()}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => {
            if (data.success && data.views) {
              setLiveViews(data.views);
            }
          })
          .catch(() => {});
      }

      try {
        const rawViewed = localStorage.getItem('pulsechat_viewed_vibes');
        const viewedSet = new Set(rawViewed ? JSON.parse(rawViewed) : []);
        if (!viewedSet.has(currentVibe.id)) {
          viewedSet.add(currentVibe.id);
          localStorage.setItem('pulsechat_viewed_vibes', JSON.stringify(Array.from(viewedSet)));
          window.dispatchEvent(new CustomEvent('pulsechat_vibes_updated'));
        }
      } catch (e) {}

      if (token && !isMine && currentVibe.id) {
        fetch(`${BACKEND_URL}/api/vibes/view/${currentVibe.id}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => {
            if (data.views) setLiveViews(data.views);
          })
          .catch(() => {});
      }
    }
  }, [currentVibe?.id, token, isMine]);

  // Auto-play Instagram Music Track / Story Background Audio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (currentVibe?.audioUrl) {
      const audio = new Audio(currentVibe.audioUrl);
      audio.loop = true;
      audio.volume = isAudioMuted ? 0 : 0.85;
      audio.play().catch(e => console.warn('Autoplay prevented:', e));
      audioRef.current = audio;
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [currentVibe?.audioUrl, currentVibe?.id, currentIndex]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isAudioMuted ? 0 : 0.85;
    }
  }, [isAudioMuted]);

  // Fetch live views for owner when modal opens
  const fetchLiveViews = async () => {
    if (token && currentVibe?.id) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/vibes/views/${currentVibe.id}?t=${Date.now()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.views) {
          setLiveViews(data.views);
        }
      } catch (e) {}
    }
  };

  // Story Auto-Advance Progress Bar Timer (5s per story, pauses when viewers sheet is open)
  useEffect(() => {
    if (isPaused || showViewersSheet) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

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
  }, [currentIndex, vibes.length, onClose, isPaused, showViewersSheet]);

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

  const handleReact = async (emoji, tipSparks = 0, textMsg = '') => {
    if (!currentVibe) return;
    playSound('pop');

    const storyAuthorId = currentVibe.userId || vibeGroup?.userId;
    const authorName = vibeGroup?.displayName || vibeGroup?.username || 'User';

    let msgText = '';
    if (textMsg && textMsg.trim()) {
      msgText = textMsg.trim();
    } else if (tipSparks > 0) {
      msgText = `Tipped ⚡ ${tipSparks} Sparks on story`;
    } else if (emoji) {
      msgText = `Reacted ${emoji} to story`;
    }

    // 1. INSTANT LOCAL RECENT CHATS UPDATE (0ms latency, zero chat disappearance!)
    if (user?.id && storyAuthorId && msgText) {
      const chatId = [user.id, storyAuthorId].sort().join('_');
      const tempMsg = {
        id: 'msg_vibe_temp_' + Date.now(),
        chatId,
        senderId: user.id,
        receiverId: storyAuthorId,
        isGroup: false,
        content: msgText,
        type: 'text',
        status: 'sent',
        timestamp: new Date().toISOString()
      };
      const targetChatObj = {
        id: storyAuthorId,
        displayName: authorName,
        avatar: vibeGroup?.avatar || '',
        isGroup: false
      };
      updateRecentChatSnippet(user.id, chatId, tempMsg, targetChatObj);
      window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));
    }

    if (tipSparks > 0) {
      setSparksMsg(`⚡ Tipped ${tipSparks} Sparks to ${authorName}!`);
      const currentSparks = user?.pulseSparks || 100;
      const newBalance = Math.max(0, currentSparks - tipSparks);
      if (updateUserProfile) {
        updateUserProfile({ ...user, pulseSparks: newBalance });
      }
      setTimeout(() => setSparksMsg(''), 3000);
    } else if (emoji || textMsg) {
      const toastText = textMsg ? `Sent reply to ${authorName} in Chat! 💬` : `Reacted ${emoji} in Chat! 💬`;
      setSparksMsg(toastText);
      setTimeout(() => setSparksMsg(''), 3000);
    }

    if (textMsg) {
      setReplyText('');
    }

    // 2. BACKGROUND PERSISTENCE & SOCKET EMISSION
    if (token && currentVibe.id) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/vibes/react/${currentVibe.id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ emoji, tipSparks, replyText: textMsg })
        });
        const data = await res.json();
        if (data.success && data.createdMessage && user?.id) {
          updateRecentChatSnippet(user.id, data.createdMessage.chatId, data.createdMessage, {
            id: storyAuthorId,
            displayName: authorName,
            avatar: vibeGroup?.avatar || ''
          });
          window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));
        }
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

    if (token && currentVibe.id) {
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
          background: currentVibe.bgGradient || 'linear-gradient(135deg, #6366f1, #a855f7)',
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
            <div style={{ position: 'relative', width: '36px', height: '36px', flexShrink: 0 }}>
              {hasKing ? (
                <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.85rem', filter: 'drop-shadow(0 2px 4px rgba(245, 158, 11, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 #1 Gold Leaderboard King">👑</div>
              ) : hasSilver ? (
                <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.85rem', filter: 'drop-shadow(0 2px 4px rgba(203, 213, 225, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 #2 Silver Leaderboard Champion">👑</div>
              ) : hasStreak ? (
                <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.85rem', filter: 'drop-shadow(0 2px 4px rgba(239, 68, 68, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 7-Day Gaming Streak Crown">👑</div>
              ) : null}
              <img
                src={vibeGroup?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${vibeGroup?.username || 'user'}`}
                alt={vibeGroup?.displayName}
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #fff' }}
              />
            </div>
            <div>
              <div style={{ fontSize: '0.86rem', fontWeight: 800, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                {vibeGroup?.displayName || 'User'}
              </div>
              <div style={{ fontSize: '0.68rem', opacity: 0.95, display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontWeight: 600 }}>
                <Music size={11} /> {currentVibe.songTitle ? `🎵 ${currentVibe.songTitle} · ${currentVibe.artistName}` : currentVibe.soundtrack !== 'none' ? currentVibe.soundtrack : 'Vibe Story'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {currentVibe?.audioUrl && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAudioMuted(prev => !prev);
                }}
                className="icon-btn-ghost"
                style={{ color: '#fff', background: 'rgba(0,0,0,0.4)', borderRadius: '50%', padding: '6px' }}
                title={isAudioMuted ? "Unmute Story Music" : "Mute Story Music"}
              >
                {isAudioMuted ? <VolumeX size={16} color="#ef4444" /> : <Volume2 size={16} color="#f59e0b" />}
              </button>
            )}
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

        {/* Live Canvas Background if selected (ALWAYS rendered even with media) */}
        {currentVibe.animatedBg && currentVibe.animatedBg !== 'none' && (
          <ChatLiveWallpaper wallpaperId={currentVibe.animatedBg} />
        )}

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
            padding: currentVibe.imageFit === 'padded' ? '50px 30px' : '40px 20px',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          {currentVibe.mediaUrl ? (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: currentVibe.imageFit === 'padded' ? '16px' : '0px',
              overflow: 'hidden'
            }}>
              <img
                src={currentVibe.mediaUrl}
                alt="Vibe Content"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: currentVibe.imageFit === 'padded' ? 'contain' : (currentVibe.imageFit || 'contain'),
                  transform: `scale(${currentVibe.imageZoom || 1.0})`,
                  filter: currentVibe.imageFilter === 'warm' ? 'saturate(1.4) contrast(1.15)' :
                          currentVibe.imageFilter === 'cyber' ? 'hue-rotate(180deg) saturate(1.5)' :
                          currentVibe.imageFilter === 'vintage' ? 'sepia(0.4) contrast(1.1)' :
                          currentVibe.imageFilter === 'bw' ? 'grayscale(0.85) contrast(1.2)' : 'none',
                  opacity: currentVibe.imageOpacity || 1.0
                }}
              />
            </div>
          ) : null}

          {/* 3D Text Card or Text Overlay */}
          <div style={{ position: 'relative', zIndex: 4, width: '100%', display: 'flex', justifyContent: 'center' }}>
            {currentVibe.textStyle3D && currentVibe.textStyle3D !== 'none' ? (
              <div className={`animated-3d-stage ${currentVibe.textStyle3D}`} style={{ position: 'relative', zIndex: 4, maxWidth: '100%' }}>
                <div className="animated-3d-card" style={{ padding: '12px 20px', background: 'transparent', boxShadow: 'none', border: 'none' }}>
                  <div className="text-3d-content" style={{ fontSize: `${(currentVibe.textSize || 1.3) * 1.1}rem`, textAlign: currentVibe.textAlign || 'center' }}>
                    {currentVibe.caption}
                  </div>
                  <div className="text-3d-shadow" />
                </div>
              </div>
            ) : currentVibe.caption && !currentVibe.mediaUrl ? (
              <h2 style={{
                color: '#fff',
                fontSize: `${(currentVibe.textSize || 1.3) * 1.15}rem`,
                fontWeight: 800,
                textAlign: currentVibe.textAlign || 'center',
                lineHeight: 1.4,
                textShadow: '0 2px 10px rgba(0,0,0,0.85)',
                padding: '0 10px'
              }}>
                {currentVibe.caption}
              </h2>
            ) : null}
          </div>

          {/* Floating Sticker Badges */}
          {currentVibe.selectedStickers && currentVibe.selectedStickers.length > 0 && (
            <div style={{
              position: 'absolute',
              bottom: currentVibe.mediaUrl && currentVibe.caption ? '145px' : '90px',
              right: '20px',
              display: 'flex',
              gap: '6px',
              zIndex: 7,
              background: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(8px)',
              padding: '4px 10px',
              borderRadius: '20px'
            }}>
              {currentVibe.selectedStickers.map(s => (
                <span key={s} style={{ fontSize: '1.3rem', animation: 'bounce 2s infinite' }}>{s}</span>
              ))}
            </div>
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
              textAlign: currentVibe.textAlign || 'center',
              zIndex: 5
            }}>
              {currentVibe.caption}
            </div>
          )}

          {/* Instagram Music Vinyl Sticker */}
          {currentVibe?.songTitle && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                bottom: currentVibe.mediaUrl && currentVibe.caption ? '145px' : '90px',
                left: '16px',
                background: 'rgba(0, 0, 0, 0.78)',
                backdropFilter: 'blur(12px)',
                padding: '6px 14px 6px 8px',
                borderRadius: '24px',
                border: '1px solid rgba(245, 158, 11, 0.6)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                zIndex: 6,
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                maxWidth: '240px',
                animation: 'pulseFadeIn 0.22s ease'
              }}
            >
              <div style={{ position: 'relative', width: '28px', height: '28px', flexShrink: 0 }}>
                <img
                  src={currentVibe.albumArt || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(currentVibe.songTitle)}`}
                  alt="Track"
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    animation: isAudioMuted ? 'none' : 'spin 3.5s linear infinite'
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  🎵 {currentVibe.songTitle}
                </span>
                <span style={{ fontSize: '0.66rem', color: '#f59e0b', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentVibe.artistName || 'Original Audio'}
                </span>
              </div>
              {!isAudioMuted && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '12px', flexShrink: 0 }}>
                  <span style={{ width: '2px', height: '100%', background: '#ec4899', borderRadius: '1px', animation: 'pulseGlow 0.4s infinite alternate' }} />
                  <span style={{ width: '2px', height: '60%', background: '#f59e0b', borderRadius: '1px', animation: 'pulseGlow 0.7s infinite alternate' }} />
                  <span style={{ width: '2px', height: '80%', background: '#6366f1', borderRadius: '1px', animation: 'pulseGlow 0.5s infinite alternate' }} />
                </div>
              )}
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

        {/* Bottom Reaction Bar (Safe-Area padded to prevent mobile navigation bar cropping) */}
        <div style={{
          padding: '12px 16px calc(24px + env(safe-area-inset-bottom, 16px))',
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255,255,255,0.12)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          flexShrink: 0,
          zIndex: 10
        }}>
          {isMine ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <button
                type="button"
                onClick={() => {
                  fetchLiveViews();
                  setShowViewersSheet(prev => !prev);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#ffffff',
                  background: showViewersSheet ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255,255,255,0.14)',
                  border: '1px solid rgba(129, 140, 248, 0.45)',
                  borderRadius: '20px',
                  padding: '6px 14px',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <Eye size={16} color="#a5b4fc" />
                <span>{(liveViews && liveViews.length) || (currentVibe.views && currentVibe.views.length) || 0} Viewers</span>
              </button>

              {currentVibe.sparksEarned > 0 && (
                <span style={{ color: '#f59e0b', fontSize: '0.8rem', fontWeight: 800 }}>
                  ⚡ {currentVibe.sparksEarned} Sparks Tipped!
                </span>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              {/* Row 1: Text Reply Input (Insta / WhatsApp style) */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (replyText.trim()) {
                    handleReact('', 0, replyText.trim());
                  }
                }}
                style={{ display: 'flex', width: '100%', gap: '8px', alignItems: 'center' }}
              >
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Reply to ${vibeGroup?.displayName || 'User'}...`}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '20px',
                    padding: '8px 14px',
                    color: '#fff',
                    fontSize: '0.86rem',
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    background: 'var(--accent, #6366f1)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '50%',
                    width: '38px',
                    height: '38px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)'
                  }}
                >
                  <Send size={16} />
                </button>
              </form>

              {/* Row 2: Quick Emojis & Tip Sparks (Never cropped) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', width: '100%' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['❤️', '🔥', '😂', '👏'].map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => handleReact(emoji)}
                      style={{
                        background: 'rgba(255,255,255,0.14)',
                        border: '1px solid rgba(255,255,255,0.18)',
                        borderRadius: '50%',
                        width: '38px',
                        height: '38px',
                        fontSize: '1.15rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'transform 0.15s ease'
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                {/* Tip Sparks Button */}
                <button
                  onClick={() => handleReact('⚡', 10)}
                  title="Tip 10 Sparks"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '16px',
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
            </div>
          )}
        </div>

        {/* Viewers Sliding Sheet (Instagram / WhatsApp style) */}
        {showViewersSheet && isMine && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              top: 'auto',
              maxHeight: '65%',
              background: 'rgba(15, 23, 42, 0.96)',
              backdropFilter: 'blur(16px)',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              borderTop: '1px solid rgba(255, 255, 255, 0.2)',
              zIndex: 100,
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 -10px 30px rgba(0,0,0,0.8)',
              animation: 'modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontWeight: 800, fontSize: '0.98rem' }}>
                <Eye size={18} color="#818cf8" />
                <span>Story Viewers ({liveViews.length})</span>
              </div>
              <button
                onClick={() => setShowViewersSheet(false)}
                className="icon-btn-ghost"
                style={{ color: '#fff', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', padding: '4px' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {liveViews.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', padding: '2rem 1rem', fontSize: '0.88rem' }}>
                  <Users size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                  <p style={{ margin: 0 }}>No views yet.</p>
                  <p style={{ fontSize: '0.78rem', opacity: 0.8, marginTop: '4px' }}>Share your story with friends!</p>
                </div>
              ) : (
                liveViews.map((viewer, idx) => {
                  let vKing = Boolean(viewer.hasKingCrown);
                  let vSilver = Boolean(viewer.hasSilverCrown);
                  let vStreak = Boolean(viewer.hasStreakCrown);

                  if (!vKing && !vSilver && !vStreak && user?.id) {
                    try {
                      const cached = getCachedAllUsers(user.id || user._id);
                      if (Array.isArray(cached)) {
                        const m = cached.find(u => u.id === viewer.userId || u._id === viewer.userId || (u.username && viewer.username && u.username.toLowerCase() === viewer.username.toLowerCase()));
                        if (m) {
                          vKing = Boolean(m.hasKingCrown);
                          vSilver = Boolean(m.hasSilverCrown);
                          vStreak = Boolean(m.hasStreakCrown);
                        }
                      }
                    } catch (e) {}
                  }

                  return (
                    <div
                      key={viewer.userId || idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: '12px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ position: 'relative', width: '38px', height: '38px', flexShrink: 0 }}>
                          {vKing ? (
                            <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.85rem', filter: 'drop-shadow(0 2px 4px rgba(245, 158, 11, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 #1 Gold Leaderboard King">👑</div>
                          ) : vSilver ? (
                            <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.85rem', filter: 'drop-shadow(0 2px 4px rgba(203, 213, 225, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 #2 Silver Leaderboard Champion">👑</div>
                          ) : vStreak ? (
                            <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.85rem', filter: 'drop-shadow(0 2px 4px rgba(239, 68, 68, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 7-Day Gaming Streak Crown">👑</div>
                          ) : null}
                          <img
                            src={viewer.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${viewer.username || viewer.displayName || 'user'}`}
                            alt={viewer.displayName}
                            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '1px solid #818cf8' }}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>
                            {viewer.displayName || viewer.username || 'User'}
                          </div>
                          {viewer.username && (
                            <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.6)' }}>
                              @{viewer.username}
                            </div>
                          )}
                        </div>
                      </div>

                    <span style={{ fontSize: '0.72rem', color: '#a5b4fc', background: 'rgba(99, 102, 241, 0.2)', padding: '2px 8px', borderRadius: '10px' }}>
                      Viewed
                    </span>
                  </div>
                );
              })
            )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
