import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Lock, ShieldAlert, Eye, AlertOctagon, ArrowLeft, CornerUpLeft, Plus } from 'lucide-react';
import { useBackHandler } from '../../utils/backNavigation';

function formatLightboxDateTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
  if (isToday) {
    return `Today, ${time}`;
  }
  const day = date.getDate();
  const month = date.toLocaleDateString([], { month: 'long' });
  return `${day} ${month}, ${time}`;
}

export default function ViewOnceModal({
  message,
  viewCount = 1,
  senderName,
  isMine,
  onReply,
  onReact,
  onOpenUnlimitedEmoji,
  onMarkViewed,
  onClose
}) {
  const [hasMarkedViewed, setHasMarkedViewed] = useState(false);
  const [screenshotBlocked, setScreenshotBlocked] = useState(false);
  const [securityWarning, setSecurityWarning] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isHolding, setIsHolding] = useState(false);

  const canvasRef = useRef(null);
  const imageObjRef = useRef(null);
  const videoRef = useRef(null);
  const warningTimerRef = useRef(null);

  const isVideo = message?.type === 'video';
  const viewLimit = message?.viewLimit || (message?.isViewTwice ? 2 : 1);

  useBackHandler(() => {
    if (!hasMarkedViewed && onMarkViewed) onMarkViewed();
    onClose();
  }, true);

  const triggerSecurityAlert = useCallback((warningText) => {
    setScreenshotBlocked(true);
    setSecurityWarning(warningText);

    // Immediately blank canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }

    if (videoRef.current) {
      videoRef.current.pause();
    }

    // Overwrite clipboard to destroy any captured bitmap buffer
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText('').catch(() => {});
    }

    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    warningTimerRef.current = setTimeout(() => {
      setScreenshotBlocked(false);
      setSecurityWarning(null);
    }, 3500);
  }, []);

  // Mark viewed once recipient opens or closes
  const markViewedOnce = useCallback(() => {
    if (isMine) return; // Sender preview never consumes view limit or marks viewed!
    if (!hasMarkedViewed) {
      setHasMarkedViewed(true);
      if (onMarkViewed) onMarkViewed();
    }
  }, [isMine, hasMarkedViewed, onMarkViewed]);

  useEffect(() => {
    markViewedOnce();
  }, [markViewedOnce]);

  // Preload Image into offscreen buffer
  useEffect(() => {
    if (!message || !message.mediaUrl || isVideo) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = message.mediaUrl;
    img.onload = () => {
      imageObjRef.current = img;
      setImageLoaded(true);
    };
    img.onerror = () => {
      // Fallback without crossOrigin in case CDN restricts CORS
      const fallbackImg = new Image();
      fallbackImg.src = message.mediaUrl;
      fallbackImg.onload = () => {
        imageObjRef.current = fallbackImg;
        setImageLoaded(true);
      };
    };
  }, [message, isVideo]);

  // Clear canvas immediately
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Render photo onto HTML5 Canvas with security watermark
  const drawImageToCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageObjRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate max dimensions fitting screen
    const maxW = Math.min(window.innerWidth * 0.95, 960);
    const maxH = Math.min(window.innerHeight * 0.82, 850);

    let width = img.naturalWidth || 600;
    let height = img.naturalHeight || 400;

    const ratio = Math.min(maxW / width, maxH / height, 1);
    const renderW = Math.round(width * ratio);
    const renderH = Math.round(height * ratio);

    canvas.width = renderW;
    canvas.height = renderH;

    // Draw main image
    ctx.drawImage(img, 0, 0, renderW, renderH);

    // Draw subtle DRM diagonal anti-screenshot security watermark
    ctx.save();
    ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.textAlign = 'center';
    ctx.translate(renderW / 2, renderH / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.fillText('🔒 PULSECHAT • PROTECTED VIEW • DO NOT CAPTURE', 0, 0);
    ctx.fillText('CONFIDENTIAL & VIEW-RESTRICTED', 0, 30);
    ctx.restore();
  }, []);

  // Draw image or play video immediately when ready
  useEffect(() => {
    if (screenshotBlocked) {
      clearCanvas();
      if (videoRef.current) videoRef.current.pause();
      return;
    }

    if (isVideo) {
      if (videoRef.current) {
        videoRef.current.play().catch(() => {});
      }
      return;
    }

    if (imageLoaded) {
      const raf = requestAnimationFrame(() => {
        drawImageToCanvas();
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [imageLoaded, screenshotBlocked, isVideo, drawImageToCanvas, clearCanvas]);

  // Comprehensive Anti-Screenshot, Snipping Tool & Visibility Loss Interceptors
  useEffect(() => {
    // 1. Intercept PrintScreen and OS screenshot shortcuts
    const handleKeyIntercept = (e) => {
      const isPrintScreen =
        e.key === 'PrintScreen' ||
        e.code === 'PrintScreen' ||
        e.keyCode === 44 ||
        e.which === 44;

      const isSnippingOrSave =
        (e.metaKey && e.shiftKey) || // Mac screenshot or Windows Win+Shift+S
        (e.ctrlKey && (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S')) ||
        (e.altKey && isPrintScreen);

      if (isPrintScreen || isSnippingOrSave) {
        e.preventDefault();
        e.stopPropagation();
        triggerSecurityAlert("🚫 Screenshot shortcut blocked! View-Once media is protected.");
      }
    };

    // 2. Document Visibility Change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerSecurityAlert("⚠️ App switched or minimized! Screen capture is prohibited.");
      }
    };

    // 3. Page hide / Orientation / Resize
    const handlePageHide = () => {
      setIsHolding(false);
      clearCanvas();
    };

    // 4. Context Menu & Drag prevention
    const handleContextMenu = (e) => e.preventDefault();
    const handleCopy = (e) => {
      e.preventDefault();
      if (e.clipboardData) e.clipboardData.clearData();
    };

    window.addEventListener('keydown', handleKeyIntercept, { capture: true });
    window.addEventListener('keyup', handleKeyIntercept, { capture: true });
    document.addEventListener('keydown', handleKeyIntercept, { capture: true });
    document.addEventListener('keyup', handleKeyIntercept, { capture: true });

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);

    return () => {
      window.removeEventListener('keydown', handleKeyIntercept, { capture: true });
      window.removeEventListener('keyup', handleKeyIntercept, { capture: true });
      document.removeEventListener('keydown', handleKeyIntercept, { capture: true });
      document.removeEventListener('keyup', handleKeyIntercept, { capture: true });

      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    };
  }, [triggerSecurityAlert, clearCanvas]);

  const handleClose = () => {
    markViewedOnce();
    onClose();
  };

  if (!message || !message.mediaUrl) return null;

  const content = (
    <div
      className="view-once-modal-wrapper"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999999,
        background: '#000000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        overflow: 'hidden'
      }}
    >
      {/* CSS Print & Screen Recording Blocker */}
      <style>{`
        @media print {
          body, .view-once-modal-wrapper, * {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `}</style>

      {/* WhatsApp-Style Top Header Bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '62px',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0) 100%)',
          zIndex: 40
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#fff' }}>
          <button
            type="button"
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Back"
          >
            <ArrowLeft size={22} />
          </button>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#fff', lineHeight: 1.2 }}>
              {isMine ? 'You' : (senderName || 'Partner')}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.72)', marginTop: '2px' }}>
              {message?.isViewTwice ? 'Twice View' : (isVideo ? 'View Once video' : 'View Once photo')} • {formatLightboxDateTime(message.timestamp)}
            </span>
          </div>
        </div>

        {/* Right Header Protected Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: '#ffffff',
          fontSize: '0.82rem',
          fontWeight: 700,
          background: 'rgba(255, 255, 255, 0.14)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          padding: '6px 14px',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.18)'
        }}>
          <Lock size={14} color={isMine ? "#fbbf24" : (message?.isViewTwice ? "#38bdf8" : "#10b981")} />
          <span>{isMine ? 'Preview (Sender)' : (message?.isViewTwice ? 'Twice View (2x)' : 'View Once (1x)')}</span>
        </div>
      </div>

      {/* Security Warning Toast */}
      {securityWarning && (
        <div style={{
          position: 'absolute',
          top: '75px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(239, 68, 68, 0.96)',
          color: '#ffffff',
          padding: '10px 20px',
          borderRadius: '30px',
          fontSize: '0.85rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 50,
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.7)',
          animation: 'fadeIn 0.2s ease',
          textAlign: 'center',
          maxWidth: '90%'
        }}>
          <AlertOctagon size={20} color="#ffffff" />
          <span>{securityWarning}</span>
        </div>
      )}

      {/* Media Viewing Core Container (Full screen) */}
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        boxSizing: 'border-box'
      }}>
        {screenshotBlocked ? (
          /* High-Alert Security Blackout Shield */
          <div style={{
            width: '320px',
            padding: '2.5rem 1.5rem',
            background: '#111827',
            border: '2px solid #ef4444',
            borderRadius: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            textAlign: 'center',
            color: '#f87171',
            boxShadow: '0 10px 40px rgba(239, 68, 68, 0.25)'
          }}>
            <ShieldAlert size={48} color="#ef4444" />
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#fff' }}>Screenshot Blocked!</div>
            <div style={{ fontSize: '0.8rem', color: '#9ca3af', lineHeight: 1.5 }}>
              Screenshots and screen recording are strictly prohibited for privacy. Media is permanently protected.
            </div>
          </div>
        ) : (
          /* Full screen Protected Media */
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isVideo ? (
              <video
                ref={videoRef}
                src={message.mediaUrl}
                playsInline
                autoPlay
                controls
                draggable={false}
                style={{
                  maxWidth: '100vw',
                  maxHeight: '100vh',
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
            ) : (
              <div style={{ position: 'relative', maxWidth: '100vw', maxHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src={message.mediaUrl}
                  alt="Protected View"
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                  style={{
                    maxWidth: '100vw',
                    maxHeight: '100vh',
                    objectFit: 'contain',
                    display: 'block',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    pointerEvents: 'none'
                  }}
                  onLoad={() => setImageLoaded(true)}
                />
                {/* Subtle DRM Watermark overlay */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  transform: 'rotate(-25deg)',
                  opacity: 0.16,
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '1rem',
                  letterSpacing: '2px',
                  textAlign: 'center',
                  textShadow: '0 0 4px rgba(0,0,0,0.8)'
                }}>
                  🔒 PULSECHAT • PROTECTED VIEW • DO NOT CAPTURE
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* WhatsApp Bottom Bar with Reply & Emoji Reactions */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '14px 18px 22px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(0deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0) 100%)',
          gap: '14px',
          zIndex: 40
        }}
      >
        <button
          type="button"
          onClick={() => {
            handleClose();
            if (onReply) onReply(message);
          }}
          style={{
            flex: 1,
            maxWidth: '220px',
            background: 'rgba(30, 41, 59, 0.88)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: '24px',
            padding: '10px 18px',
            color: 'rgba(255, 255, 255, 0.85)',
            fontSize: '0.94rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer'
          }}
        >
          <CornerUpLeft size={16} color="#38bdf8" />
          <span>Reply</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => onReact && onReact('❤️')}
            style={{ background: 'none', border: 'none', fontSize: '1.65rem', cursor: 'pointer', padding: 0, lineHeight: 1 }}
          >
            ❤️
          </button>
          <button
            type="button"
            onClick={() => onReact && onReact('😂')}
            style={{ background: 'none', border: 'none', fontSize: '1.65rem', cursor: 'pointer', padding: 0, lineHeight: 1 }}
          >
            😂
          </button>
          <button
            type="button"
            onClick={() => {
              if (onOpenUnlimitedEmoji) {
                handleClose();
                onOpenUnlimitedEmoji(message);
              } else if (onReact) {
                onReact('👍');
              }
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title="Reactions"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}
