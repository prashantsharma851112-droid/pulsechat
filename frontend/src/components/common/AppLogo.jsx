import React from 'react';

export default function AppLogo({ size = 56, className = '' }) {
  return (
    <div
      className={`app-logo-container ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: '14px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
        background: '#ffffff',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)'
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
