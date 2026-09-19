import React from 'react';

export default function AppLogo({ size = 62, glow = true, className = '' }) {
  return (
    <div
      className={`app-logo-container ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: '16px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: glow
          ? '0 10px 25px rgba(99, 102, 241, 0.45), 0 0 20px rgba(99, 102, 241, 0.3)'
          : 'none',
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
        background: '#ffffff',
        padding: '3px',
        border: '2px solid rgba(255, 255, 255, 0.85)'
      }}
    >
      <img
        src="/icon-192.png"
        alt="PulseChat"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
          borderRadius: '12px'
        }}
      />
    </div>
  );
}
