import React from 'react';
import { Music, SlidersHorizontal } from 'lucide-react';

/**
 * Instagram-Style Interactive Music Sticker Component
 * Supports 5 authentic Instagram sticker shapes:
 * 1. 'card'   - Classic frosted glass card with album art & equalizer
 * 2. 'pill'   - Minimalist sleek floating pill with rotating mini disc
 * 3. 'vinyl'  - Authentic spinning grooved vinyl record with center art & badge
 * 4. 'square' - Album cover art poster with bottom title overlay & waves
 * 5. 'banner' - Vibrant neon gradient banner with audio visualizer
 */
export default function InstagramMusicSticker({
  songTitle = 'Pulse Track',
  artistName = 'Pulse Music',
  albumArt,
  styleType = 'card',
  isPlaying = true,
  isEditable = false,
  onTrimClick,
  onTap
}) {
  const coverUrl = albumArt || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(songTitle || 'track')}`;

  // Equalizer wave bars component
  const renderEqualizerBars = (color = '#ec4899', height = 14) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '2.5px',
        height: `${height}px`,
        flexShrink: 0
      }}
    >
      <span
        style={{
          width: '2.5px',
          background: color,
          borderRadius: '1.5px',
          animation: isPlaying ? 'musicWaveBar1 0.65s infinite alternate ease-in-out' : 'none',
          height: isPlaying ? '10px' : '4px'
        }}
      />
      <span
        style={{
          width: '2.5px',
          background: '#f59e0b',
          borderRadius: '1.5px',
          animation: isPlaying ? 'musicWaveBar2 0.75s infinite alternate ease-in-out' : 'none',
          height: isPlaying ? '14px' : '5px'
        }}
      />
      <span
        style={{
          width: '2.5px',
          background: '#06b6d4',
          borderRadius: '1.5px',
          animation: isPlaying ? 'musicWaveBar3 0.6s infinite alternate ease-in-out' : 'none',
          height: isPlaying ? '8px' : '3px'
        }}
      />
      <span
        style={{
          width: '2.5px',
          background: '#a855f7',
          borderRadius: '1.5px',
          animation: isPlaying ? 'musicWaveBar4 0.7s infinite alternate ease-in-out' : 'none',
          height: isPlaying ? '12px' : '4px'
        }}
      />
    </div>
  );

  return (
    <div
      onClick={onTap}
      style={{
        display: 'inline-block',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'manipulation'
      }}
    >
      {/* ==========================================
          STYLE 1: CLASSIC FROSTED GLASS ALBUM CARD
          ========================================== */}
      {styleType === 'card' && (
        <div
          style={{
            minWidth: '200px',
            maxWidth: '240px',
            padding: '9px 12px',
            borderRadius: '16px',
            background: 'rgba(15, 17, 24, 0.84)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#ffffff'
          }}
        >
          {/* Square Album Cover */}
          <div
            style={{
              position: 'relative',
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              overflow: 'hidden',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.15)'
            }}
          >
            <img
              src={coverUrl}
              alt={songTitle}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>

          {/* Title & Artist info */}
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div
              style={{
                fontSize: '0.82rem',
                fontWeight: 800,
                color: '#ffffff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.25,
                letterSpacing: '-0.01em'
              }}
            >
              {songTitle}
            </div>
            <div
              style={{
                fontSize: '0.67rem',
                fontWeight: 500,
                color: 'rgba(255, 255, 255, 0.72)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginTop: '2px',
                lineHeight: 1.2
              }}
            >
              {artistName || 'Pulse Music'}
            </div>
          </div>

          {/* Equalizer or Trim Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {renderEqualizerBars('#ec4899', 14)}
            {isEditable && onTrimClick && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTrimClick();
                }}
                style={{
                  padding: '3px 7px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.22)',
                  border: '1px solid rgba(16, 185, 129, 0.45)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  color: '#34d399',
                  cursor: 'pointer'
                }}
                title="Trim audio segment"
              >
                <SlidersHorizontal size={10} />
                <span>Trim</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ==========================================
          STYLE 2: COMPACT SLEEK FLOATING PILL
          ========================================== */}
      {styleType === 'pill' && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 14px 5px 6px',
            borderRadius: '26px',
            background: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.5)',
            color: '#ffffff',
            maxWidth: '240px'
          }}
        >
          {/* Mini Rotating Disc */}
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              overflow: 'hidden',
              flexShrink: 0,
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              animation: isPlaying ? 'spinVinyl 4s linear infinite' : 'none'
            }}
          >
            <img
              src={coverUrl}
              alt={songTitle}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>

          {/* Song Title & Artist in single clean row */}
          <div
            style={{
              fontSize: '0.76rem',
              fontWeight: 800,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '135px'
            }}
          >
            {songTitle}
            <span style={{ fontWeight: 400, opacity: 0.7, marginLeft: '4px', fontSize: '0.68rem' }}>
              • {artistName || 'Pulse Music'}
            </span>
          </div>

          {/* Equalizer wave bars */}
          {renderEqualizerBars('#38bdf8', 12)}

          {isEditable && onTrimClick && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onTrimClick();
              }}
              style={{
                padding: '2px 5px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.25)',
                color: '#34d399',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer'
              }}
              title="Trim audio"
            >
              <SlidersHorizontal size={9} />
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          STYLE 3: AUTHENTIC SPINNING VINYL RECORD
          ========================================== */}
      {styleType === 'vinyl' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          {/* Grooved Vinyl Disc */}
          <div
            style={{
              position: 'relative',
              width: '84px',
              height: '84px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #2a2a2a 0%, #151515 45%, #232323 50%, #121212 90%, #000 100%)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7), inset 0 0 2px rgba(255, 255, 255, 0.25)',
              border: '1.5px solid rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: isPlaying ? 'spinVinyl 5s linear infinite' : 'none'
            }}
          >
            {/* Vinyl Circular Grooves */}
            <div
              style={{
                position: 'absolute',
                inset: '8px',
                borderRadius: '50%',
                border: '0.5px solid rgba(255, 255, 255, 0.08)',
                pointerEvents: 'none'
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: '16px',
                borderRadius: '50%',
                border: '0.5px solid rgba(255, 255, 255, 0.08)',
                pointerEvents: 'none'
              }}
            />

            {/* Center Album Art Label */}
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                overflow: 'hidden',
                position: 'relative',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.3)'
              }}
            >
              <img
                src={coverUrl}
                alt={songTitle}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {/* Center Spindle Pinhole */}
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#000000',
                  border: '1px solid rgba(255, 255, 255, 0.4)'
                }}
              />
            </div>
          </div>

          {/* Floating Aesthetic Title Pill */}
          <div
            style={{
              padding: '4px 10px',
              borderRadius: '12px',
              background: 'rgba(0, 0, 0, 0.76)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              color: '#ffffff',
              maxWidth: '170px',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)'
            }}
          >
            <Music size={11} color="#f59e0b" />
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {songTitle}
            </span>
            {renderEqualizerBars('#f59e0b', 10)}
          </div>
        </div>
      )}

      {/* ==========================================
          STYLE 4: SQUARE ALBUM COVER POSTER
          ========================================== */}
      {styleType === 'square' && (
        <div
          style={{
            position: 'relative',
            width: '98px',
            height: '98px',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 10px 28px rgba(0, 0, 0, 0.65)',
            border: '1.5px solid rgba(255, 255, 255, 0.25)'
          }}
        >
          <img
            src={coverUrl}
            alt={songTitle}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />

          {/* Bottom Dark Gradient for Title Legibility */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, transparent 35%, rgba(0, 0, 0, 0.88) 100%)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              padding: '7px 8px'
            }}
          >
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                color: '#ffffff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                textShadow: '0 1px 4px rgba(0, 0, 0, 0.8)'
              }}
            >
              {songTitle}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '1px'
              }}
            >
              <span
                style={{
                  fontSize: '0.6rem',
                  color: 'rgba(255, 255, 255, 0.75)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '55px'
                }}
              >
                {artistName || 'Pulse'}
              </span>
              {renderEqualizerBars('#ffffff', 10)}
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          STYLE 5: NEON GRADIENT BANNER
          ========================================== */}
      {styleType === 'banner' && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '7px 16px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(236, 72, 153, 0.9))',
            boxShadow: '0 6px 24px rgba(236, 72, 153, 0.45)',
            border: '1px solid rgba(255, 255, 255, 0.35)',
            color: '#ffffff',
            maxWidth: '240px'
          }}
        >
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Music size={13} color="#ffffff" />
          </div>

          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div
              style={{
                fontSize: '0.8rem',
                fontWeight: 800,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                letterSpacing: '-0.01em'
              }}
            >
              {songTitle}
            </div>
            <div
              style={{
                fontSize: '0.64rem',
                opacity: 0.85,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {artistName || 'Pulse Music'}
            </div>
          </div>

          {renderEqualizerBars('#ffffff', 13)}
        </div>
      )}
    </div>
  );
}
