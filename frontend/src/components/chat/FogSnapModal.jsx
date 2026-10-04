import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Flame, ShieldAlert, Sparkles, Lock, AlertTriangle } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';

export default function FogSnapModal({
  message,
  chatId,
  currentUserId,
  currentUserName,
  onRevealed,
  onBurned,
  onClose
}) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(message?.fogSnapDuration || 7);
  const [screenshotAlerted, setScreenshotAlerted] = useState(false);
  const [isBurned, setIsBurned] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const canvasRef = useRef(null);
  const isScratchingRef = useRef(false);
  const timerRef = useRef(null);
  const audioCtxRef = useRef(null);

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

    // Glowing Secret Fog Title & Instruction
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🌫️ SECRET FOG SNAP', w / 2, h / 2 - 25);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Scratch with your finger to reveal!', w / 2, h / 2 + 10);

    ctx.fillStyle = '#ef4444';
    ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('⚠️ Will evaporate after reveal. Screenshot guard active.', w / 2, h / 2 + 35);
  }, []);

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
      if (ratio > 0.45) {
        // More than 45% scratched: Fully Reveal & Start Countdown!
        setIsRevealed(true);
        // Wipe remaining canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (onRevealed) onRevealed();

        // Notify backend that fog snap was revealed
        fetch(`${BACKEND_URL}/api/messages/fog-snap/reveal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ messageId: message.id, chatId })
        }).catch(() => {});
      }
    } catch (e) {}
  }, [isRevealed, message, chatId, onRevealed, token]);

  // Scratch Action Handler
  const handleScratch = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas || isRevealed) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 38, 0, Math.PI * 2);
    ctx.fill();

    playSizzle();
    checkScratchPercentage();
  }, [isRevealed, checkScratchPercentage]);

  // Mouse & Touch events
  const onMouseDown = (e) => {
    isScratchingRef.current = true;
    handleScratch(e.clientX, e.clientY);
  };
  const onMouseMove = (e) => {
    if (isScratchingRef.current) handleScratch(e.clientX, e.clientY);
  };
  const onMouseUp = () => {
    isScratchingRef.current = false;
  };

  const onTouchStart = (e) => {
    if (e.touches && e.touches.length > 0) {
      isScratchingRef.current = true;
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
  };

  // Countdown Fuse once revealed
  useEffect(() => {
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
  }, [isRevealed, isBurned]);

  const handleBurn = () => {
    setIsBurned(true);
    fetch(`${BACKEND_URL}/api/messages/fog-snap/burn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messageId: message.id, chatId })
    }).catch(() => {});

    if (onBurned) onBurned(message.id);

    setTimeout(() => {
      onClose();
    }, 1200);
  };

  // Screenshot Detection Guard
  const reportScreenshot = useCallback(() => {
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

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      background: 'rgba(0, 0, 0, 0.94)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      userSelect: 'none'
    }}>
      {/* Top Header Bar */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        right: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 50
      }}>
        {/* Burning Fuse Timer */}
        {isRevealed ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(239, 68, 68, 0.25)',
            border: '1.5px solid #ef4444',
            borderRadius: '20px',
            padding: '6px 16px',
            color: '#ef4444',
            fontWeight: 900,
            fontSize: '0.95rem',
            animation: 'pulse 0.5s infinite alternate'
          }}>
            <Flame size={18} />
            <span>Evaporating in {timeLeft}s</span>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(245, 158, 11, 0.2)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '20px',
            padding: '6px 14px',
            color: '#fbbf24',
            fontWeight: 800,
            fontSize: '0.86rem'
          }}>
            <Sparkles size={16} />
            <span>Scratch with finger to reveal!</span>
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.12)',
            border: 'none',
            color: '#fff',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Screenshot Flash Alert */}
      {screenshotAlerted && (
        <div style={{
          position: 'absolute',
          top: '80px',
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
        }}>
          <AlertTriangle size={20} />
          <span>SCREENSHOT DETECTED! SENDER WAS ALERTED!</span>
        </div>
      )}

      {/* Main Snap Card Container */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '480px',
        maxHeight: '75vh',
        aspectRatio: '9 / 16',
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: isRevealed
          ? '0 0 40px rgba(239, 68, 68, 0.6), 0 25px 60px rgba(0,0,0,0.9)'
          : '0 0 30px rgba(245, 158, 11, 0.4), 0 25px 60px rgba(0,0,0,0.9)',
        border: isRevealed ? '2.5px solid #ef4444' : '2px solid rgba(245, 158, 11, 0.5)',
        transition: 'all 0.3s ease',
        filter: isBurned ? 'blur(15px) contrast(200%)' : 'none',
        opacity: isBurned ? 0 : 1
      }}>
        {/* Underlying Photo */}
        <img
          src={message?.mediaUrl}
          alt="Secret Fog Snap"
          onLoad={() => {
            setImgLoaded(true);
            setTimeout(initCanvasFog, 50);
          }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block'
          }}
        />

        {/* Scratchable Fog Mist Canvas Overlay */}
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

      {/* Bottom Burn Status */}
      {isBurned && (
        <div style={{
          position: 'absolute',
          bottom: '40px',
          color: '#9ca3af',
          fontWeight: 800,
          fontSize: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          🌫️ Fog Snap has evaporated into smoke!
        </div>
      )}
    </div>
  );
}
