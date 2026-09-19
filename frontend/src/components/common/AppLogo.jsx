import React from 'react';

export default function AppLogo({ size = 56, glow = true, className = '' }) {
  return (
    <div
      className={`app-logo-container ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: glow ? '0 10px 25px rgba(99, 102, 241, 0.4), 0 0 20px rgba(99, 102, 241, 0.2)' : 'none',
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative'
      }}
    >
      <svg
        viewBox="0 0 512 512"
        width={size}
        height={size}
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        <rect width="512" height="512" rx="128" fill="#0b0f19" />
        <circle cx="256" cy="256" r="180" fill="url(#appLogoGrad)" />
        <path
          d="M180 210 Q256 160 332 210 Q360 256 332 302 Q256 352 180 302 Q152 256 180 210 Z"
          fill="#ffffff"
        />
        <circle cx="215" cy="256" r="20" fill="#6366f1" />
        <circle cx="297" cy="256" r="20" fill="#6366f1" />
        <defs>
          <linearGradient id="appLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
