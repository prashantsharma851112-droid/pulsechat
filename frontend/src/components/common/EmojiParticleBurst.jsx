import React, { useState, useEffect, useRef } from 'react';
import { Heart } from 'lucide-react';

export default function EmojiParticleBurst() {
  const [activePopup, setActivePopup] = useState(null);
  const timerRef = useRef(null);
  const lastTriggerTimeRef = useRef(0);

  useEffect(() => {
    const handleTriggerBurst = (e) => {
      const now = Date.now();
      // Enforce strictly 1 single popup: ignore duplicate calls within 500ms
      if (now - lastTriggerTimeRef.current < 500) {
        return;
      }
      lastTriggerTimeRef.current = now;

      const emoji = e.detail?.emoji || '❤️';
      const pId = `pop_${now}`;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // Display the big centered Instagram-story-like reaction popup for the reacted emoji
      setActivePopup({ id: pId, emoji });

      // Clean up after animation finishes (0.8s)
      timerRef.current = setTimeout(() => {
        setActivePopup(null);
      }, 800);
    };

    window.addEventListener('pulsechat_trigger_emoji_burst', handleTriggerBurst);
    return () => {
      window.removeEventListener('pulsechat_trigger_emoji_burst', handleTriggerBurst);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!activePopup) return null;

  return (
    <>
      <style>{`
        @keyframes instaStoryReactionPop {
          0% {
            transform: translate(-50%, -50%) scale(0) rotate(-16deg);
            opacity: 0;
          }
          35% {
            transform: translate(-50%, -50%) scale(1.36) rotate(0deg);
            opacity: 1;
          }
          65% {
            transform: translate(-50%, -50%) scale(1.12) rotate(6deg);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(0.85) translateY(-46px);
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
          transform: 'translate(-50%, -50%)',
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
  );
}
