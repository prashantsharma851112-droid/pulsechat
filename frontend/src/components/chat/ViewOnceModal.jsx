import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Lock, ShieldAlert, Eye, Fingerprint, AlertOctagon } from 'lucide-react';

export default function ViewOnceModal({ message, onMarkViewed, onClose }) {
  const [isHolding, setIsHolding] = useState(false);
  const [hasMarkedViewed, setHasMarkedViewed] = useState(false);
  const [screenshotBlocked, setScreenshotBlocked] = useState(false);
  const [securityWarning, setSecurityWarning] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const canvasRef = useRef(null);
  const imageObjRef = useRef(null);
  const videoRef = useRef(null);
  const warningTimerRef = useRef(null);

  const isVideo = message?.type === 'video';

  const triggerSecurityAlert = useCallback((warningText) => {
    setIsHolding(false);
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
  }, [message, isVideo]);

  // Mark viewed once user holds to reveal or closes
  const markViewedOnce = useCallback(() => {
    if (!hasMarkedViewed) {
      setHasMarkedViewed(true);
      if (onMarkViewed) onMarkViewed();
    }
  }, [hasMarkedViewed, onMarkViewed]);

  // Render photo onto HTML5 Canvas with security watermark
  const drawImageToCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageObjRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate max dimensions fitting screen
    const maxW = Math.min(window.innerWidth * 0.9, 800);
    const maxH = Math.min(window.innerHeight * 0.8, 700);

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
    ctx.fillText('🔒 PULSECHAT • PROTECTED VIEW ONCE • DO NOT CAPTURE', 0, 0);
    ctx.fillText('CONFIDENTIAL & VIEW-ONCE RESTRICTED', 0, 30);
    ctx.restore();
  }, []);

  // Clear canvas immediately
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Update canvas rendering when isHolding changes
  useEffect(() => {
    if (isVideo) {
      if (videoRef.current) {
        if (isHolding && !screenshotBlocked) {
          videoRef.current.play().catch(() => {});
          markViewedOnce();
        } else {
          videoRef.current.pause();
        }
      }
      return;
    }

    if (isHolding && !screenshotBlocked) {
      drawImageToCanvas();
      markViewedOnce();
    } else {
      clearCanvas();
    }
  }, [isHolding, screenshotBlocked, isVideo, drawImageToCanvas, clearCanvas, markViewedOnce]);

  // Comprehensive Anti-Screenshot, Snipping Tool & Visibility Loss Interceptors
  useEffect(() => {
    // 1. Intercept PrintScreen and OS screenshot shortcuts (Win+Shift+S, PrtScn, Cmd+Shift+3/4/5)
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

    // Listen in Capture phase on both window and document for absolute priority
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

  // Touch & Pointer Handlers (Hold-to-Reveal)
  const handlePointerDown = (e) => {
    if (screenshotBlocked) return;

    // Reject multi-touch on mobile (used by phone hardware screenshot combos or gestures)
    if (e.touches && e.touches.length > 1) {
      triggerSecurityAlert("⚠️ Multi-touch screenshot gesture detected! Media hidden.");
      return;
    }

    setIsHolding(true);
  };

  const handlePointerUp = () => {
    setIsHolding(false);
    clearCanvas();
  };

  const handleTouchStart = (e) => {
    if (e.touches && e.touches.length > 1) {
      triggerSecurityAlert("⚠️ Multi-touch screenshot gesture detected! Media hidden.");
      return;
    }
    if (!screenshotBlocked) {
      setIsHolding(true);
    }
  };

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
          <span>View Once Protected {isVideo ? 'Video' : 'Photo'}</span>
        </div>

        <button
          onClick={handleClose}
          className="icon-btn-ghost"
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            color: '#ffffff',
            padding: '10px',
            borderRadius: '50%'
          }}
          title="Close"
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

      {/* Media Viewing Core Container */}
      <div style={{
        maxWidth: '92vw',
        maxHeight: '76vh',
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
        ) : isHolding ? (
          /* ACTIVE HOLDING STATE: Media is revealed */
          <div style={{ position: 'relative', display: 'inline-block' }}>
            {isVideo ? (
              <video
                ref={videoRef}
                src={message.mediaUrl}
                playsInline
                autoPlay
                controls={false}
                draggable={false}
                style={{
                  maxWidth: '90vw',
                  maxHeight: '75vh',
                  borderRadius: '14px',
                  pointerEvents: 'none',
                  display: 'block'
                }}
              />
            ) : (
              <canvas
                ref={canvasRef}
                style={{
                  maxWidth: '90vw',
                  maxHeight: '75vh',
                  borderRadius: '14px',
                  pointerEvents: 'none',
                  display: 'block',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.8)'
                }}
              />
            )}
          </div>
        ) : (
          /* IDLE / SECURED STATE: Locked privacy shield */
          <div style={{
            width: '320px',
            padding: '2.5rem 1.5rem',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            textAlign: 'center'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Lock size={32} color="#10b981" />
            </div>

            <div>
              <h3 style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 700, margin: '0 0 6px 0' }}>
                Protected View-Once Media
              </h3>
              <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: 0, lineHeight: 1.5 }}>
                Screenshots, screen recording, and saving are blocked. Media disappears when you release.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Press-and-Hold Touchpad / Button at Bottom */}
      <div style={{
        position: 'absolute',
        bottom: '36px',
        left: '20px',
        right: '20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        zIndex: 40
      }}>
        <button
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onTouchStart={handleTouchStart}
          onTouchEnd={handlePointerUp}
          onTouchCancel={handlePointerUp}
          onMouseDown={handlePointerDown}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          style={{
            width: '100%',
            maxWidth: '360px',
            padding: '16px 24px',
            borderRadius: '16px',
            background: isHolding
              ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
              : 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
            color: '#ffffff',
            border: 'none',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: isHolding
              ? '0 0 25px rgba(16, 185, 129, 0.6)'
              : '0 8px 25px rgba(99, 102, 241, 0.4)',
            transform: isHolding ? 'scale(0.98)' : 'scale(1)',
            transition: 'all 0.15s ease',
            touchAction: 'none'
          }}
        >
          {isHolding ? (
            <>
              <Eye size={22} />
              <span>Viewing... (Keep Holding)</span>
            </>
          ) : (
            <>
              <Fingerprint size={24} />
              <span>👆 Press & Hold to View</span>
            </>
          )}
        </button>

        <span style={{ fontSize: '0.74rem', color: '#6b7280', textAlign: 'center' }}>
          {isHolding
            ? 'Release finger / mouse to hide immediately'
            : 'Hold button with single finger to reveal photo • Screenshots blocked'}
        </span>
      </div>
    </div>
  );
}
