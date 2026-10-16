import React, { useState, useEffect, useCallback, useRef } from 'react';

export default function EmojiParticleBurst() {
  const [particles, setParticles] = useState([]);
  const idCounterRef = useRef(0);

  const removeParticle = useCallback((id) => {
    setParticles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  useEffect(() => {
    const handleTriggerBurst = (e) => {
      const mode = e.detail?.mode || (e.detail?.duration === 5 ? 'burst' : 'reaction');
      const mainEmoji = e.detail?.emoji || '❤️';

      const newBatch = [];
      const now = Date.now();

      if (mode === 'reaction') {
        // Floating Aura Reaction Emojis (Instagram/WhatsApp style - 7 smooth floating particles)
        const reactCount = 7;
        const accentHearts = ['💗', '💖', '💕'];

        for (let i = 0; i < reactCount; i++) {
          idCounterRef.current += 1;
          const pId = `react_${now}_${idCounterRef.current}_${i}`;
          const isAccent = (i % 3 === 0 && mainEmoji === '❤️');
          const emojiToUse = isAccent ? accentHearts[i % accentHearts.length] : mainEmoji;

          // Natural staggered horizontal distribution across chat screen
          const leftPct = 15 + Math.random() * 70; // 15% - 85%
          const bottomPct = 18 + Math.random() * 22; // 18% - 40%
          const sizePx = 34 + Math.random() * 16; // 34px - 50px
          const duration = 1.9 + Math.random() * 0.5; // 1.9s - 2.4s
          const delay = (i * 0.055) + Math.random() * 0.04; // 0s - 0.4s
          const sway1 = (Math.random() - 0.5) * 36;
          const sway2 = -sway1 * (0.8 + Math.random() * 0.4);

          newBatch.push({
            id: pId,
            mode: 'reaction',
            emoji: emojiToUse,
            leftPct,
            bottomPct,
            sizePx,
            duration,
            delay,
            sway1,
            sway2
          });
        }
      } else {
        // 3D Fireworks & Fountain Burst (12 vibrant particles shooting upward)
        const burstCount = 12;
        const sparkAccents = ['✨', '🌟', '💥'];

        for (let i = 0; i < burstCount; i++) {
          idCounterRef.current += 1;
          const pId = `burst_${now}_${idCounterRef.current}_${i}`;
          const isSpark = (i % 4 === 0);
          const emojiToUse = isSpark ? sparkAccents[i % sparkAccents.length] : mainEmoji;

          const angle = (Math.PI * 2 * i) / burstCount + (Math.random() - 0.5) * 0.3;
          const radiusX = 90 + Math.random() * 90;
          const radiusY = 160 + Math.random() * 140;
          const dx = Math.cos(angle) * radiusX;
          const dy = -Math.abs(Math.sin(angle) * radiusY) - 80;
          const rotMid = (Math.random() - 0.5) * 120;
          const rotEnd = (Math.random() - 0.5) * 240;
          const sizePx = 30 + Math.random() * 16;
          const duration = 2.1 + Math.random() * 0.5;
          const delay = (i * 0.035);

          newBatch.push({
            id: pId,
            mode: 'burst',
            emoji: emojiToUse,
            dx,
            dy,
            rotMid,
            rotEnd,
            sizePx,
            duration,
            delay
          });
        }
      }

      setParticles((prev) => {
        // Keep at most 24 active particles at once to guarantee 60-120fps performance
        const combined = [...prev, ...newBatch];
        return combined.slice(-24);
      });
    };

    window.addEventListener('pulsechat_trigger_emoji_burst', handleTriggerBurst);
    return () => {
      window.removeEventListener('pulsechat_trigger_emoji_burst', handleTriggerBurst);
    };
  }, []);

  if (particles.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes pulseFloatingReactionGpu {
          0% {
            transform: translate3d(0, 0, 0) scale(0.35);
            opacity: 0;
          }
          15% {
            transform: translate3d(var(--sway1, 10px), -60px, 0) scale(1.18);
            opacity: 0.98;
          }
          45% {
            transform: translate3d(var(--sway2, -10px), -210px, 0) scale(1.02);
            opacity: 0.92;
          }
          75% {
            transform: translate3d(var(--sway1, 10px), -360px, 0) scale(0.96);
            opacity: 0.75;
          }
          100% {
            transform: translate3d(var(--sway2, -10px), -500px, 0) scale(0.8);
            opacity: 0;
          }
        }

        @keyframes pulseBurstFountainGpu {
          0% {
            transform: translate3d(0, 0, 0) scale(0.3) rotate(0deg);
            opacity: 0;
          }
          18% {
            transform: translate3d(calc(var(--dx) * 0.45), calc(var(--dy) * 0.7), 0) scale(1.25) rotate(var(--rot-mid, 30deg));
            opacity: 1;
          }
          65% {
            transform: translate3d(calc(var(--dx) * 0.85), calc(var(--dy) * 1.05 + 60px), 0) scale(1) rotate(var(--rot-end, 60deg));
            opacity: 0.88;
          }
          100% {
            transform: translate3d(var(--dx), calc(var(--dy) * 1.1 + 190px), 0) scale(0.65) rotate(calc(var(--rot-end, 60deg) * 1.3));
            opacity: 0;
          }
        }
      `}</style>

      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 99999,
          overflow: 'hidden'
        }}
        aria-hidden="true"
      >
        {particles.map((p) => {
          if (p.mode === 'reaction') {
            return (
              <div
                key={p.id}
                onAnimationEnd={() => removeParticle(p.id)}
                style={{
                  position: 'absolute',
                  left: `${p.leftPct}%`,
                  bottom: `${p.bottomPct}%`,
                  fontSize: `${p.sizePx}px`,
                  lineHeight: 1,
                  userSelect: 'none',
                  pointerEvents: 'none',
                  filter: 'drop-shadow(0 0 12px rgba(236, 72, 153, 0.45)) drop-shadow(0 4px 10px rgba(0, 0, 0, 0.35))',
                  animation: `pulseFloatingReactionGpu ${p.duration}s cubic-bezier(0.22, 1, 0.36, 1) ${p.delay}s forwards`,
                  willChange: 'transform, opacity',
                  '--sway1': `${p.sway1}px`,
                  '--sway2': `${p.sway2}px`
                }}
              >
                {p.emoji}
              </div>
            );
          }

          return (
            <div
              key={p.id}
              onAnimationEnd={() => removeParticle(p.id)}
              style={{
                position: 'absolute',
                left: '50%',
                top: '68%',
                fontSize: `${p.sizePx}px`,
                lineHeight: 1,
                userSelect: 'none',
                pointerEvents: 'none',
                filter: 'drop-shadow(0 0 14px rgba(245, 158, 11, 0.55)) drop-shadow(0 4px 12px rgba(0, 0, 0, 0.4))',
                animation: `pulseBurstFountainGpu ${p.duration}s cubic-bezier(0.18, 0.89, 0.32, 1.15) ${p.delay}s forwards`,
                willChange: 'transform, opacity',
                '--dx': `${p.dx}px`,
                '--dy': `${p.dy}px`,
                '--rot-mid': `${p.rotMid}deg`,
                '--rot-end': `${p.rotEnd}deg`
              }}
            >
              {p.emoji}
            </div>
          );
        })}
      </div>
    </>
  );
}
