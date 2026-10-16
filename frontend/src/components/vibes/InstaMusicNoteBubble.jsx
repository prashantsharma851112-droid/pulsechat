import React, { useState, useEffect, useRef, useContext } from 'react';
import { createPortal } from 'react-dom';
import { AuthContext } from '../../context/AuthContext';
import { useAppMusic } from '../../context/AppMusicContext';
import { Music, Disc, Edit3, Trash2, X, Heart } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return 'Just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Modal showing list of users who liked the music note (like Instagram story viewers / notes likes)
function NoteLikersModal({ isOpen, onClose, targetUserId, initialLikes = [] }) {
  const { token } = useContext(AuthContext);
  const [likesList, setLikesList] = useState(initialLikes);

  useEffect(() => {
    if (!isOpen || !targetUserId) return;
    setLikesList(initialLikes);
    if (token) {
      fetch(`${BACKEND_URL}/api/users/music-note/${targetUserId}/likes`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && Array.isArray(data.likes)) {
            setLikesList(data.likes);
          }
        })
        .catch(err => console.warn('Could not fetch likes:', err));
    }
  }, [isOpen, targetUserId, token]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '350px',
          maxHeight: '75vh',
          background: '#13121d',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          borderRadius: '22px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(0,0,0,0.9), 0 0 35px rgba(255, 45, 85, 0.25)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Heart size={18} fill="#ff2d55" color="#ff2d55" />
            <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, color: '#ffffff' }}>
              Note Likes
            </h3>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              background: 'rgba(255, 45, 85, 0.18)',
              color: '#ff2d55',
              padding: '2px 8px',
              borderRadius: '12px'
            }}>
              {likesList.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#ffffff'
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Likers List */}
        <div style={{
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          {likesList.length === 0 ? (
            <div style={{
              padding: '32px 10px',
              textAlign: 'center',
              color: 'var(--text-muted, #94a3b8)',
              fontSize: '0.82rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Heart size={30} color="#475569" />
              <span>No likes yet. Double tap the note to be the first to like!</span>
            </div>
          ) : (
            likesList.map((liker, idx) => {
              const uName = liker.username || liker.displayName || 'user';
              const dName = liker.displayName || liker.username || 'Pulse User';
              const fallbackAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(uName)}`;

              return (
                <div
                  key={liker.userId || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 4px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0 }}>
                    <img
                      src={liker.avatar || fallbackAvatar}
                      alt={dName}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = fallbackAvatar;
                      }}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid rgba(255, 45, 85, 0.45)',
                        flexShrink: 0
                      }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {dName}
                      </span>
                      <span style={{ fontSize: '0.70rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        @{uName} {liker.likedAt ? `• ${formatTimeAgo(liker.likedAt)}` : ''}
                      </span>
                    </div>
                  </div>
                  <Heart size={16} fill="#ff2d55" color="#ff2d55" style={{ filter: 'drop-shadow(0 0 5px rgba(255,45,85,0.7))', flexShrink: 0 }} />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
}

export default function InstaMusicNoteBubble({ onOpenPicker, note, authorUser, isMine = true, isPopped = false, onPop }) {
  const { user, token } = useContext(AuthContext);
  const { deleteMusicNote } = useAppMusic();

  const activeNote = isMine ? (note !== undefined ? note : user?.musicNote) : note;
  const [showOptions, setShowOptions] = useState(false);
  const [isPlayingNote, setIsPlayingNote] = useState(false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [showLikersModal, setShowLikersModal] = useState(false);
  const [likes, setLikes] = useState(() => Array.isArray(activeNote?.likes) ? activeNote.likes : []);
  const [menuCoords, setMenuCoords] = useState({ top: 0, left: 0 });

  const bubbleRef = useRef(null);
  const noteAudioRef = useRef(null);
  const lastTapRef = useRef(0);
  const singleTapTimerRef = useRef(null);

  const targetUserId = authorUser?.userId || authorUser?.id || authorUser?._id || authorUser?.username || (isMine ? (user?.id || user?._id) : null);

  // Calculate and clamp floating menu position when note is popped
  useEffect(() => {
    if (!isPopped) return;
    const updateMenuPosition = () => {
      if (bubbleRef.current) {
        const rect = bubbleRef.current.getBoundingClientRect();
        const menuWidth = 136;
        let left = rect.left + rect.width / 2 - menuWidth / 2;
        if (left < 10) left = 10;
        if (left + menuWidth > window.innerWidth - 10) {
          left = window.innerWidth - menuWidth - 10;
        }
        let top = rect.bottom + 6;
        if (top + 130 > window.innerHeight) {
          top = Math.max(10, rect.top - 125);
        }
        setMenuCoords({ top, left });
      }
    };
    updateMenuPosition();
    window.addEventListener('scroll', updateMenuPosition, true);
    window.addEventListener('resize', updateMenuPosition);
    return () => {
      window.removeEventListener('scroll', updateMenuPosition, true);
      window.removeEventListener('resize', updateMenuPosition);
    };
  }, [isPopped]);

  // Sync likes whenever note changes
  useEffect(() => {
    if (Array.isArray(activeNote?.likes)) {
      setLikes(activeNote.likes);
    } else {
      setLikes([]);
    }
  }, [activeNote?.likes, activeNote?.updatedAt]);

  // Real-time like sync via custom event
  useEffect(() => {
    const handleNoteLiked = (e) => {
      if (e.detail && String(e.detail.targetUserId) === String(targetUserId)) {
        if (Array.isArray(e.detail.likes)) {
          setLikes(e.detail.likes);
        }
      }
    };
    window.addEventListener('pulsechat_music_note_liked', handleNoteLiked);
    return () => {
      window.removeEventListener('pulsechat_music_note_liked', handleNoteLiked);
    };
  }, [targetUserId]);

  const stopNoteAudio = () => {
    if (noteAudioRef.current) {
      try {
        noteAudioRef.current.pause();
        noteAudioRef.current.currentTime = 0;
        noteAudioRef.current = null;
      } catch (e) {}
    }
    setIsPlayingNote(false);
  };

  // Close audio on unmount
  useEffect(() => {
    return () => {
      stopNoteAudio();
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    };
  }, []);

  // Close audio when user taps anywhere outside
  useEffect(() => {
    if (!isPlayingNote) return;
    const handleOutsideClick = () => {
      stopNoteAudio();
    };
    window.addEventListener('click', handleOutsideClick);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
    };
  }, [isPlayingNote]);

  // Listen to cross-note coordinator so only 1 note audio plays at a time
  useEffect(() => {
    const handleStopOtherNotes = (e) => {
      if (e.detail?.source !== noteAudioRef.current) {
        stopNoteAudio();
      }
    };
    window.addEventListener('pulsechat_stop_all_note_audios', handleStopOtherNotes);
    return () => {
      window.removeEventListener('pulsechat_stop_all_note_audios', handleStopOtherNotes);
    };
  }, []);

  const handleTogglePlayNote = (e) => {
    if (e) e.stopPropagation();

    if (isPlayingNote) {
      stopNoteAudio();
      return;
    }

    if (!activeNote?.audioUrl) return;

    window.dispatchEvent(new CustomEvent('pulsechat_stop_all_note_audios'));

    try {
      const audio = new Audio(activeNote.audioUrl);
      audio.volume = 0.85;

      const startTime = Number(activeNote.startTime) || 0;
      const snippetDuration = Number(activeNote.snippetDuration) || 30;

      if (startTime > 0) {
        audio.currentTime = startTime;
      }

      audio.ontimeupdate = () => {
        if (audio.currentTime >= startTime + snippetDuration) {
          stopNoteAudio();
        }
      };

      audio.onended = () => {
        setIsPlayingNote(false);
        noteAudioRef.current = null;
      };

      audio.onerror = () => {
        setIsPlayingNote(false);
        noteAudioRef.current = null;
      };

      audio.play().then(() => {
        setIsPlayingNote(true);
      }).catch((err) => {
        console.warn('Note audio play prevented:', err);
        setIsPlayingNote(false);
      });

      noteAudioRef.current = audio;
    } catch (err) {
      console.warn('Failed to start note audio:', err);
    }
  };

  const myId = user?.id || (user?._id ? user._id.toString() : '');
  const myUsername = user?.username;
  const isLikedByMe = likes.some(l => 
    (myId && String(l.userId) === String(myId)) || 
    (myUsername && l.username === myUsername)
  );

  // Toggle Like with backend call & socket broadcast
  const handleToggleLike = async (e) => {
    if (e) e.stopPropagation();
    if (!token || !targetUserId) return;

    // Trigger sweet heart pop burst
    setShowHeartBurst(true);
    setTimeout(() => setShowHeartBurst(false), 850);

    // Optimistic UI update
    let newLikes;
    if (isLikedByMe) {
      newLikes = likes.filter(l => 
        !(myId && String(l.userId) === String(myId)) && 
        !(myUsername && l.username === myUsername)
      );
    } else {
      newLikes = [
        ...likes,
        {
          userId: myId,
          username: myUsername,
          displayName: user?.displayName || myUsername || 'User',
          avatar: user?.avatar || '',
          likedAt: new Date().toISOString()
        }
      ];
    }
    setLikes(newLikes);

    try {
      const res = await fetch(`${BACKEND_URL}/api/users/music-note/${targetUserId}/like`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.likes)) {
          setLikes(data.likes);
          window.dispatchEvent(new CustomEvent('pulsechat_music_note_liked', {
            detail: { targetUserId, likes: data.likes }
          }));
        }
      }
    } catch (err) {
      console.error('Failed to toggle note like:', err);
    }
  };

  // Double Tap detection: double tap likes, single tap plays audio or toggles pop
  const handleBubbleClick = (e) => {
    e.stopPropagation();
    const now = Date.now();
    const delta = now - lastTapRef.current;

    if (delta < 320 && delta > 40) {
      // Double tap!
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      lastTapRef.current = 0;
      handleToggleLike(e);
    } else {
      lastTapRef.current = now;
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }
      singleTapTimerRef.current = setTimeout(() => {
        singleTapTimerRef.current = null;
        onPop && onPop();
        if (hasSong) {
          handleTogglePlayNote(e);
        } else if (isMine) {
          onOpenPicker && onOpenPicker();
        }
      }, 320);
    }
  };

  const hasText = Boolean(activeNote?.noteText && activeNote.noteText.trim());
  const hasSong = Boolean(activeNote?.songTitle && activeNote.songTitle.trim());

  const noteTheme = activeNote?.theme || activeNote?.noteTheme || 'default';
  const themeClass = noteTheme !== 'default' ? `note-bubble-${noteTheme}` : '';

  const getTailColor = () => {
    if (noteTheme === 'live-aurora') return 'rgba(168, 85, 247, 0.95)';
    if (noteTheme === 'live-dragon-flame') return 'rgba(217, 119, 6, 0.95)';
    if (noteTheme === 'live-cyberpunk') return 'rgba(236, 72, 153, 0.95)';
    if (noteTheme === 'live-golden-royalty') return 'rgba(217, 119, 6, 0.95)';
    if (noteTheme === 'live-cosmic-galaxy') return 'rgba(112, 26, 117, 0.95)';
    if (noteTheme === 'neon-violet') return 'rgba(124, 58, 237, 0.95)';
    if (noteTheme === 'cyber-cyan') return 'rgba(6, 182, 212, 0.95)';
    if (noteTheme === 'sunset-rose') return 'rgba(244, 63, 94, 0.95)';
    if (noteTheme === 'emerald-matrix') return 'rgba(16, 185, 129, 0.95)';
    if (isPlayingNote) return 'rgba(168, 85, 247, 0.95)';
    if (isPopped) return '#c084fc';
    return 'rgba(20, 20, 28, 0.94)';
  };

  // If viewing own avatar and no note is set yet -> "+ Note" Instagram prompt
  if (!activeNote || (!hasText && !hasSong)) {
    if (!isMine) return null;

    return (
      <div
        className="insta-music-note-bubble-wrap"
        onClick={(e) => {
          e.stopPropagation();
          onPop && onPop();
          onOpenPicker && onOpenPicker();
        }}
        style={{
          position: 'absolute',
          bottom: 'calc(100% + 4px)',
          left: '50%',
          transform: `translateX(-50%) ${isPopped ? 'scale(1.08)' : 'scale(1)'}`,
          zIndex: isPopped ? 100 : 15,
          cursor: 'pointer',
          animation: 'fadeIn 0.2s ease-out',
          transition: 'transform 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
        title="Add Music Note"
      >
        <div style={{
          background: isPopped ? 'rgba(30, 30, 44, 0.98)' : 'rgba(24, 24, 32, 0.94)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: isPopped ? '1.5px solid #c084fc' : '1px solid rgba(255, 255, 255, 0.18)',
          borderRadius: '14px',
          padding: '2px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          boxShadow: isPopped ? '0 6px 20px rgba(0,0,0,0.8), 0 0 14px rgba(168, 85, 247, 0.5)' : '0 4px 12px rgba(0,0,0,0.4)',
          whiteSpace: 'nowrap'
        }}>
          <Music size={11} color="#a855f7" />
          <span style={{ fontSize: '0.64rem', fontWeight: 700, color: '#e2e8f0' }}>
            + Note
          </span>
        </div>
        {/* Cute Speech Bubble Tail */}
        <div style={{
          width: 0,
          height: 0,
          borderLeft: '4px solid transparent',
          borderRight: '4px solid transparent',
          borderTop: isPopped ? '5px solid rgba(30, 30, 44, 0.98)' : '5px solid rgba(24, 24, 32, 0.94)',
          margin: '-1px auto 0 auto'
        }} />
      </div>
    );
  }

  // Active Music Note Bubble:
  // - Fixed uniform width (72px)
  // - Dynamic vertical height expanding with thought text
  // - Smooth Instagram headline / marquee ticker for song name with iridescent shimmer
  // - Double tap to like with popping heart
  // - Corner heart badge visible to everyone
  // - Tap corner heart to view who liked
  return (
    <>
      <style>{`
        @keyframes vibeSongHeadlineScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes vibeHeartPop {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
          35% { transform: translate(-50%, -50%) scale(1.35); opacity: 1; }
          70% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
          100% { transform: translate(-50%, -65%) scale(0.85); opacity: 0; }
        }
      `}</style>

      <div
        ref={bubbleRef}
        className="insta-music-note-bubble-wrap"
        style={{
          position: 'absolute',
          bottom: 'calc(100% + 4px)',
          left: '50%',
          transform: `translateX(-50%) ${isPopped ? 'scale(1.06)' : 'scale(1)'}`,
          zIndex: isPopped ? 100 : 15,
          cursor: 'pointer',
          animation: 'fadeIn 0.2s ease-out',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'auto',
          transition: 'transform 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          userSelect: 'none'
        }}
        onClick={handleBubbleClick}
        onContextMenu={(e) => {
          if (!isMine) return;
          e.preventDefault();
          e.stopPropagation();
          onOpenPicker && onOpenPicker();
        }}
        title={`${hasText ? activeNote.noteText + ' · ' : ''}${activeNote.songTitle || ''} (Double-tap to like, tap to listen)`}
      >
        <div
          className={themeClass}
          style={{
            background: isPlayingNote && noteTheme === 'default'
              ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.98), rgba(168, 85, 247, 0.98))'
              : (isPopped ? 'rgba(28, 26, 42, 0.98)' : 'rgba(20, 20, 28, 0.94)'),
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: isPopped
              ? '1.8px solid #c084fc'
              : (isPlayingNote ? '1.5px solid #c084fc' : '1px solid rgba(255, 255, 255, 0.2)'),
            borderRadius: '16px',
            padding: hasText && hasSong ? '4px 6px' : '3px 6px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            boxShadow: isPopped
              ? '0 8px 26px rgba(0,0,0,0.85), 0 0 18px rgba(168, 85, 247, 0.7)'
              : (isPlayingNote
                  ? '0 4px 14px rgba(168, 85, 247, 0.5), 0 0 10px rgba(168, 85, 247, 0.4)'
                  : '0 4px 10px rgba(0,0,0,0.5)'),
            width: '76px',
            minWidth: '76px',
            maxWidth: '76px',
            boxSizing: 'border-box',
            position: 'relative',
            transition: 'all 0.22s ease'
          }}>

          {/* Double-tap Bursting Heart Animation */}
          {showHeartBurst && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              zIndex: 80,
              animation: 'vibeHeartPop 0.85s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Heart size={32} fill="#ff2d55" color="#ff2d55" style={{ filter: 'drop-shadow(0 0 10px rgba(255,45,85,0.95))' }} />
            </div>
          )}

          {/* Top: Thought / Vibe text (Expands length vertically, full text visible) */}
          {hasText && (
            <div style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}>
              <div style={{
                fontSize: '0.66rem',
                fontWeight: 700,
                color: '#ffffff',
                lineHeight: 1.25,
                textAlign: 'center',
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                whiteSpace: 'normal',
                width: '100%',
                padding: '0 1px'
              }}>
                {activeNote.noteText}
              </div>
            </div>
          )}

          {/* Bottom: Song Title Pill (Instagram News Headline Continuous Ticker) */}
          {hasSong && (
            <div style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              overflow: 'hidden',
              background: hasText ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
              borderRadius: '8px',
              padding: hasText ? '1.5px 3px' : '0 1px',
              marginTop: hasText ? '2px' : '0',
              position: 'relative',
              boxSizing: 'border-box'
            }}>
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                {isPlayingNote ? (
                  <Disc size={10} color="#ffffff" style={{ animation: 'spin 2s linear infinite' }} />
                ) : (
                  <Music size={10} color={isPlayingNote ? '#ffffff' : '#c084fc'} />
                )}
              </div>

              {/* Infinite Headline Marquee Ticker */}
              <div style={{
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                flex: 1,
                position: 'relative'
              }}>
                <div
                  style={{
                    display: 'inline-flex',
                    whiteSpace: 'nowrap',
                    animation: 'vibeSongHeadlineScroll 7s linear infinite',
                    willChange: 'transform'
                  }}
                >
                  <span
                    className="music-playing-shimmer"
                    style={{
                      fontSize: '0.58rem',
                      fontWeight: 700,
                      paddingRight: '14px',
                      display: 'inline-block',
                      letterSpacing: '0.2px'
                    }}
                  >
                    {activeNote.songTitle}
                  </span>
                  <span
                    className="music-playing-shimmer"
                    style={{
                      fontSize: '0.58rem',
                      fontWeight: 700,
                      paddingRight: '14px',
                      display: 'inline-block',
                      letterSpacing: '0.2px'
                    }}
                  >
                    {activeNote.songTitle}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Small Corner Heart Badge (Visible to everyone: liker, creator, viewer) */}
          {likes.length > 0 && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (isMine) {
                  setShowLikersModal(true);
                } else {
                  handleToggleLike(e);
                }
              }}
              style={{
                position: 'absolute',
                bottom: '-6px',
                right: '-5px',
                background: 'rgba(20, 20, 28, 0.96)',
                border: isLikedByMe ? '1.5px solid #ff2d55' : '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: '12px',
                padding: likes.length > 1 ? '1.5px 5px' : '2px 4px',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                cursor: 'pointer',
                boxShadow: isLikedByMe ? '0 2px 8px rgba(255, 45, 85, 0.55)' : '0 2px 6px rgba(0,0,0,0.6)',
                zIndex: 25,
                transition: 'transform 0.15s ease'
              }}
              title={isMine ? `${likes.length} like${likes.length > 1 ? 's' : ''} • Tap to see who liked` : (isLikedByMe ? 'Liked by you • Tap to unlike' : 'Tap to like')}
            >
              <Heart
                size={10}
                fill={isLikedByMe ? '#ff2d55' : '#ec4899'}
                color={isLikedByMe ? '#ff2d55' : '#ec4899'}
                style={{ filter: isLikedByMe ? 'drop-shadow(0 0 2px rgba(255,45,85,0.8))' : 'none' }}
              />
              {likes.length > 1 && (
                <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#ffffff', lineHeight: 1 }}>
                  {likes.length}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Cute Speech Bubble Tail matching active theme */}
        <div style={{
          width: 0,
          height: 0,
          borderLeft: '4px solid transparent',
          borderRight: '4px solid transparent',
          borderTop: `5px solid ${getTailColor()}`,
          margin: '-1px auto 0 auto'
        }} />
      </div>

      {/* Owner Menu when popped rendered via portal to prevent clipping */}
      {isMine && isPopped && typeof document !== 'undefined' && createPortal(
        <div
          className="insta-music-note-portal"
          onTouchStart={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Transparent Backdrop to dismiss on tapping outside */}
          <div
            className="insta-music-note-portal"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPop && onPop();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPop && onPop();
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998,
              background: 'transparent'
            }}
          />
          <div
            className="insta-music-note-owner-menu"
            onTouchStart={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: `${menuCoords.top}px`,
              left: `${menuCoords.left}px`,
              background: 'rgba(18, 18, 28, 0.98)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              borderRadius: '14px',
              padding: '6px',
              boxShadow: '0 12px 36px rgba(0,0,0,0.75), 0 0 16px rgba(168, 85, 247, 0.3)',
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
              minWidth: '136px',
              animation: 'fadeIn 0.15s ease-out'
            }}
          >
            {likes.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onPop && onPop();
                  setShowLikersModal(true);
                }}
                style={{
                  padding: '7px 10px',
                  borderRadius: '9px',
                  border: 'none',
                  background: 'rgba(255, 45, 85, 0.12)',
                  color: '#ff2d55',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <Heart size={13} fill="#ff2d55" color="#ff2d55" /> Likes ({likes.length})
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                stopNoteAudio();
                onPop && onPop();
                onOpenPicker && onOpenPicker();
              }}
              style={{
                padding: '7px 10px',
                borderRadius: '9px',
                border: 'none',
                background: 'transparent',
                color: '#f1f5f9',
                fontSize: '0.76rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <Edit3 size={13} color="#c084fc" /> Edit Note
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                stopNoteAudio();
                onPop && onPop();
                deleteMusicNote();
              }}
              style={{
                padding: '7px 10px',
                borderRadius: '9px',
                border: 'none',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                fontSize: '0.76rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <Trash2 size={13} /> Remove Note
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Likers Modal (Instagram Story Viewers style - Only accessible to the note owner) */}
      {isMine && (
        <NoteLikersModal
          isOpen={showLikersModal}
          onClose={() => setShowLikersModal(false)}
          targetUserId={targetUserId}
          initialLikes={likes}
        />
      )}
    </>
  );
}
