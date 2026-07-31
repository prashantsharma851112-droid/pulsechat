import React, { useState } from 'react';
import { Sparkles, Heart, Flower2, X } from 'lucide-react';

export default function PandaHero() {
  const [showModal, setShowModal] = useState(false);
  const [petals, setPetals] = useState([]);

  const handlePandaClick = () => {
    // Generate flower petals confetti
    const newPetals = Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      animDuration: 2 + Math.random() * 3,
      size: 16 + Math.random() * 16,
      rotate: Math.random() * 360,
      icon: i % 3 === 0 ? '🌸' : i % 3 === 1 ? '🌺' : '🌻'
    }));

    setPetals(newPetals);
    setShowModal(true);

    setTimeout(() => {
      setPetals([]);
    }, 4500);
  };

  return (
    <div className="panda-hero-container">
      {/* Flower Petals Confetti Layer */}
      {petals.length > 0 && (
        <div className="flower-shower-overlay">
          {petals.map(p => (
            <span
              key={p.id}
              className="falling-petal"
              style={{
                left: `${p.left}%`,
                animationDuration: `${p.animDuration}s`,
                fontSize: `${p.size}px`,
                transform: `rotate(${p.rotate}deg)`
              }}
            >
              {p.icon}
            </span>
          ))}
        </div>
      )}

      {/* Animated Waving Panda */}
      <div className="panda-wrapper" onClick={handlePandaClick} title="Click me for a surprise welcome!">
        <svg className="panda-svg" viewBox="0 0 200 200" width="160" height="160">
          {/* Ears */}
          <circle cx="50" cy="50" r="24" fill="#1e293b" />
          <circle cx="150" cy="50" r="24" fill="#1e293b" />
          <circle cx="50" cy="50" r="14" fill="#334155" />
          <circle cx="150" cy="50" r="14" fill="#334155" />

          {/* Head */}
          <circle cx="100" cy="100" r="65" fill="#ffffff" stroke="#cbd5e1" strokeWidth="3" />

          {/* Eye Patches */}
          <ellipse cx="75" cy="95" rx="16" ry="20" fill="#1e293b" transform="rotate(-15 75 95)" />
          <ellipse cx="125" cy="95" rx="16" ry="20" fill="#1e293b" transform="rotate(15 125 95)" />

          {/* Eyes & Sparkles */}
          <circle cx="75" cy="92" r="6" fill="#ffffff" />
          <circle cx="77" cy="90" r="2.5" fill="#6366f1" />
          <circle cx="125" cy="92" r="6" fill="#ffffff" />
          <circle cx="123" cy="90" r="2.5" fill="#6366f1" />

          {/* Nose */}
          <ellipse cx="100" cy="112" rx="9" ry="6" fill="#1e293b" />

          {/* Cheeks */}
          <circle cx="60" cy="115" r="10" fill="#f472b6" opacity="0.5" />
          <circle cx="140" cy="115" r="10" fill="#f472b6" opacity="0.5" />

          {/* Happy Smile */}
          <path d="M 90 120 Q 100 128 110 120" stroke="#1e293b" strokeWidth="3" fill="none" strokeLinecap="round" />

          {/* Waving Paw */}
          <g className="waving-paw">
            <ellipse cx="160" cy="130" rx="14" ry="22" fill="#1e293b" transform="rotate(35 160 130)" />
            <circle cx="164" cy="118" r="4" fill="#f472b6" />
          </g>

          {/* Static Paw */}
          <ellipse cx="40" cy="140" rx="14" ry="20" fill="#1e293b" transform="rotate(-20 40 140)" />
        </svg>

        <div className="panda-speech-bubble">
          <span>Click me! 🌸</span>
        </div>
      </div>

      <h2 style={{ fontSize: '1.6rem', marginBottom: '0.4rem', color: 'var(--text-main)', fontWeight: 700 }}>
        Welcome to PulseChat ⚡
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', maxWidth: '420px', textAlign: 'center', lineHeight: 1.5 }}>
        Select or search a user from the sidebar using @username or join a Group chat to start messaging!
      </p>

      {/* Welcome Flower Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card panda-welcome-modal" onClick={e => e.stopPropagation()}>
            <button className="icon-btn-ghost" style={{ position: 'absolute', top: 12, right: 12 }} onClick={() => setShowModal(false)}>
              <X size={20} />
            </button>

            <div style={{ fontSize: '3rem', marginBottom: '0.5rem', animation: 'bounce-hero 1s infinite' }}>🌸🐼💐</div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
              Welcome to the PulseChat Family! 🎉
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
              We're super thrilled to have you here! Enjoy real-time WebRTC video calls, interactive polls, collaborative whiteboard doodles, and smart AI chat features!
            </p>

            <button className="btn-primary" onClick={() => setShowModal(false)} style={{ width: '100%' }}>
              <Heart size={18} fill="#fff" /> Start Chatting Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
