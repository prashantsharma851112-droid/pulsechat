import React, { useState, useEffect, useRef } from 'react';
import { X, User as UserIcon } from 'lucide-react';
import { useBackHandler } from '../../utils/backNavigation';

export default function FullDpModal({ imageUrl, name, username, onClose }) {
  useBackHandler(onClose, true);
  const defaultFallback = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username || 'pulse'}`;
  const [imgSrc, setImgSrc] = useState(imageUrl || defaultFallback);
  const [imgLoading, setImgLoading] = useState(true);
  const [hasFailed, setHasFailed] = useState(false);

  // Swipe-down to dismiss physics (Instagram style)
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartRef = useRef({ y: 0, time: 0 });

  const handleTouchStart = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    touchStartRef.current = {
      y: e.touches[0].clientY,
      time: Date.now()
    };
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging || !e.touches || e.touches.length === 0) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartRef.current.y;
    if (diff > 0) {
      setDragY(diff);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const elapsed = Date.now() - touchStartRef.current.time;
    if (dragY > 80 || (dragY > 35 && elapsed < 250)) {
      onClose();
    } else {
      setDragY(0);
    }
  };

  useEffect(() => {
    setImgSrc(imageUrl || defaultFallback);
    setImgLoading(true);
    setHasFailed(false);

    // Safety timeout: Never stay stuck on "Loading DP..." for more than 1 second!
    const timer = setTimeout(() => {
      setImgLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [imageUrl, username]);

  const handleImageError = () => {
    if (imgSrc !== defaultFallback) {
      setImgSrc(defaultFallback);
    } else {
      setHasFailed(true);
    }
    setImgLoading(false);
  };

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

      {/* Main Fullscreen DP Image Container with Instagram Swipe-down dismiss */}
      <div
        onClick={e => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'relative',
          maxWidth: '90vw',
          maxHeight: '80vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: 'none',
          transform: dragY > 0 ? `translateY(${dragY}px) scale(${Math.max(0.72, 1 - dragY / 700)})` : 'none',
          transition: isDragging ? 'none' : 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.24s ease',
          opacity: dragY > 0 ? Math.max(0.3, 1 - dragY / 380) : 1
        }}
      >
        {imgLoading && (
          <div style={{ position: 'absolute', color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem', fontWeight: 600 }}>
            Loading DP...
          </div>
        )}

        {hasFailed ? (
          <div style={{
            width: '260px',
            height: '260px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '4rem',
            fontWeight: 900
          }}>
            {name ? name.charAt(0).toUpperCase() : <UserIcon size={80} />}
          </div>
        ) : (
          <img
            src={imgSrc}
            alt={name || 'Profile Picture'}
            onLoad={() => setImgLoading(false)}
            onError={handleImageError}
            draggable={false}
            style={{
              width: 'auto',
              height: 'auto',
              minWidth: '220px',
              minHeight: '220px',
              maxWidth: '85vw',
              maxHeight: '75vh',
              borderRadius: '24px',
              objectFit: 'contain',
              boxShadow: '0 25px 70px rgba(0, 0, 0, 0.8)',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              opacity: imgLoading ? 0.3 : 1,
              transition: 'opacity 0.2s ease',
              userSelect: 'none'
            }}
          />
        )}
      </div>

      {/* Swipe down or tap outside hint */}
      <p style={{ position: 'absolute', bottom: '20px', color: 'rgba(255, 255, 255, 0.55)', fontSize: '0.82rem', margin: 0, fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span>↓ Swipe down or tap outside to close</span>
      </p>
    </div>
  );
}
