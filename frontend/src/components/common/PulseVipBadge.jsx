import React, { useId } from 'react';

/**
 * PulseVipBadge - Luxury bespoke emblem for PulseChat VIP members.
 * High-end metallic 24K gold with crystal resonance core and animated shimmer.
 */
export default function PulseVipBadge({ size = 18, showLabel = true, className = '' }) {
  const uid = useId().replace(/:/g, '');

  return (
    <span
      className={`pulse-vip-emblem ${className}`}
      title="Pulse VIP Resonance — Verified Member"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        verticalAlign: 'middle',
        userSelect: 'none',
        lineHeight: 1
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          flexShrink: 0,
          filter: 'drop-shadow(0 0 7px rgba(255, 185, 0, 0.65)) drop-shadow(0 2px 5px rgba(0, 0, 0, 0.45))'
        }}
      >
        <defs>
          {/* Metallic 24K Liquid Gold */}
          <linearGradient id={`goldBase_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff8db" />
            <stop offset="25%" stopColor="#f59e0b" />
            <stop offset="55%" stopColor="#d97706" />
            <stop offset="85%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#ffd700" />
          </linearGradient>

          {/* Liquid Cyber Core Gradient */}
          <radialGradient id={`coreGlow_${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff" />
            <stop offset="35%" stopColor="#ffd23f" />
            <stop offset="70%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#7c3aed" />
          </radialGradient>

          {/* Outer Ring Cyber Bevel */}
          <linearGradient id={`outerRim_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="30%" stopColor="#818cf8" />
            <stop offset="70%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
        </defs>

        {/* Outer 8-Pointed Geometric Resonance Star */}
        <path
          d="M14 1L17.5 7.5L24.5 7.5L20.5 13.5L24.5 19.5L17.5 19.5L14 26L10.5 19.5L3.5 19.5L7.5 13.5L3.5 7.5L10.5 7.5Z"
          fill={`url(#outerRim_${uid})`}
        />

        {/* Polished Gold Crown-Shield Core */}
        <path
          d="M14 2.8L16.8 8.4L22.8 8.4L19.2 13.5L22.8 18.6L16.8 18.6L14 24.2L11.2 18.6L5.2 18.6L8.8 13.5L5.2 8.4L11.2 8.4Z"
          fill="#0c0a1a"
          stroke={`url(#goldBase_${uid})`}
          strokeWidth="1.2"
        />

        {/* Dimensional Obsidian & Gem Facets */}
        <polygon
          points="14,5 18,13.5 14,22 10,13.5"
          fill={`url(#coreGlow_${uid})`}
          opacity="0.85"
        />

        {/* Electric Frequency Pulse Lightning Emblem */}
        <path
          d="M14.8 6.5L10.2 13.2H14.1L12.5 20.5L17.8 12.8H13.6L14.8 6.5Z"
          fill="#ffffff"
          style={{
            filter: 'drop-shadow(0 0 3px #fbbf24) drop-shadow(0 0 6px #f59e0b)'
          }}
        />

        {/* Specular White Glint Reflection */}
        <circle cx="11.5" cy="8.5" r="1.2" fill="#ffffff" opacity="0.9" />
        <circle cx="18" cy="18" r="0.8" fill="#fbbf24" opacity="0.8" />
      </svg>

      {showLabel && (
        <span
          className="pulse-vip-pill-text"
          style={{
            fontSize: '0.66rem',
            fontWeight: 900,
            letterSpacing: '0.06em',
            padding: '2px 7px',
            borderRadius: '999px',
            background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(236, 72, 153, 0.15))',
            border: '1px solid rgba(251, 191, 36, 0.45)',
            boxShadow: '0 0 10px rgba(245, 158, 11, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
            color: '#fbbf24',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            textTransform: 'uppercase'
          }}
        >
          <span
            style={{
              background: 'linear-gradient(90deg, #ffffff 0%, #fde047 40%, #fb923c 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 0 8px rgba(251, 191, 36, 0.5)'
            }}
          >
            VIP
          </span>
        </span>
      )}
    </span>
  );
}
