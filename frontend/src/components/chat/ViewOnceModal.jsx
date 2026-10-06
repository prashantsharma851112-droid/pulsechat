import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Lock, ShieldAlert, Eye, AlertOctagon } from 'lucide-react';

export default function ViewOnceModal({ message, viewCount = 1, onMarkViewed, onClose }) {
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

  // Mark viewed once user opens or closes
  const markViewedOnce = useCallback(() => {
    if (!hasMarkedViewed) {
      setHasMarkedViewed(true);
      if (onMarkViewed) onMarkViewed();
    }
  }, [hasMarkedViewed, onMarkViewed]);

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

    // 2. Window Blur (triggers immediately when Windows Snipping Tool opens or app switches)
    const handleBlur = () => {
      triggerSecurityAlert("⚠️ Window lost focus (Screen capture / Snipping detected)! Media hidden.");
    };

    // 3. Document Visibility Change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerSecurityAlert("⚠️ App switched or minimized! Screen capture is prohibited.");
      }
    };

    // 4. Page hide / Orientation / Resize
    const handlePageHide = () => {
      setIsHolding(false);
      clearCanvas();
    };

    // 5. Context Menu & Drag prevention
    const handleContextMenu = (e) => e.preventDefault();
    const handleCopy = (e) => {
      e.preventDefault();
      if (e.clipboardData) e.clipboardData.clearData();
    };

    window.addEventListener('keydown', handleKeyIntercept, { capture: true });
    window.addEventListener('keyup', handleKeyIntercept, { capture: true });
    document.addEventListener('keydown', handleKeyIntercept, { capture: true });
    document.addEventListener('keyup', handleKeyIntercept, { capture: true });

    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);

    return () => {
      window.removeEventListener('keydown', handleKeyIntercept, { capture: true });
      window.removeEventListener('keyup', handleKeyIntercept, { capture: true });
      document.removeEventListener('keydown', handleKeyIntercept, { capture: true });
      document.removeEventListener('keyup', handleKeyIntercept, { capture: true });

      window.removeEventListener('blur', handleBlur);
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

  return (
    <div
      className="view-once-modal-wrapper incoming-call-overlay"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
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

      {/* Top Navigation Bar */}
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '16px',
        right: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 40
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#ffffff',
          fontSize: '0.88rem',
          fontWeight: 600,
          background: 'rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          padding: '6px 14px',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.15)'
        }}>
          <Lock size={15} color="#10b981" />
          <span>
            {message?.isViewTwice
              ? `Twice View (2x) Protected ${isVideo ? 'Video' : 'Photo'}`
              : `View Once (1x) Protected ${isVideo ? 'Video' : 'Photo'}`}
          </span>
        </div>

        <button
          onClick={handleClose}
          className="icon-btn-ghost"
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            color: '#ffffff',
            padding: '10px',
            borderRadius: '50%',
            cursor: 'pointer',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Close & Discard"
        >
          <X size={22} />
        </button>
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

      {/* Media Viewing Core Container (WhatsApp-Style Direct View) */}
      <div style={{
        maxWidth: '94vw',
        maxHeight: '78vh',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
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
          /* WhatsApp-Style Visible Protected Media */
          <div style={{ position: 'relative', display: 'inline-block' }}>
            {isVideo ? (
              <video
                ref={videoRef}
                src={message.mediaUrl}
                playsInline
                autoPlay
                controls
                draggable={false}
                style={{
                  maxWidth: '94vw',
                  maxHeight: '76vh',
                  borderRadius: '16px',
                  display: 'block',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.8)'
                }}
              />
            ) : !imageLoaded ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                color: '#9ca3af',
                padding: '40px'
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  border: '3px solid rgba(255,255,255,0.15)',
                  borderTopColor: '#6366f1',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <span style={{ fontSize: '0.85rem' }}>Loading protected media...</span>
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                style={{
                  maxWidth: '94vw',
                  maxHeight: '76vh',
                  borderRadius: '16px',
                  pointerEvents: 'none',
                  display: 'block',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.8)'
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* WhatsApp-Style Bottom Security Banner */}
      <div style={{
        position: 'absolute',
        bottom: '24px',
        left: '20px',
        right: '20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        zIndex: 40
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(17, 24, 39, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          padding: '10px 20px',
          borderRadius: '30px',
          color: '#ffffff',
          fontSize: '0.82rem',
          fontWeight: 600,
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)'
        }}>
          <Lock size={15} color="#10b981" />
          <span>
            {message?.isViewTwice
              ? 'Twice View • Closes and permanently expires after 2 views'
              : 'View Once • Closes and permanently expires once dismissed'}
          </span>
        </div>
      </div>
    </div>
  );
}
