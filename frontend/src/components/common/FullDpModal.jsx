import React from 'react';
import { X, ZoomIn } from 'lucide-react';

export default function FullDpModal({ imageUrl, name, username, onClose }) {
  if (!imageUrl) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(12px)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      {/* Top Bar with Name & Close Button */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          right: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#fff',
          zIndex: 10001
        }}
      >
        <div>
          {name && <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{name}</h4>}
          {username && <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>@{username}</p>}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            border: 'none',
            color: '#fff',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
            transition: 'background 0.2s ease'
          }}
          title="Close Full Screen"
        >
          <X size={22} />
        </button>
      </div>

      {/* Main Fullscreen DP Image Container */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          maxWidth: '90vw',
          maxHeight: '80vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <img
          src={imageUrl}
          alt={name || 'Profile Picture'}
          style={{
            maxWidth: '100%',
            maxHeight: '80vh',
            borderRadius: '20px',
            objectFit: 'contain',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
            border: '2px solid rgba(255, 255, 255, 0.15)'
          }}
        />
      </div>

      {/* Click outside hint */}
      <p style={{ position: 'absolute', bottom: '20px', color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.8rem', margin: 0 }}>
        Tap anywhere outside to close
      </p>
    </div>
  );
}
