import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Flame, ShieldAlert, Sparkles, Lock, ArrowLeft, CornerUpLeft, Plus } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';
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

export default function FogSnapModal({
  message,
  chatId,
  senderName,
  isMine,
  currentUserId,
  currentUserName,
  onRevealed,
  onBurned,
  onReply,
  onReact,
  onOpenUnlimitedEmoji,
  onClose,
  socket
}) {
  const [timeLeft, setTimeLeft] = useState(message?.fogSnapDuration || 10);
  const [screenshotAlerted, setScreenshotAlerted] = useState(false);
  const [isBurned, setIsBurned] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const imgRef = useRef(null);
  const timerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const burnedRef = useRef(false);

  const duration = message?.fogSnapDuration || 10;
  const token = localStorage.getItem('pulsechat_token');
  const targetMediaUrl = message?.mediaUrl || (Array.isArray(message?.mediaUrls) && message?.mediaUrls[0]) || '';

  // Web audio sizzle / dissolve sound
  const playSizzle = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const bufferSize = ctx.sampleRate * 0.2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 2200;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
    } catch (e) {}
  }, []);

  const handleBurn = useCallback(() => {
    if (isMine) {
      onClose();
      return;
    }
    if (burnedRef.current) return;
    burnedRef.current = true;
    setIsBurned(true);
    playSizzle();

    const msgId = message?.id || message?._id;
    try {
      if (message?.id) localStorage.setItem(`pulse_fog_burned_${message.id}`, 'true');
      if (message?._id) localStorage.setItem(`pulse_fog_burned_${message._id}`, 'true');
    } catch (e) {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pulsechat_fog_snap_burned', {
        detail: { messageId: msgId, chatId }
      }));
      window.dispatchEvent(new CustomEvent('pulsechat_stealth_dust_dissolved', {
        detail: { messageId: msgId, chatId }
      }));
    }

    if (socket) {
      socket.emit('burn_fog_snap', { messageId: msgId, chatId });
    }

    fetch(`${BACKEND_URL}/api/messages/fog-snap/burn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messageId: msgId, chatId })
    }).catch(() => {});

    if (onBurned) onBurned(msgId);

    setTimeout(() => {
      onClose();
    }, 450);
  }, [isMine, message, chatId, socket, token, onBurned, onClose, playSizzle]);

  useBackHandler(() => {
    if (!isMine) {
      handleBurn();
    } else {
      onClose();
    }
  }, true);

  // 10-Second Countdown Timer (Recipient only)
  useEffect(() => {
    if (isMine) return; // Sender preview does not trigger burn countdown
    if (burnedRef.current) return;

    if (onRevealed) onRevealed();

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleBurn();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isMine, handleBurn, onRevealed]);

  const handleCloseClick = () => {
    if (!isMine) {
      handleBurn();
    } else {
      onClose();
    }
  };

  // Keyboard shortcut & screenshot interceptors
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'PrintScreen' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
        setScreenshotAlerted(true);
        setTimeout(() => setScreenshotAlerted(false), 3000);
      }
    };
    window.addEventListener('keyup', handleKeyDown);
    return () => window.removeEventListener('keyup', handleKeyDown);
  }, []);

  if (!message || !targetMediaUrl) return null;

  const content = (
    <div
      className="fog-snap-modal-wrapper"
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
        overflow: 'hidden'
      }}
    >
      {/* Top 10-Second Countdown Progress Bar (Recipient only) */}
      {!isMine && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'rgba(255, 255, 255, 0.15)',
            zIndex: 60
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${(timeLeft / duration) * 100}%`,
              background: timeLeft <= 3
                ? 'linear-gradient(90deg, #ef4444, #f97316)'
                : 'linear-gradient(90deg, #f59e0b, #eab308)',
              transition: 'width 1s linear',
              boxShadow: '0 0 10px rgba(245, 158, 11, 0.8)'
            }}
          />
        </div>
      )}

      {/* WhatsApp-Style Top Header Bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '64px',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0) 100%)',
          zIndex: 50
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#fff' }}>
          <button
            type="button"
            onClick={handleCloseClick}
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
            <span style={{ fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.72)', marginTop: '2px' }}>
              Dust Image • {formatLightboxDateTime(message.timestamp)}
            </span>
          </div>
        </div>

        {/* 10-Second Fuse Badge / Sender Preview Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: isMine
              ? 'rgba(255, 255, 255, 0.15)'
              : (timeLeft <= 3 ? 'rgba(239, 68, 68, 0.28)' : 'rgba(245, 158, 11, 0.25)'),
            border: `1.5px solid ${isMine ? 'rgba(255, 255, 255, 0.25)' : (timeLeft <= 3 ? '#ef4444' : '#f59e0b')}`,
            color: '#fff',
            padding: '6px 14px',
            borderRadius: '24px',
            fontSize: '0.86rem',
            fontWeight: 800,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            boxShadow: isMine ? 'none' : '0 0 16px rgba(245, 158, 11, 0.35)'
          }}
        >
          {isMine ? (
            <>
              <Lock size={14} color="#fbbf24" />
              <span>Preview (Sender)</span>
            </>
          ) : (
            <>
              <Flame size={16} color={timeLeft <= 3 ? '#ef4444' : '#f59e0b'} />
              <span>{timeLeft}s</span>
            </>
          )}
        </div>
      </div>

      {/* Main Photo Container */}
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px',
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {!imgLoaded && !imgError && (
          <div
            style={{
              position: 'absolute',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              color: 'rgba(255, 255, 255, 0.7)'
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                border: '3px solid rgba(245, 158, 11, 0.25)',
                borderTopColor: '#f59e0b',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }}
            />
            <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>Loading photo...</span>
          </div>
        )}

        {imgError ? (
          <div
            style={{
              textAlign: 'center',
              color: 'rgba(255, 255, 255, 0.7)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <span style={{ fontSize: '2rem' }}>⚠️</span>
            <span>Could not load image</span>
            <button
              onClick={handleCloseClick}
              style={{
                padding: '6px 16px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.15)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <div
            style={{
              position: 'relative',
              maxWidth: '100vw',
              maxHeight: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              filter: isBurned ? 'blur(25px) contrast(200%)' : 'none',
              opacity: isBurned ? 0 : (imgLoaded ? 1 : 0),
              transition: 'all 0.35s ease'
            }}
          >
            <img
              ref={imgRef}
              src={targetMediaUrl}
              alt="Dust Image"
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              onLoad={() => setImgLoaded(true)}
              onError={() => {
                setImgError(true);
                setImgLoaded(true);
              }}
              style={{
                maxWidth: '100vw',
                maxHeight: '100vh',
                objectFit: 'contain',
                display: 'block',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                pointerEvents: 'none'
              }}
            />

            {/* Subtle Protected Overlay Watermark */}
            <div
              style={{
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
              }}
            >
              🔒 PULSECHAT • DUST IMAGE • AUTO-EVAPORATES
            </div>
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
          zIndex: 50
        }}
      >
        <button
          type="button"
          onClick={() => {
            handleCloseClick();
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
                handleCloseClick();
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

      {/* Burn Status Notification */}
      {isBurned && (
        <div
          style={{
            position: 'absolute',
            bottom: '80px',
            color: '#f59e0b',
            fontWeight: 800,
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(0,0,0,0.85)',
            padding: '8px 18px',
            borderRadius: '20px',
            zIndex: 60,
            boxShadow: '0 4px 20px rgba(0,0,0,0.6)'
          }}
        >
          🌫️ Dust Image evaporated on both sides!
        </div>
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}
