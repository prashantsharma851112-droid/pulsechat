import React, { useState } from 'react';
import { X } from 'lucide-react';

export default function FullDpModal({ imageUrl, name, username, onClose }) {
  const defaultFallback = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username || 'pulse'}`;
  const [imgSrc, setImgSrc] = useState(imageUrl || defaultFallback);
  const [imgLoading, setImgLoading] = useState(true);

  React.useEffect(() => {
    setImgSrc(imageUrl || defaultFallback);
    setImgLoading(true);
  }, [imageUrl, username]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.92)',
        backdropFilter: 'blur(16px)',
        zIndex: 20000,
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
          zIndex: 20001
        }}
      >
        <div>
          {name && <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>{name}</h4>}
          {username && <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)' }}>@{username}</p>}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            border: 'none',
            color: '#fff',
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(6px)',
            transition: 'background 0.2s ease'
          }}
          title="Close Full Screen"
        >
          <X size={24} />
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
        {imgLoading && (
          <div style={{ position: 'absolute', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
            Loading DP...
          </div>
        )}
        <img
          src={imgSrc}
          alt={name || 'Profile Picture'}
          onLoad={() => setImgLoading(false)}
          onError={() => {
            if (imgSrc !== defaultFallback) {
              setImgSrc(defaultFallback);
            }
            setImgLoading(false);
          }}
          style={{
            width: 'auto',
            height: 'auto',
            minWidth: '260px',
            minHeight: '260px',
            maxWidth: '85vw',
            maxHeight: '75vh',
            borderRadius: '24px',
            objectFit: 'contain',
            boxShadow: '0 25px 70px rgba(0, 0, 0, 0.8)',
            border: '2px solid rgba(255, 255, 255, 0.2)',
            opacity: imgLoading ? 0 : 1,
            transition: 'opacity 0.25s ease'
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
