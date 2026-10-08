import React, { useState } from 'react';
import { useAppMusic } from '../../context/AppMusicContext';
import { Play, Pause, Volume2, VolumeX, X, Music, Disc, Sparkles, SlidersHorizontal } from 'lucide-react';

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

  const [isExpanded, setIsExpanded] = useState(false);

  if (!currentTrack) return null;

  const percent = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;

  const formatSecs = (s) => {
    const sec = Math.floor(s || 0);
    const m = Math.floor(sec / 60);
    const r = sec % 60;
    return `${m}:${r < 10 ? '0' : ''}${r}`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1150,
        width: 'calc(100% - 24px)',
        maxWidth: '390px',
        background: 'rgba(15, 15, 22, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: isDucked ? '1.5px solid rgba(245, 158, 11, 0.6)' : '1px solid rgba(99, 102, 241, 0.35)',
        borderRadius: '20px',
        boxShadow: isDucked
          ? '0 10px 30px rgba(245, 158, 11, 0.25), 0 2px 8px rgba(0,0,0,0.6)'
          : '0 10px 32px rgba(99, 102, 241, 0.25), 0 4px 12px rgba(0,0,0,0.7)',
        overflow: 'hidden',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        animation: 'slideUpMiniPlayer 0.25s ease-out'
      }}
    >
      {/* Top Thin Progress Bar */}
      <div
        style={{
          width: '100%',
          height: '3px',
          background: 'rgba(255, 255, 255, 0.1)',
          position: 'relative',
          cursor: 'pointer'
        }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const ratio = Math.max(0, Math.min(1, clickX / rect.width));
          if (duration > 0) seek(ratio * duration);
        }}
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

      {/* Main Pill Controls */}
      <div style={{
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px'
      }}>
        {/* Track Artwork / Vinyl Icon */}
        <div
          onClick={openMusicPicker}
          style={{
            position: 'relative',
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            flexShrink: 0,
            overflow: 'hidden',
            cursor: 'pointer',
            boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
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
              size={24}
              color={isDucked ? '#f59e0b' : '#a855f7'}
              style={{
                animation: isPlaying && !isDucked ? 'spin 4s linear infinite' : 'none'
              }}
            />
          )}

          {/* Sound wave icon overlay */}
          {isPlaying && !isDucked && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ fontSize: '0.75rem' }}>🎵</span>
            </div>
          )}
        </div>

        {/* Track Info & Note */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            flex: 1,
            minWidth: 0,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {isDucked ? (
            <div style={{
              fontSize: '0.74rem',
              fontWeight: 800,
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <span>⏸️ Paused for chat music</span>
            </div>
          ) : musicNoteText ? (
            <div style={{
              fontSize: '0.72rem',
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
            fontSize: '0.86rem',
            fontWeight: 700,
            color: '#ffffff',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>{currentTrack.songTitle}</span>
          </div>

          <div style={{
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>{currentTrack.artistName || 'PulseChat Audio'}</span>
            <span>·</span>
            <span>{formatSecs(progress)} / {formatSecs(duration)}</span>
          </div>
        </div>

        {/* Buttons Action Group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {/* Mute button */}
          <button
            type="button"
            onClick={toggleMute}
            className="icon-btn-ghost"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isMuted ? '#ef4444' : 'var(--text-muted)',
              cursor: 'pointer'
            }}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          {/* Play / Pause Toggle Button */}
          <button
            type="button"
            onClick={togglePlayPause}
            style={{
              width: '36px',
              height: '36px',
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
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.45)',
              transition: 'transform 0.12s active'
            }}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying && !isDucked ? (
              <Pause size={17} />
            ) : (
              <Play size={17} style={{ marginLeft: '2px' }} />
            )}
          </button>

          {/* Close / Stop Track */}
          <button
            type="button"
            onClick={clearTrack}
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
            title="Stop Music"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
