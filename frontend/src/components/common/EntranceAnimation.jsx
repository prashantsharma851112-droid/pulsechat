import React, { useEffect, useState } from 'react';
import { Zap, ShieldCheck, Sparkles, Radio } from 'lucide-react';

export default function EntranceAnimation({ user, onComplete }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 600);
    const t2 = setTimeout(() => setStep(2), 1600);
    const t3 = setTimeout(() => {
      if (onComplete) onComplete();
    }, 2800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  return (
    <div className="entrance-overlay">
      {/* Dynamic Background Glow Orbs */}
      <div className="entrance-orb entrance-orb-1"></div>
      <div className="entrance-orb entrance-orb-2"></div>
      <div className="entrance-orb entrance-orb-3"></div>

      {/* Main Glass Card */}
      <div className="entrance-card">
        {/* Animated Pulse Logo */}
        <div className="entrance-logo-wrapper">
          <div className="entrance-logo-ring"></div>
          <div className="entrance-logo-icon">
            <Zap size={44} color="#fff" />
          </div>
        </div>

        {/* User Avatar & Greeting */}
        <div className="entrance-content">
          <img
            src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username || 'user'}`}
            alt="Avatar"
            className="entrance-user-avatar"
          />

          <h1 className="entrance-title">
            Welcome back, <span className="entrance-highlight">{user?.displayName || 'User'}</span>!
          </h1>

          <div className="entrance-status-badge">
            <Radio size={14} className="entrance-pulse-dot" />
            <span>Establishing Secure Socket Connection...</span>
          </div>

          <div className="entrance-features-row">
            <div className={`entrance-feature-item ${step >= 1 ? 'visible' : ''}`}>
              <ShieldCheck size={16} color="#10b981" />
              <span>Encrypted Channels</span>
            </div>
            <div className={`entrance-feature-item ${step >= 2 ? 'visible' : ''}`}>
              <Sparkles size={16} color="#f59e0b" />
              <span>WebRTC & Realtime Engine Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
