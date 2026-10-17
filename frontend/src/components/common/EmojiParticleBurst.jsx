import React, { useState, useEffect, useRef } from 'react';
import { Heart } from 'lucide-react';

export default function EmojiParticleBurst() {
  const [activePopup, setActivePopup] = useState(null);
  const popupTimerRef = useRef(null);
  const lastPopupTimeRef = useRef(0);

  const canvasRef = useRef(null);
  const animFrameIdRef = useRef(null);

  const startEmojiRain = (emoji = '🔥', durationMs = 7000) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
    }

    const width = (canvas.width = window.innerWidth);
    const height = (canvas.height = window.innerHeight);

    const count = Math.min(60, Math.max(40, Math.floor(width / 8)));
    const particles = [];

    for (let i = 0; i < count; i++) {
      // 45% start immediately in the viewport, rest shower from above
      const startY = i < count * 0.45
        ? Math.random() * (height * 0.75)
        : -Math.random() * height * 0.8 - 30;

      particles.push({
        x: Math.random() * width,
        y: startY,
        vy: Math.random() * 3.5 + 3.5,
        vx: (Math.random() - 0.5) * 1.5,
        size: Math.floor(Math.random() * 16 + 28),
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.04
      });
    }

    const startTime = performance.now();
    const duration = durationMs || 7000; // 7 seconds
    const fadeStart = Math.max(0, duration - 1000);

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      if (elapsed >= duration) {
        ctx.clearRect(0, 0, width, height);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Smooth fade-out blend during the final 1000ms
      let alpha = 1;
      if (elapsed > fadeStart) {
        alpha = Math.max(0, 1 - (elapsed - fadeStart) / (duration - fadeStart));
      }
      ctx.globalAlpha = alpha;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.y += p.vy;
        p.x += p.vx;
        p.rotation += p.rotSpeed;

        // Loop back to top until fade starts to maintain continuous rain
        if (p.y > height + 40 && elapsed < fadeStart) {
          p.y = -40;
          p.x = Math.random() * width;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.font = `${p.size}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
        ctx.fillText(emoji, 0, 0);
        ctx.restore();
      }

      ctx.globalAlpha = 1;
      animFrameIdRef.current = requestAnimationFrame(animate);
    };

    animFrameIdRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    const handleTriggerBurst = (e) => {
      const detail = e.detail || {};
      const emoji = detail.emoji || '❤️';
      const isBurst = detail.mode === 'burst';

      if (isBurst) {
        // 7-second Falling Emoji Rain (Barsaat) with smooth fade-out
        const dur = (detail.duration ? detail.duration * 1000 : 7000);
        startEmojiRain(emoji, dur);
        return;
      }

      // Single centered Instagram-story popup for message reactions
      const now = Date.now();
      if (now - lastPopupTimeRef.current < 800) {
        return;
      }
      lastPopupTimeRef.current = now;

      const pId = `pop_${now}`;
      if (popupTimerRef.current) {
        clearTimeout(popupTimerRef.current);
      }

      setActivePopup({ id: pId, emoji });
      popupTimerRef.current = setTimeout(() => {
        setActivePopup(null);
      }, 820);
    };

    window.addEventListener('pulsechat_trigger_emoji_burst', handleTriggerBurst);
    return () => {
      window.removeEventListener('pulsechat_trigger_emoji_burst', handleTriggerBurst);
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, []);

  return (
    <>
      {/* 60 FPS Ultra-Smooth Canvas for 3-Second Emoji Rain */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 99998,
          pointerEvents: 'none',
          userSelect: 'none'
        }}
      />

      {/* Centered Instagram-Story Style Message Reaction Popup */}
      {activePopup && (
        <>
          <style>{`
            @keyframes instaStoryReactionPop {
              0% {
                transform: translate3d(-50%, -50%, 0) scale(0) rotate(-16deg);
                opacity: 0;
              }
              35% {
                transform: translate3d(-50%, -50%, 0) scale(1.36) rotate(0deg);
                opacity: 1;
              }
              65% {
                transform: translate3d(-50%, -50%, 0) scale(1.12) rotate(6deg);
                opacity: 1;
              }
              100% {
                transform: translate3d(-50%, -50%, 0) scale(0.85) translateY(-46px);
                opacity: 0;
              }
            }
          `}</style>

          <div
            key={activePopup.id}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate3d(-50%, -50%, 0)',
              zIndex: 99999,
              pointerEvents: 'none',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'instaStoryReactionPop 0.82s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
              willChange: 'transform, opacity'
            }}
            aria-hidden="true"
          >
            {activePopup.emoji === '❤️' ? (
              <Heart
                size={115}
                fill="#ff2d55"
                color="#ffffff"
                strokeWidth={1.5}
                style={{
                  filter: 'drop-shadow(0 10px 36px rgba(255, 45, 85, 0.95)) drop-shadow(0 4px 14px rgba(0, 0, 0, 0.4))'
                }}
              />
            ) : (
              <span
                style={{
                  fontSize: '6.4rem',
                  lineHeight: 1,
                  display: 'inline-block',
                  filter: 'drop-shadow(0 10px 32px rgba(0, 0, 0, 0.45)) drop-shadow(0 0 24px rgba(236, 72, 153, 0.65))'
                }}
              >
                {activePopup.emoji}
              </span>
            )}
          </div>
        </>
      )}
    </>
  );
}
