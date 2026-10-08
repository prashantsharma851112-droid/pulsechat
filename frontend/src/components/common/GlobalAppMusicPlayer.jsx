import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppMusic } from '../../context/AppMusicContext';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  X,
  Music,
  Disc,
  EyeOff,
  Maximize2,
  Minimize2,
  GripHorizontal,
  ChevronDown,
  Expand
} from 'lucide-react';

export default function GlobalAppMusicPlayer() {
  const {
    currentTrack,
    musicNoteText,
    isPlaying,
    isDucked,
    progress,
    duration,
    isMuted,
    togglePlayPause,
    toggleMute,
    clearTrack,
    openMusicPicker,
    seek
  } = useAppMusic();

  // Hide / Minimize State
  const [isMinimized, setIsMinimized] = useState(() => {
    try {
      return localStorage.getItem('pulsechat_music_player_minimized') === 'true';
    } catch (e) {
      return false;
    }
  });

  // Width / Size State (Resizable from 240px to 520px)
  const [cardWidth, setCardWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('pulsechat_music_player_width');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 240 && val <= 520) return val;
      }
    } catch (e) {}
    return 360;
  });

  // Drag Position State
  const [position, setPosition] = useState(() => {
    try {
      const saved = localStorage.getItem('pulsechat_music_player_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          return parsed;
        }
      }
    } catch (e) {}
    return null; // Will calculate viewport bottom-center on mount
  });

  const cardRef = useRef(null);
  const miniRef = useRef(null);
  const dragStartRef = useRef(null);
  const resizeStartRef = useRef(null);

  // Sync minimize state
  const handleToggleMinimize = (e) => {
    e && e.stopPropagation();
    setIsMinimized(prev => {
      const next = !prev;
      try {
        localStorage.setItem('pulsechat_music_player_minimized', String(next));
      } catch (err) {}
      return next;
    });
  };

  // Quick cycle sizes: 260px (Compact) -> 360px (Standard) -> 450px (Wide)
  const handleCycleSize = (e) => {
    e && e.stopPropagation();
    setCardWidth(prev => {
      let next;
      if (prev < 300) next = 360;
      else if (prev < 400) next = 460;
      else next = 260;

      const maxAllowed = Math.min(window.innerWidth - 24, 520);
      next = Math.min(next, maxAllowed);
      try {
        localStorage.setItem('pulsechat_music_player_width', String(next));
      } catch (err) {}
      return next;
    });
  };

  // Clamped position calculation
  const getClampedPos = useCallback((x, y, w, h) => {
    const maxX = Math.max(10, window.innerWidth - w - 10);
    const maxY = Math.max(10, window.innerHeight - h - 10);
    return {
      x: Math.min(Math.max(10, x), maxX),
      y: Math.min(Math.max(10, y), maxY)
    };
  }, []);

  // Initialize or readjust position on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => {
        const curWidth = isMinimized ? 52 : cardWidth;
        const curHeight = isMinimized ? 52 : 78;
        if (!prev) {
          const initX = Math.max(10, (window.innerWidth - curWidth) / 2);
          const initY = Math.max(10, window.innerHeight - curHeight - 20);
          return { x: initX, y: initY };
        }
        return getClampedPos(prev.x, prev.y, curWidth, curHeight);
      });
    };

    if (!position) {
      handleResize();
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [cardWidth, isMinimized, getClampedPos, position]);

  // Hand Drag Handling (Touch and Mouse)
  const handleStartDrag = (e) => {
    // Don't drag if tapping interactive controls
    if (e.target.closest('button, input, [data-no-drag="true"], .progress-bar-seek')) {
      return;
    }

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const currentX = position ? position.x : (window.innerWidth - cardWidth) / 2;
    const currentY = position ? position.y : window.innerHeight - 80;

    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      posX: currentX,
      posY: currentY,
      hasMoved: false
    };

    const handlePointerMove = (moveEvt) => {
      if (!dragStartRef.current) return;
      const moveX = moveEvt.touches ? moveEvt.touches[0].clientX : moveEvt.clientX;
      const moveY = moveEvt.touches ? moveEvt.touches[0].clientY : moveEvt.clientY;

      const dx = moveX - dragStartRef.current.startX;
      const dy = moveY - dragStartRef.current.startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragStartRef.current.hasMoved = true;
      }

      const curWidth = isMinimized ? 52 : cardWidth;
      const curHeight = isMinimized ? 52 : 78;

      const targetX = dragStartRef.current.posX + dx;
      const targetY = dragStartRef.current.posY + dy;

      const clamped = getClampedPos(targetX, targetY, curWidth, curHeight);
      setPosition(clamped);
    };

    const handlePointerEnd = () => {
      if (dragStartRef.current?.hasMoved) {
        setPosition(prev => {
          if (prev) {
            try {
              localStorage.setItem('pulsechat_music_player_pos', JSON.stringify(prev));
            } catch (err) {}
          }
          return prev;
        });
      }
      dragStartRef.current = null;
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerEnd);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerEnd);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerEnd);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerEnd);
  };

  // Hand Resize Handling (Dragging corner handle to make card smaller or larger)
  const handleStartResize = (e) => {
    e.stopPropagation();
    e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    resizeStartRef.current = {
      startX: clientX,
      startWidth: cardWidth
    };

    const handleResizeMove = (moveEvt) => {
      if (!resizeStartRef.current) return;
      const moveX = moveEvt.touches ? moveEvt.touches[0].clientX : moveEvt.clientX;
      const dx = moveX - resizeStartRef.current.startX;

      const maxW = Math.min(window.innerWidth - 24, 520);
      const newWidth = Math.max(240, Math.min(maxW, resizeStartRef.current.startWidth + dx));

      setCardWidth(newWidth);

      // Re-clamp position so resize doesn't push offscreen
      setPosition(prev => {
        if (!prev) return prev;
        return getClampedPos(prev.x, prev.y, newWidth, 78);
      });
    };

    const handleResizeEnd = () => {
      setCardWidth(prev => {
        try {
          localStorage.setItem('pulsechat_music_player_width', String(prev));
        } catch (err) {}
        return prev;
      });
      resizeStartRef.current = null;
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
      window.removeEventListener('touchmove', handleResizeMove);
      window.removeEventListener('touchend', handleResizeEnd);
    };

    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeEnd);
    window.addEventListener('touchmove', handleResizeMove, { passive: false });
    window.addEventListener('touchend', handleResizeEnd);
  };

  if (!currentTrack) return null;

  const percent = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;

  const formatSecs = (s) => {
    const sec = Math.floor(s || 0);
    const m = Math.floor(sec / 60);
    const r = sec % 60;
    return `${m}:${r < 10 ? '0' : ''}${r}`;
  };

  // Effective dimensions
  const posX = position?.x ?? Math.max(10, (window.innerWidth - (isMinimized ? 52 : cardWidth)) / 2);
  const posY = position?.y ?? Math.max(10, window.innerHeight - (isMinimized ? 52 : 78) - 20);
  const isCompactMode = cardWidth < 300;

  // -------------------------------------------------------------
  // RENDER: MINIMIZED / HIDDEN STATE (Floating Mini Vinyl Disc)
  // -------------------------------------------------------------
  if (isMinimized) {
    return (
      <div
        ref={miniRef}
        onMouseDown={handleStartDrag}
        onTouchStart={handleStartDrag}
        onClick={(e) => {
          if (!dragStartRef.current?.hasMoved) {
            handleToggleMinimize(e);
          }
        }}
        style={{
          position: 'fixed',
          left: `${posX}px`,
          top: `${posY}px`,
          zIndex: 1150,
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          cursor: 'grab',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'none',
          background: 'rgba(15, 15, 22, 0.94)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: isDucked ? '2px solid #f59e0b' : '2px solid #a855f7',
          boxShadow: isPlaying && !isDucked
            ? '0 0 20px rgba(168, 85, 247, 0.6), 0 8px 24px rgba(0,0,0,0.6)'
            : '0 4px 16px rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.15s ease, box-shadow 0.2s ease',
          animation: 'fadeIn 0.2s ease-out'
        }}
        title="Pulse Music Playing · Tap to Unhide / Restore Player"
      >
        {/* Spinning Vinyl Record Artwork */}
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#12121c',
          border: '1px solid rgba(255,255,255,0.15)'
        }}>
          {currentTrack.artworkUrl ? (
            <img
              src={currentTrack.artworkUrl}
              alt={currentTrack.songTitle}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                animation: isPlaying && !isDucked ? 'spin 6s linear infinite' : 'none'
              }}
            />
          ) : (
            <Disc
              size={24}
              color={isDucked ? '#f59e0b' : '#c084fc'}
              style={{
                animation: isPlaying && !isDucked ? 'spin 4s linear infinite' : 'none'
              }}
            />
          )}

          {/* Equalizer Wave / Playing Dot */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {isPlaying && !isDucked ? (
              <span style={{ fontSize: '0.75rem', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))' }}>🎵</span>
            ) : (
              <Play size={15} color="#ffffff" style={{ marginLeft: '2px' }} />
            )}
          </div>
        </div>

        {/* Mini Unhide Badge */}
        <div
          data-no-drag="true"
          onClick={handleToggleMinimize}
          style={{
            position: 'absolute',
            top: '-5px',
            right: '-5px',
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
            border: '1.5px solid #0f0f16',
            cursor: 'pointer'
          }}
          title="Unhide player"
        >
          <Expand size={9} />
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: EXPANDED / NORMAL STATE (Draggable & Resizable Card)
  // -------------------------------------------------------------
  return (
    <div
      ref={cardRef}
      onMouseDown={handleStartDrag}
      onTouchStart={handleStartDrag}
      style={{
        position: 'fixed',
        left: `${posX}px`,
        top: `${posY}px`,
        zIndex: 1150,
        width: `${cardWidth}px`,
        maxWidth: 'calc(100vw - 20px)',
        background: 'rgba(15, 15, 22, 0.94)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: isDucked ? '1.5px solid rgba(245, 158, 11, 0.7)' : '1px solid rgba(99, 102, 241, 0.4)',
        borderRadius: '20px',
        boxShadow: isDucked
          ? '0 10px 30px rgba(245, 158, 11, 0.25), 0 4px 16px rgba(0,0,0,0.7)'
          : '0 12px 34px rgba(99, 102, 241, 0.28), 0 4px 16px rgba(0,0,0,0.7)',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
        transition: dragStartRef.current?.hasMoved ? 'none' : 'box-shadow 0.2s ease',
        animation: 'slideUpMiniPlayer 0.2s ease-out'
      }}
    >
      {/* Top Drag Grip Bar */}
      <div
        style={{
          width: '100%',
          padding: '4px 0 2px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'grab',
          opacity: 0.6,
          background: 'rgba(255, 255, 255, 0.03)'
        }}
        title="Drag anywhere to move"
      >
        <div style={{
          width: '32px',
          height: '3.5px',
          borderRadius: '3px',
          background: 'rgba(255, 255, 255, 0.35)'
        }} />
      </div>

      {/* Thin Progress Bar (Clickable / Scrubbable) */}
      <div
        className="progress-bar-seek"
        data-no-drag="true"
        style={{
          width: '100%',
          height: '3px',
          background: 'rgba(255, 255, 255, 0.1)',
          position: 'relative',
          cursor: 'pointer'
        }}
        onClick={(e) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const ratio = Math.max(0, Math.min(1, clickX / rect.width));
          if (duration > 0) seek(ratio * duration);
        }}
        title={`Scrub ${formatSecs(progress)} / ${formatSecs(duration)}`}
      >
        <div
          style={{
            height: '100%',
            width: `${percent}%`,
            background: isDucked
              ? '#f59e0b'
              : 'linear-gradient(90deg, #6366f1, #a855f7, #ec4899)',
            borderRadius: '2px',
            transition: 'width 0.15s linear'
          }}
        />
      </div>

      {/* Main Controls Row */}
      <div style={{
        padding: '7px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: isCompactMode ? '6px' : '8px'
      }}>
        {/* Track Artwork / Disc Icon (Click to Change Song) */}
        <div
          data-no-drag="true"
          onClick={(e) => {
            e.stopPropagation();
            openMusicPicker && openMusicPicker();
          }}
          style={{
            position: 'relative',
            width: isCompactMode ? '34px' : '38px',
            height: isCompactMode ? '34px' : '38px',
            borderRadius: '10px',
            flexShrink: 0,
            overflow: 'hidden',
            cursor: 'pointer',
            boxShadow: '0 3px 8px rgba(0,0,0,0.4)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            background: '#181824',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Change Music Track"
        >
          {currentTrack.artworkUrl ? (
            <img
              src={currentTrack.artworkUrl}
              alt={currentTrack.songTitle}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                animation: isPlaying && !isDucked ? 'spin 6s linear infinite' : 'none'
              }}
            />
          ) : (
            <Disc
              size={isCompactMode ? 20 : 22}
              color={isDucked ? '#f59e0b' : '#a855f7'}
              style={{
                animation: isPlaying && !isDucked ? 'spin 4s linear infinite' : 'none'
              }}
            />
          )}

          {isPlaying && !isDucked && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.22)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ fontSize: '0.68rem' }}>🎵</span>
            </div>
          )}
        </div>

        {/* Track Information & Thought / Note */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            cursor: 'grab',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {isDucked ? (
            <div style={{
              fontSize: '0.70rem',
              fontWeight: 800,
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span>⏸️ Paused for chat music</span>
            </div>
          ) : musicNoteText ? (
            <div style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              color: 'var(--accent)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              💭 {musicNoteText}
            </div>
          ) : null}

          <div style={{
            fontSize: isCompactMode ? '0.78rem' : '0.84rem',
            fontWeight: 700,
            color: '#ffffff',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <span>{currentTrack.songTitle}</span>
          </div>

          <div style={{
            fontSize: '0.68rem',
            color: 'var(--text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <span>{currentTrack.artistName || 'PulseChat Audio'}</span>
            {!isCompactMode && (
              <>
                <span>·</span>
                <span>{formatSecs(progress)} / {formatSecs(duration)}</span>
              </>
            )}
          </div>
        </div>

        {/* Action Buttons Group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isCompactMode ? '3px' : '5px', flexShrink: 0 }}>
          {/* Mute Toggle (Hidden in ultra-compact mode) */}
          {!isCompactMode && (
            <button
              type="button"
              data-no-drag="true"
              onClick={(e) => {
                e.stopPropagation();
                toggleMute();
              }}
              className="icon-btn-ghost"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isMuted ? '#ef4444' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
          )}

          {/* Quick Size Toggle Button (Compact / Standard / Wide) */}
          <button
            type="button"
            data-no-drag="true"
            onClick={handleCycleSize}
            className="icon-btn-ghost"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              cursor: 'pointer'
            }}
            title={`Size: ${cardWidth}px · Tap to cycle size (Small / Medium / Wide)`}
          >
            {cardWidth < 300 ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          </button>

          {/* Play / Pause Toggle Button */}
          <button
            type="button"
            data-no-drag="true"
            onClick={(e) => {
              e.stopPropagation();
              togglePlayPause();
            }}
            style={{
              width: isCompactMode ? '32px' : '34px',
              height: isCompactMode ? '32px' : '34px',
              borderRadius: '50%',
              background: isDucked
                ? '#f59e0b'
                : 'linear-gradient(135deg, #6366f1, #a855f7)',
              border: 'none',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 3px 12px rgba(99, 102, 241, 0.45)',
              flexShrink: 0
            }}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying && !isDucked ? (
              <Pause size={15} />
            ) : (
              <Play size={15} style={{ marginLeft: '1.5px' }} />
            )}
          </button>

          {/* Hide / Minimize Button (Tucks into floating mini vinyl disc) */}
          <button
            type="button"
            data-no-drag="true"
            onClick={handleToggleMinimize}
            className="icon-btn-ghost"
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              cursor: 'pointer'
            }}
            title="Hide / Minimize Player into floating disc"
          >
            <ChevronDown size={15} />
          </button>

          {/* Close / Stop Track Button */}
          <button
            type="button"
            data-no-drag="true"
            onClick={(e) => {
              e.stopPropagation();
              clearTrack();
            }}
            className="icon-btn-ghost"
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              cursor: 'pointer'
            }}
            title="Stop Music Track"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Hand Resize Handle Corner (Bottom-Right grabber) */}
      <div
        onMouseDown={handleStartResize}
        onTouchStart={handleStartResize}
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: '18px',
          height: '18px',
          cursor: 'nwse-resize',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
          padding: '2px',
          opacity: 0.45,
          touchAction: 'none'
        }}
        title="Drag corner with hand/mouse to resize smaller or larger"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <line x1="7" y1="1" x2="1" y2="7" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="7" y1="4" x2="4" y2="7" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
