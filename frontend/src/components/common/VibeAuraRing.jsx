import React from 'react';

export default function VibeAuraRing({
  children,
  auraData,
  size = 48,
  onClick
}) {
  if (!auraData || (!auraData.mood && !auraData.isLowBattery && !auraData.inGame && !auraData.auraType)) {
    return (
      <div style={{ position: 'relative', display: 'inline-block' }} onClick={onClick}>
        {children}
      </div>
    );
  }

  const {
    mood,
    emoji = '⚡',
    auraColor = '#10b981',
    auraType = 'neon_pulse',
    isLowBattery,
    batteryLevel,
    inGame
  } = auraData;

  // Determine glow color
  const ringColor = isLowBattery ? '#f59e0b' : (inGame ? '#06b6d4' : auraColor);

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'inline-block',
        cursor: onClick ? 'pointer' : 'default'
      }}
    >
      {/* Animated Aura Glow Ring */}
      <div
        style={{
          position: 'absolute',
          inset: -3.5,
          borderRadius: '50%',
          border: `2px solid ${ringColor}`,
          boxShadow: `0 0 10px ${ringColor}, inset 0 0 6px ${ringColor}`,
          animation: 'vibeAuraPulse 2s infinite ease-in-out',
          pointerEvents: 'none',
          zIndex: 1
        }}
      />

      {/* Avatar Children */}
      <div style={{ position: 'relative', zIndex: 2, borderRadius: '50%', overflow: 'hidden' }}>
        {children}
      </div>

      {/* Low Battery Indicator Badge */}
      {isLowBattery && (
        <div
          title={`Low Battery: ${batteryLevel ? batteryLevel + '%' : 'Dying'}`}
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            background: '#ef4444',
            color: '#fff',
            borderRadius: '10px',
            padding: '1px 4px',
            fontSize: '0.62rem',
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            gap: '1px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.8)',
            zIndex: 3,
            animation: 'pulse 1s infinite'
          }}
        >
          <span>⚡</span>
          {batteryLevel && <span>{batteryLevel}%</span>}
        </div>
      )}

      {/* In-Game Badge */}
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
            zIndex: 3
          }}
        >
          🎮
        </div>
      )}

      {/* Custom Mood Emoji Badge */}
      {!isLowBattery && !inGame && emoji && (
        <div
          title={mood || 'Vibe'}
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            fontSize: '0.72rem',
            zIndex: 3,
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))'
          }}
        >
          {emoji}
        </div>
      )}

      <style>{`
        @keyframes vibeAuraPulse {
          0% { transform: scale(1.0); opacity: 0.75; }
          50% { transform: scale(1.06); opacity: 1.0; }
          100% { transform: scale(1.0); opacity: 0.75; }
        }
      `}</style>
    </div>
  );
}
