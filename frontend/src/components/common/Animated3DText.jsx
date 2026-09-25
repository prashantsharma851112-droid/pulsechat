import React from 'react';
import { Clock, Check, CheckCheck, Sparkles, Flame, Zap, Crown, Gem, Smile } from 'lucide-react';

/**
 * Animated3DText - Hyper-realistic 3D Extruded Animated Typography for PulseChat.
 * VIP Pro feature that converts typed words into animated 3D stickers.
 */
export default function Animated3DText({
  text = 'PULSE',
  styleType = 'cyber-neon',
  isMine = true,
  timeStr = '',
  status = 'read',
  showFooter = true,
  scale = 1
}) {
  const getStyleConfig = () => {
    switch (styleType) {
      case 'gold-deluxe':
        return {
          className: 'text-3d-gold',
          label: 'Gold Deluxe',
          icon: <Crown size={12} color="#f59e0b" />,
          accentColor: '#f59e0b'
        };
      case 'flame-inferno':
        return {
          className: 'text-3d-flame',
          label: 'Inferno Blaze',
          icon: <Flame size={12} color="#f97316" />,
          accentColor: '#f97316'
        };
      case 'cosmic-nebula':
        return {
          className: 'text-3d-cosmic',
          label: 'Cosmic Nebula',
          icon: <Sparkles size={12} color="#a855f7" />,
          accentColor: '#a855f7'
        };
      case 'diamond-crystal':
        return {
          className: 'text-3d-diamond',
          label: 'Crystal Diamond',
          icon: <Gem size={12} color="#38bdf8" />,
          accentColor: '#38bdf8'
        };
      case 'bubble-candy':
        return {
          className: 'text-3d-candy',
          label: 'Candy Pop',
          icon: <Smile size={12} color="#ec4899" />,
          accentColor: '#ec4899'
        };
      case 'emerald-matrix':
        return {
          className: 'text-3d-emerald',
          label: 'Emerald Matrix',
          icon: <Sparkles size={12} color="#10b981" />,
          accentColor: '#10b981'
        };
      case 'blood-crimson':
        return {
          className: 'text-3d-crimson',
          label: 'Blood Crimson',
          icon: <Flame size={12} color="#f43f5e" />,
          accentColor: '#f43f5e'
        };
      case 'tokyo-synthwave':
        return {
          className: 'text-3d-tokyo',
          label: 'Tokyo Synthwave',
          icon: <Zap size={12} color="#ec4899" />,
          accentColor: '#ec4899'
        };
      case 'royal-platinum':
        return {
          className: 'text-3d-platinum',
          label: 'Royal Platinum',
          icon: <Crown size={12} color="#e2e8f0" />,
          accentColor: '#e2e8f0'
        };
      case 'cyber-neon':
      default:
        return {
          className: 'text-3d-neon',
          label: 'Cyber Neon',
          icon: <Zap size={12} color="#06b6d4" />,
          accentColor: '#06b6d4'
        };
    }
  };

  const config = getStyleConfig();

  return (
    <div
      className="animated-3d-text-container"
      style={{
        userSelect: 'none',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: isMine ? 'flex-end' : 'flex-start',
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: isMine ? 'right center' : 'left center'
      }}
    >
      {/* 3D Perspective Stage */}
      <div className="animated-3d-stage">
        <div className={`animated-3d-card ${config.className}`}>
          {/* Main 3D Extruded Text */}
          <span className="text-3d-content" data-text={text}>
            {text}
          </span>

          {/* Dynamic Ground Shadow */}
          <div className="text-3d-shadow" />
        </div>
      </div>

      {/* Footer Pill & Status */}
      {showFooter && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isMine ? 'flex-end' : 'flex-start',
            gap: '6px',
            marginTop: '8px'
          }}
        >
          {/* 3D VIP Badge */}
          <span
            className="text-3d-pill"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '12px',
              background: 'rgba(0, 0, 0, 0.4)',
              border: `1px solid ${config.accentColor}44`,
              fontSize: '0.68rem',
              fontWeight: 700,
              color: config.accentColor
            }}
          >
            {config.icon}
            <span>3D VIP</span>
          </span>

          {/* Minimal Timestamp & Delivery Ticks */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '0.68rem',
              color: 'var(--text-muted)',
              opacity: 0.85
            }}
          >
            {timeStr}
            {isMine && (
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                {status === 'pending' ? (
                  <Clock size={12} color="#9ca3af" />
                ) : status === 'read' ? (
                  <CheckCheck size={14} color="#53bdeb" />
                ) : status === 'delivered' ? (
                  <CheckCheck size={14} color="#9ca3af" />
                ) : (
                  <Check size={14} color="#9ca3af" />
                )}
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
