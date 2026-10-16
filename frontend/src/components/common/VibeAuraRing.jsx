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
  const now = Date.now();

  // 1. Check live real-time vibeAuras dictionary
  if (vibeAuras && typeof vibeAuras === 'object') {
    const live = (uid && vibeAuras[uid]) || (uname && vibeAuras[uname]);
    if (live) {
      if (live.cleared || live.auraType === 'none') {
        return null;
      }
      // If 5-minute trial has expired, drop it immediately!
      if (live.trialExpiresAt && now > Number(live.trialExpiresAt)) {
        return null;
      }
      if (
        (live.mood && live.mood.trim() !== '') ||
        (live.inGame && live.inGame.trim() !== '') ||
        Boolean(live.isLowBattery)
      ) {
        return live;
      }
      return null;
    }
  }

  // 2. Fallback to userObj.vibeAura (from MongoDB / props / cache)
  const fallback = userObj.vibeAura;
  if (fallback && !fallback.cleared && fallback.auraType !== 'none') {
    // If 5-minute trial has expired, drop it immediately!
    if (fallback.trialExpiresAt && now > Number(fallback.trialExpiresAt)) {
      return null;
    }
    if (
      (fallback.mood && fallback.mood.trim() !== '') ||
      (fallback.inGame && fallback.inGame.trim() !== '') ||
      Boolean(fallback.isLowBattery)
    ) {
      return fallback;
    }
  }
  return null;
}

export function getProAuraRingClass(aura, isUserPro = false) {
  if (!aura) return isUserPro ? 'pro-neon-avatar' : '';
  const isExpired = aura.trialExpiresAt && Date.now() > Number(aura.trialExpiresAt);
  if (isExpired || aura.cleared || aura.auraType === 'none') {
    return isUserPro ? 'pro-neon-avatar' : '';
  }
  if (aura.auraType === 'dragon_glow') return 'pro-neon-avatar pro-neon-dragon';
  if (aura.auraType === 'neon_flame') return 'pro-neon-avatar pro-neon-flame';
  if (aura.auraType === 'cyber_neon') return 'pro-neon-avatar';
  return isUserPro ? 'pro-neon-avatar' : '';
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
  const isExpired = effectiveAura?.trialExpiresAt && Date.now() > Number(effectiveAura.trialExpiresAt);

  const hasActiveVibe = Boolean(
    !isExpired &&
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

  const isNeonRingAura = auraType === 'dragon_glow' || auraType === 'cyber_neon' || auraType === 'neon_flame';

  // Determine glow color: if specific auraColor is set, use it; if isLowBattery, use amber/red; if inGame, cyan
  const ringColor = (isLowBattery && batteryLevel && batteryLevel <= 20)
    ? '#ef4444'
    : (isLowBattery ? '#f59e0b' : (inGame ? '#06b6d4' : (auraColor || '#a855f7')));

  // Calculate top offset for Instagram-style thought note bubble
  const noteTop = hasCrown
    ? (size >= 80 ? '-26px' : '-20px')
    : (size >= 80 ? '-20px' : '-15px');

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'inline-block',
        cursor: onClick ? 'pointer' : 'default'
      }}
    >
      {/* Animated Aura Glow Ring (only for non-neon-ring auras e.g. low battery or custom mood) */}
      {!isNeonRingAura && (
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
      )}

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
        @keyframes neonFlameFlicker {
          0% { transform: scale(1.0); box-shadow: 0 0 12px #ff0055, 0 0 24px #ff5500; opacity: 0.85; }
          50% { transform: scale(1.07); box-shadow: 0 0 18px #ff0055, 0 0 34px #ff5500, 0 0 44px #ffaa00; opacity: 1.0; }
          100% { transform: scale(1.0); box-shadow: 0 0 12px #ff0055, 0 0 24px #ff5500; opacity: 0.85; }
        }
        @keyframes dragonGlowFlicker {
          0% { transform: scale(1.0); box-shadow: 0 0 12px #f59e0b, 0 0 24px #ef4444; opacity: 0.85; }
          50% { transform: scale(1.07); box-shadow: 0 0 18px #ffd700, 0 0 32px #f59e0b, 0 0 42px #ef4444; opacity: 1.0; }
          100% { transform: scale(1.0); box-shadow: 0 0 12px #f59e0b, 0 0 24px #ef4444; opacity: 0.85; }
        }
        @keyframes cyberNeonRainbow {
          0% { transform: scale(1.0); box-shadow: 0 0 12px #ec4899, 0 0 24px #06b6d4; border-color: #ec4899; opacity: 0.9; }
          33% { transform: scale(1.06); box-shadow: 0 0 18px #06b6d4, 0 0 30px #a855f7; border-color: #06b6d4; opacity: 1.0; }
          66% { transform: scale(1.04); box-shadow: 0 0 18px #a855f7, 0 0 32px #10b981; border-color: #a855f7; opacity: 1.0; }
          100% { transform: scale(1.0); box-shadow: 0 0 12px #ec4899, 0 0 24px #06b6d4; border-color: #ec4899; opacity: 0.9; }
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
