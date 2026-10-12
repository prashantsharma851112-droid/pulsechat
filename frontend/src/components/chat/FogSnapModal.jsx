import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Flame, ShieldAlert, Sparkles, Lock, AlertTriangle, ArrowLeft, CornerUpLeft, Plus } from 'lucide-react';
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
  onClose
}) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(message?.fogSnapDuration || 7);
  const [screenshotAlerted, setScreenshotAlerted] = useState(false);
  const [isBurned, setIsBurned] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const isScratchingRef = useRef(false);
  const timerRef = useRef(null);
  const audioCtxRef = useRef(null);

  useBackHandler(() => {
    if (!isMine && isRevealed) {
      handleBurn();
    } else {
      onClose();
    }
  }, true);

  const duration = message?.fogSnapDuration || 7;
  const token = localStorage.getItem('pulsechat_token');

  // Simple web audio sizzle sound
  const playSizzle = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const bufferSize = ctx.sampleRate * 0.15;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 2500;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
    } catch (e) {}
  };

  // Pre-draw Frosted Fog Mist over Canvas
  const initCanvasFog = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Frosted dark slate fog gradient
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#1e293b');
    grad.addColorStop(0.5, '#0f172a');
    grad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Frosted mist noise particles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let i = 0; i < 600; i++) {
      ctx.fillRect(Math.random() * w, Math.random() * h, Math.random() * 4 + 1, Math.random() * 4 + 1);
    }

    // Glowing Secret Dust Image Title & Instruction
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✨ SCRATCH DUST IMAGE', w / 2, h / 2 - 25);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Scratch smoothly with your finger to reveal!', w / 2, h / 2 + 10);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('🔒 Protected Media • Auto-destructs after reveal', w / 2, h / 2 + 35);
  }, []);

  const lastPosRef = useRef({ x: null, y: null });

  // Calculate Cleared Percentage
  const checkScratchPercentage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || isRevealed) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      let transparentPixels = 0;
      const totalPixels = data.length / 4;
      // Sample every 16th pixel for speed
      for (let i = 3; i < data.length; i += 16) {
        if (data[i] < 128) transparentPixels++;
      }

      const ratio = transparentPixels / (totalPixels / 4);
      if (ratio > 0.42) {
        // More than 42% scratched: Fully Reveal & Start Countdown!
        setIsRevealed(true);
        // Wipe remaining canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!isMine) {
          if (onRevealed) onRevealed();

          // Notify backend that fog snap was revealed (Recipient only!)
          fetch(`${BACKEND_URL}/api/messages/fog-snap/reveal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ messageId: message.id, chatId })
          }).catch(() => {});
        }
      }
    } catch (e) {}
  }, [isRevealed, message, chatId, onRevealed, token]);

  // Scratch Action Handler (Buttery Smooth continuous stroke)
  const handleScratch = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas || isRevealed) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 64;

    ctx.beginPath();
    if (lastPosRef.current.x !== null && lastPosRef.current.y !== null) {
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      ctx.arc(x, y, 32, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    lastPosRef.current = { x, y };

    playSizzle();
    checkScratchPercentage();
  }, [isRevealed, checkScratchPercentage]);

  // Mouse & Touch events
  const onMouseDown = (e) => {
    isScratchingRef.current = true;
    lastPosRef.current = { x: null, y: null };
    handleScratch(e.clientX, e.clientY);
  };
  const onMouseMove = (e) => {
    if (isScratchingRef.current) handleScratch(e.clientX, e.clientY);
  };
  const onMouseUp = () => {
    isScratchingRef.current = false;
    lastPosRef.current = { x: null, y: null };
  };

  const onTouchStart = (e) => {
    if (e.touches && e.touches.length > 0) {
      isScratchingRef.current = true;
      lastPosRef.current = { x: null, y: null };
      handleScratch(e.touches[0].clientX, e.touches[0].clientY);
    }
  };
  const onTouchMove = (e) => {
    if (isScratchingRef.current && e.touches && e.touches.length > 0) {
      handleScratch(e.touches[0].clientX, e.touches[0].clientY);
    }
  };
  const onTouchEnd = () => {
    isScratchingRef.current = false;
    lastPosRef.current = { x: null, y: null };
  };

  // Countdown Fuse once revealed (Recipient only!)
  useEffect(() => {
    if (isMine) return; // Sender preview never triggers auto-burn countdown
    if (!isRevealed || isBurned) return;

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
  }, [isRevealed, isBurned, isMine]);

  const handleBurn = () => {
    if (isMine) {
      onClose();
      return;
    }
    if (isBurned) return;
    setIsBurned(true);
    const msgId = message?.id || message?._id;
    try {
      if (message?.id) localStorage.setItem(`pulse_fog_burned_${message.id}`, 'true');
      if (message?._id) localStorage.setItem(`pulse_fog_burned_${message._id}`, 'true');
    } catch (e) {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pulsechat_fog_snap_burned', {
        detail: { messageId: msgId, chatId }
      }));
    }

    fetch(`${BACKEND_URL}/api/messages/fog-snap/burn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messageId: msgId, chatId })
    }).catch(() => {});

    if (onBurned) onBurned(msgId);

    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleCloseClick = () => {
    if (!isMine && isRevealed) {
      handleBurn();
    } else {
      onClose();
    }
  };

  // Screenshot Detection Guard
  const reportScreenshot = useCallback(() => {
    if (isMine) return; // Sender previewing never triggers screenshot alert
    setScreenshotAlerted(true);
    fetch(`${BACKEND_URL}/api/messages/fog-snap/screenshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messageId: message.id, chatId })
    }).catch(() => {});

    setTimeout(() => setScreenshotAlerted(false), 3000);
  }, [message, chatId, token]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'PrintScreen' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
        reportScreenshot();
      }
    };
    const handleVisibility = () => {
      if (document.hidden) {
        reportScreenshot();
      }
    };

    window.addEventListener('keyup', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('keyup', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [reportScreenshot]);

  const content = (
    <div
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
        overflow: 'hidden'
      }}
    >
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
            <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.72)', marginTop: '2px' }}>
              ✨ Dust Image • {formatLightboxDateTime(message.timestamp)}
            </span>
          </div>
        </div>

        {/* Right Header Status / Countdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isMine ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(245, 158, 11, 0.2)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: '20px',
                padding: '6px 14px',
                color: '#fbbf24',
                fontWeight: 800,
                fontSize: '0.82rem'
              }}
            >
              <Sparkles size={15} />
              <span>Preview (Sender)</span>
            </div>
          ) : isRevealed ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(239, 68, 68, 0.25)',
                border: '1.5px solid #ef4444',
                borderRadius: '20px',
                padding: '6px 14px',
                color: '#ef4444',
                fontWeight: 900,
                fontSize: '0.86rem',
                animation: 'pulse 0.5s infinite alternate'
              }}
            >
              <Flame size={16} />
              <span>Evaporating in {timeLeft}s</span>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(245, 158, 11, 0.2)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: '20px',
                padding: '6px 14px',
                color: '#fbbf24',
                fontWeight: 800,
                fontSize: '0.82rem'
              }}
            >
              <Sparkles size={15} />
              <span>Scratch to reveal</span>
            </div>
          )}
        </div>
      </div>

      {/* Screenshot Flash Alert */}
      {screenshotAlerted && (
        <div
          style={{
            position: 'absolute',
            top: '75px',
            zIndex: 60,
            background: '#ef4444',
            color: '#fff',
            borderRadius: '16px',
            padding: '10px 22px',
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 0 30px rgba(239, 68, 68, 0.9)'
          }}
        >
          <AlertTriangle size={20} />
          <span>SCREENSHOT DETECTED! SENDER WAS ALERTED!</span>
        </div>
      )}

      {/* Full screen Main Media Container */}
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
        <div
          style={{
            position: 'relative',
            maxWidth: '100vw',
            maxHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            filter: isBurned ? 'blur(20px) contrast(200%)' : 'none',
            opacity: isBurned ? 0 : 1,
            transition: 'all 0.3s ease'
          }}
        >
          {/* Underlying Photo */}
          <img
            ref={imgRef}
            src={message?.mediaUrl}
            alt="Secret Dust Image"
            onLoad={() => {
              setImgLoaded(true);
              if (imgRef.current && canvasRef.current) {
                const rect = imgRef.current.getBoundingClientRect();
                if (rect.width && rect.height) {
                  canvasRef.current.width = rect.width;
                  canvasRef.current.height = rect.height;
                }
              }
              setTimeout(initCanvasFog, 50);
            }}
            style={{
              maxWidth: '100vw',
              maxHeight: '100vh',
              objectFit: 'contain',
              display: 'block'
            }}
          />

          {/* Scratchable Dust Mist Canvas Overlay */}
          <canvas
            ref={canvasRef}
            width={480}
            height={720}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              cursor: isRevealed ? 'default' : 'pointer',
              touchAction: 'none'
            }}
          />
        </div>
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

      {/* Bottom Burn Status Notification */}
      {isBurned && (
        <div
          style={{
            position: 'absolute',
            bottom: '80px',
            color: '#ef4444',
            fontWeight: 800,
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(0,0,0,0.85)',
            padding: '8px 18px',
            borderRadius: '20px',
            zIndex: 60
          }}
        >
          🌫️ Dust Image evaporated into digital smoke!
        </div>
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}
