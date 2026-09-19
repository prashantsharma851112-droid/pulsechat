import React, { useState, useEffect } from 'react';
import { X, Lock, ShieldAlert } from 'lucide-react';

export default function ViewOnceModal({ message, onMarkViewed, onClose }) {
  const [isScreenProtected, setIsScreenProtected] = useState(false);
  const [securityWarning, setSecurityWarning] = useState(null);

  useEffect(() => {
    // Mark as viewed as soon as modal opens
    if (onMarkViewed) {
      onMarkViewed();
    }
  }, []);

  // Anti-Screenshot & Screen-Capture Detection
  useEffect(() => {
    // 1. Detect Window Blur / Snipping Tool activation
    const handleWindowBlur = () => {
      setIsScreenProtected(true);
      setSecurityWarning("Screen capture attempt detected! Media is hidden.");
    };

    const handleWindowFocus = () => {
      // Re-show after short delay once focused
      setTimeout(() => {
        setIsScreenProtected(false);
      }, 500);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsScreenProtected(true);
        setSecurityWarning("Window hidden. Screen capture is prohibited.");
      } else {
        setTimeout(() => {
          setIsScreenProtected(false);
        }, 500);
      }
    };

    // 2. Intercept PrintScreen and OS screenshot shortcuts
    const handleKeyDown = (e) => {
      // PrtScn key, Ctrl+P (Print), Ctrl+S (Save), Cmd+Shift+3/4/5 (Mac screenshots)
      if (
        e.key === 'PrintScreen' ||
        (e.ctrlKey && (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S')) ||
        (e.metaKey && e.shiftKey)
      ) {
        e.preventDefault();
        // Clear clipboard immediately
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText('').catch(() => {});
        }
        setIsScreenProtected(true);
        setSecurityWarning("⚠️ Screenshots are strictly prohibited on View-Once media.");
        setTimeout(() => {
          setIsScreenProtected(false);
        }, 2500);
      }
    };

    // 3. Clear clipboard on copy event
    const handleCopy = (e) => {
      e.preventDefault();
      if (e.clipboardData) {
        e.clipboardData.clearData();
      }
    };

    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('copy', handleCopy);

    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('copy', handleCopy);
    };
  }, []);

  if (!message || !message.mediaUrl) return null;

  const isVideo = message.type === 'video';

  return (
    <div
      className="incoming-call-overlay"
      onContextMenu={(e) => e.preventDefault()}
      style={{
        zIndex: 100000,
        background: 'rgba(0, 0, 0, 0.98)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none'
      }}
    >
      {/* Top Bar */}
      <div style={{ position: 'absolute', top: '20px', left: '20px', right: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '0.9rem', fontWeight: 600, background: 'rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: '20px' }}>
          <Lock size={16} color="var(--accent)" /> View Once {isVideo ? 'Video' : 'Photo'}
        </div>
        <button onClick={onClose} className="icon-btn-ghost" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', padding: '10px' }} title="Close">
          <X size={24} />
        </button>
      </div>

      {/* Security Toast Warning */}
      {securityWarning && (
        <div style={{
          position: 'absolute',
          top: '75px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(239, 68, 68, 0.92)',
          color: '#fff',
          padding: '8px 18px',
          borderRadius: '24px',
          fontSize: '0.85rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 30,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          animation: 'fadeIn 0.2s ease'
        }}>
          <ShieldAlert size={18} />
          <span>{securityWarning}</span>
        </div>
      )}

      {/* Content display with DRM protection shield */}
      <div style={{ maxWidth: '90vw', maxHeight: '85vh', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isScreenProtected ? (
          /* Blank screen shield when screen capture or blur is detected */
          <div style={{
            width: '320px',
            height: '240px',
            background: '#111',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '1.5rem',
            textAlign: 'center',
            color: '#f87171'
          }}>
            <ShieldAlert size={40} color="#ef4444" />
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Protected Content</div>
            <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
              Screenshots and screen captures are blocked for View-Once privacy. Return focus to view.
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            {/* Invisible Touch Shield over media (prevents right-click or long-press "Save Image" popup) */}
            <div
              onContextMenu={(e) => e.preventDefault()}
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 10,
                cursor: 'default',
                background: 'transparent'
              }}
            />

            {/* Subtle Diagonal Security Watermark */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 5,
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}
            >
              <div style={{
                transform: 'rotate(-30deg)',
                color: 'rgba(255, 255, 255, 0.12)',
                fontSize: '1.1rem',
                fontWeight: 800,
                letterSpacing: '2px',
                whiteSpace: 'nowrap',
                userSelect: 'none'
              }}>
                🔒 PULSECHAT • PROTECTED VIEW ONCE • SCREENSHOT PROHIBITED
              </div>
            </div>

            {isVideo ? (
              <video
                src={message.mediaUrl}
                autoPlay
                controls
                playsInline
                draggable={false}
                style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '12px', pointerEvents: 'auto' }}
              />
            ) : (
              <img
                src={message.mediaUrl}
                alt="View Once Media"
                draggable={false}
                style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: '12px' }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
