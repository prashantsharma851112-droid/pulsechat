import React from 'react';

/**
 * Authoritative real-time vibe resolver:
 * When vibeAuras dictionary is available, it is the single source of truth.
 * If user is not in vibeAuras (or cleared), returns null immediately without falling back to stale cache.
 */
export function resolveUserAura(userObj, vibeAuras) {
  if (!userObj) return null;
  const uid = userObj.id || userObj._id;
  const uname = userObj.username;

  if (vibeAuras && typeof vibeAuras === 'object') {
    const live = (uid && vibeAuras[uid]) || (uname && vibeAuras[uname]);
    if (live && !live.cleared && live.auraType !== 'none' && (
      (live.mood && live.mood.trim() !== '') ||
      (live.inGame && live.inGame.trim() !== '') ||
      Boolean(live.isLowBattery)
    )) {
      return live;
    }
    return null;
  }

  const fallback = userObj.vibeAura;
  if (fallback && !fallback.cleared && fallback.auraType !== 'none' && (
    (fallback.mood && fallback.mood.trim() !== '') ||
    (fallback.inGame && fallback.inGame.trim() !== '') ||
    Boolean(fallback.isLowBattery)
  )) {
    return fallback;
  }
  return null;
}

export default function VibeAuraRing({
  children,
  auraData,
  aura,
  size = 48,
  onClick,
  showNoteBubble = true,
  hasCrown = false,
  isGroup = false
}) {
  const effectiveAura = auraData || aura;

  const hasActiveVibe = Boolean(
    effectiveAura &&
    !effectiveAura.cleared &&
    effectiveAura.auraType !== 'none' &&
    (
      (effectiveAura.mood && effectiveAura.mood.trim() !== '') ||
      (effectiveAura.inGame && effectiveAura.inGame.trim() !== '') ||
      Boolean(effectiveAura.isLowBattery)
    )
  );

  if (!hasActiveVibe) {
    return (
      <div style={{ position: 'relative', display: 'inline-block' }} onClick={onClick}>
        {children}
      </div>
    );
  }

  const {
    mood,
    emoji = '⚡',
    auraColor,
    auraType = 'neon_pulse',
    isLowBattery,
    batteryLevel,
    inGame
  } = effectiveAura;

  // Determine glow color: if specific auraColor is set, use it; if isLowBattery, use amber/red; if inGame, cyan
  const ringColor = (isLowBattery && batteryLevel && batteryLevel <= 20)
    ? '#ef4444'
    : (isLowBattery ? '#f59e0b' : (inGame ? '#06b6d4' : (auraColor || '#a855f7')));

  // Calculate top offset for Instagram-style thought note bubble
  // If user has a crown, float slightly higher so it doesn't overlap the crown
  const noteTop = hasCrown
    ? (size >= 80 ? '-34px' : '-26px')
    : (size >= 80 ? '-26px' : '-19px');

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'inline-block',
        cursor: onClick ? 'pointer' : 'default'
      }}
    >
      {/* Instagram-Style Floating Note / Thought Bubble Above DP */}
      {showNoteBubble && !isGroup && (mood || inGame) && (
        <div
          title={inGame ? `Playing ${inGame}` : mood}
          style={{
            position: 'absolute',
            top: noteTop,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.94)',
            border: `1.5px solid ${ringColor}`,
            boxShadow: `0 4px 12px rgba(0,0,0,0.65), 0 0 8px ${ringColor}45`,
            borderRadius: '13px',
            padding: '2px 7px',
            display: 'flex',
            alignItems: 'center',
            gap: '3.5px',
            whiteSpace: 'nowrap',
            maxWidth: size >= 80 ? '135px' : '105px',
            zIndex: 25,
            pointerEvents: 'none',
            animation: 'instaThoughtFloat 3s infinite ease-in-out'
          }}
        >
          <span style={{ fontSize: '0.74rem', lineHeight: 1 }}>{emoji || '⚡'}</span>
          <span style={{
            fontSize: '0.64rem',
            fontWeight: 700,
            color: '#f8fafc',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.2,
            letterSpacing: '-0.01em'
          }}>
            {inGame ? `Playing ${inGame}` : mood}
          </span>

          {/* Instagram Thought Bubble Trail Dots */}
          <div style={{
            position: 'absolute',
            bottom: '-4px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            background: 'rgba(15, 23, 42, 0.94)',
            border: `1px solid ${ringColor}`
          }} />
          <div style={{
            position: 'absolute',
            bottom: '-7px',
            left: '52%',
            transform: 'translateX(-50%)',
            width: '3px',
            height: '3px',
            borderRadius: '50%',
            background: ringColor
          }} />
        </div>
      )}

      {/* Animated Aura Glow Ring */}
      <div
        style={{
          position: 'absolute',
          inset: -3.5,
          borderRadius: isGroup ? '14px' : '50%',
          border: `2px solid ${ringColor}`,
          boxShadow: `0 0 10px ${ringColor}, inset 0 0 5px ${ringColor}`,
          animation: 'vibeAuraPulse 2s infinite ease-in-out',
          pointerEvents: 'none',
          zIndex: 1
        }}
      />

      {/* Avatar Children */}
      <div style={{ position: 'relative', zIndex: 2, borderRadius: isGroup ? '12px' : '50%', overflow: 'visible' }}>
        {children}
      </div>

      {/* Battery Indicator Badge (shown ONLY IF isLowBattery is explicitly true and batteryLevel is provided) */}
      {Boolean(isLowBattery && batteryLevel !== null && batteryLevel !== undefined) && (
        <div
          title={`Battery: ${batteryLevel}%`}
          style={{
            position: 'absolute',
            bottom: -2,
            right: -3,
            background: batteryLevel <= 20 ? '#ef4444' : '#10b981',
            color: '#fff',
            borderRadius: '11px',
            padding: '1px 5px',
            fontSize: size >= 80 ? '0.72rem' : '0.60rem',
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            gap: '1.5px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.85)',
            zIndex: 4,
            border: '1.5px solid var(--bg-card, #0f172a)'
          }}
        >
          <span style={{ fontSize: '0.62rem' }}>⚡</span>
          <span>{batteryLevel}%</span>
        </div>
      )}

      {/* In-Game Badge (if not battery) */}
      {!isLowBattery && inGame && (
        <div
          title={`Playing ${inGame}`}
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            background: '#06b6d4',
            color: '#fff',
            borderRadius: '50%',
            width: '16px',
            height: '16px',
            fontSize: '0.65rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.8)',
            zIndex: 4,
            border: '1.5px solid var(--bg-card, #0f172a)'
          }}
        >
          🎮
        </div>
      )}

      <style>{`
        @keyframes vibeAuraPulse {
          0% { transform: scale(1.0); opacity: 0.75; }
          50% { transform: scale(1.05); opacity: 1.0; }
          100% { transform: scale(1.0); opacity: 0.75; }
        }
        @keyframes instaThoughtFloat {
          0% { transform: translateX(-50%) translateY(0px); }
          50% { transform: translateX(-50%) translateY(-2.5px); }
          100% { transform: translateX(-50%) translateY(0px); }
        }
      `}</style>
    </div>
  );
}
