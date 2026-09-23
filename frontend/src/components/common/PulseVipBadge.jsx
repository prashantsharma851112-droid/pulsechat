import React from 'react';

/**
 * PulseVipBadge - Exclusive bespoke emblem for PulseChat VIP members.
 * Unique geometric resonance crest with electric pulse waveform.
 */
export default function PulseVipBadge({ size = 18, showLabel = true, className = '' }) {
  return (
    <span
      className={`pulse-vip-emblem ${className}`}
      title="Pulse VIP Resonance — Verified Member"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        verticalAlign: 'middle',
        userSelect: 'none'
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0, filter: 'drop-shadow(0 2px 5px rgba(245, 158, 11, 0.45))' }}
      >
        <defs>
          <linearGradient id="pulseVipGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="45%" stopColor="#f59e0b" />
            <stop offset="75%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>

        {/* Faceted Hex-Shield Shield */}
        <path
          d="M12 2L20.5 7V17L12 22L3.5 17V7L12 2Z"
          fill="url(#pulseVipGrad)"
        />
        {/* Inner Dark Glass Facet */}
        <path
          d="M12 3.8L18.8 7.8V16.2L12 20.2L5.2 16.2V7.8L12 3.8Z"
          fill="#130d24"
          stroke="rgba(251, 191, 36, 0.5)"
          strokeWidth="0.75"
        />
        {/* Electric Frequency Pulse Bolt */}
        <path
          d="M13.2 5.5L8.5 12.2H12.2L10.8 18.5L15.5 11.8H11.8L13.2 5.5Z"
          fill="url(#pulseVipGrad)"
        />
      </svg>

      {showLabel && (
        <span
          style={{
            fontSize: '0.66rem',
            fontWeight: 900,
            letterSpacing: '0.04em',
            background: 'linear-gradient(90deg, #fbbf24 0%, #f59e0b 60%, #ec4899 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textTransform: 'uppercase'
          }}
        >
          VIP
        </span>
      )}
    </span>
  );
}
