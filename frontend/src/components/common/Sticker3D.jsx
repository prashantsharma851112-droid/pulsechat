import React, { useId } from 'react';
import { Zap, Clock, Check, CheckCheck } from 'lucide-react';

/**
 * Sticker3D - Hyper-realistic 3D Animated Stickers for PulseChat Virtual Gifts.
 * Features 3D perspective, dynamic floating motion, realistic drop shadows,
 * specular highlights, and exclusively displays the Spark count pill underneath.
 */
export default function Sticker3D({
  giftId = 'rocket',
  sparkAmount = 35,
  isMine = true,
  timeStr = '',
  status = 'read',
  showFooter = true
}) {
  const uid = useId().replace(/:/g, '');

  const render3dGraphic = () => {
    switch (giftId) {
      case 'rocket':
        return (
          <svg viewBox="0 0 160 160" width="110" height="110" className="sticker-3d-graphic">
            <defs>
              <linearGradient id={`hull_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="35%" stopColor="#e2e8f0" />
                <stop offset="70%" stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#475569" />
              </linearGradient>
              <linearGradient id={`fin_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ff4b4b" />
                <stop offset="60%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#7f1d1d" />
              </linearGradient>
              <linearGradient id={`cockpit_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#67e8f9" />
                <stop offset="60%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#0e7490" />
              </linearGradient>
              <linearGradient id={`flameMain_${uid}`} x1="50%" y1="0%" x2="50%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="25%" stopColor="#fef08a" />
                <stop offset="60%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
              <linearGradient id={`flameCyan_${uid}`} x1="50%" y1="0%" x2="50%" y2="100%">
                <stop offset="0%" stopColor="#a5f3fc" />
                <stop offset="70%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
              <filter id={`thrusterGlow_${uid}`} x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="5" result="glow" />
                <feComposite in="SourceGraphic" in2="glow" operator="over" />
              </filter>
            </defs>

            {/* Thruster Flames (Animated) */}
            <g className="sticker-flame-group" filter={`url(#thrusterGlow_${uid})`}>
              {/* Outer Energy Tail */}
              <path
                d="M52 110 L40 148 L65 125 L55 152 L75 120 Z"
                fill={`url(#flameCyan_${uid})`}
                opacity="0.85"
                className="sticker-flame-tail"
              />
              {/* Core Fiery Flame */}
              <path
                d="M54 106 L36 142 L58 122 L48 148 L68 116 Z"
                fill={`url(#flameMain_${uid})`}
                className="sticker-flame-core"
              />
              <circle cx="45" cy="144" r="3" fill="#fef08a" opacity="0.9" className="sticker-particle-p1" />
              <circle cx="58" cy="138" r="2.5" fill="#f97316" opacity="0.8" className="sticker-particle-p2" />
            </g>

            {/* Thruster Nozzle */}
            <path
              d="M48 98 L72 112 L64 118 L42 106 Z"
              fill="#334155"
              stroke="#1e293b"
              strokeWidth="1.5"
            />

            {/* Left Fin */}
            <path
              d="M56 86 L32 96 L44 116 L65 102 Z"
              fill={`url(#fin_${uid})`}
              filter="drop-shadow(-2px 3px 3px rgba(0,0,0,0.35))"
            />

            {/* Right Fin */}
            <path
              d="M92 65 L118 75 L106 102 L86 94 Z"
              fill={`url(#fin_${uid})`}
              filter="drop-shadow(2px 3px 3px rgba(0,0,0,0.35))"
            />

            {/* Main 3D Fuselage Hull */}
            <path
              d="M125 35 C115 28 85 45 62 76 C55 86 52 98 56 102 C60 106 72 103 82 96 C113 73 130 43 125 35 Z"
              fill={`url(#hull_${uid})`}
              filter="drop-shadow(0 10px 15px rgba(0,0,0,0.35))"
            />

            {/* Dorsal Spine Fin */}
            <path
              d="M80 62 L74 44 L92 48 L98 64 Z"
              fill={`url(#fin_${uid})`}
            />

            {/* Circular Cockpit Window */}
            <ellipse
              cx="92"
              cy="58"
              rx="12"
              ry="10"
              transform="rotate(-40 92 58)"
              fill={`url(#cockpit_${uid})`}
              stroke="#f8fafc"
              strokeWidth="2.5"
            />
            {/* Glass Specular Crescent */}
            <ellipse
              cx="90"
              cy="55"
              rx="6"
              ry="3"
              transform="rotate(-40 90 55)"
              fill="#ffffff"
              opacity="0.8"
            />

            {/* Rocket Tip Nosecone Highlight */}
            <circle cx="121" cy="38" r="3" fill="#ffffff" opacity="0.9" />
          </svg>
        );

      case 'heart':
        return (
          <svg viewBox="0 0 160 160" width="110" height="110" className="sticker-3d-graphic">
            <defs>
              <radialGradient id={`heartRadial_${uid}`} cx="35%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#ff9a9e" />
                <stop offset="25%" stopColor="#ff4071" />
                <stop offset="65%" stopColor="#e11d48" />
                <stop offset="100%" stopColor="#881337" />
              </radialGradient>
              <linearGradient id={`heartGlint_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                <stop offset="50%" stopColor="#ffffff" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
              <filter id={`heartGlow_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#f43f5e" floodOpacity="0.45" />
              </filter>
            </defs>

            {/* 3D Plump Heart Body */}
            <path
              d="M80 134 C64 120 24 92 24 55 C24 35 40 22 58 22 C69 22 76 27 80 34 C84 27 91 22 102 22 C120 22 136 35 136 55 C136 92 96 120 80 134 Z"
              fill={`url(#heartRadial_${uid})`}
              filter={`url(#heartGlow_${uid})`}
            />

            {/* Dimensional Facet Overlay (Glassy Top Reflection) */}
            <path
              d="M58 28 C45 28 34 38 34 52 C34 70 54 92 80 114 C74 100 66 84 62 70 C58 56 55 42 58 28 Z"
              fill={`url(#heartGlint_${uid})`}
            />

            {/* Specular Glint Crescent */}
            <ellipse
              cx="52"
              cy="42"
              rx="12"
              ry="7"
              transform="rotate(-30 52 42)"
              fill="#ffffff"
              opacity="0.85"
            />
            <circle cx="106" cy="38" r="4" fill="#ffffff" opacity="0.7" />

            {/* Ambient Floating Mini-Heart Sparkles */}
            <g className="sticker-particle-p1">
              <polygon points="126,26 130,22 134,26 130,30" fill="#fde047" opacity="0.9" />
            </g>
            <g className="sticker-particle-p2">
              <polygon points="26,80 30,76 34,80 30,84" fill="#f43f5e" opacity="0.8" />
            </g>
          </svg>
        );

      case 'fire':
        return (
          <svg viewBox="0 0 160 160" width="110" height="110" className="sticker-3d-graphic">
            <defs>
              <linearGradient id={`fireOuter_${uid}`} x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#991b1b" />
                <stop offset="35%" stopColor="#ea580c" />
                <stop offset="75%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#facc15" />
              </linearGradient>
              <linearGradient id={`fireInner_${uid}`} x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#ea580c" />
                <stop offset="45%" stopColor="#facc15" />
                <stop offset="100%" stopColor="#ffffff" />
              </linearGradient>
              <filter id={`fireGlow_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="6" stdDeviation="12" floodColor="#f97316" floodOpacity="0.5" />
              </filter>
            </defs>

            {/* Outer Crimson / Orange Flame */}
            <path
              d="M80 18 C85 45 106 58 106 80 C106 90 102 98 96 102 C114 96 128 78 128 58 C135 88 126 114 108 128 C95 138 65 138 52 128 C34 114 25 88 32 58 C32 78 46 96 64 102 C58 98 54 90 54 80 C54 58 75 45 80 18 Z"
              fill={`url(#fireOuter_${uid})`}
              filter={`url(#fireGlow_${uid})`}
              className="sticker-flame-outer"
            />

            {/* Inner Electric Flame */}
            <path
              d="M80 50 C83 68 96 78 96 94 C96 105 89 116 80 122 C71 116 64 105 64 94 C64 78 77 68 80 50 Z"
              fill={`url(#fireInner_${uid})`}
              className="sticker-flame-inner"
            />

            {/* Core White-Hot Ember */}
            <ellipse cx="80" cy="98" rx="7" ry="12" fill="#ffffff" opacity="0.9" />

            {/* Dynamic Sparks / Embers */}
            <circle cx="68" cy="36" r="3" fill="#fde047" className="sticker-particle-p1" />
            <circle cx="94" cy="30" r="2.5" fill="#f97316" className="sticker-particle-p2" />
            <circle cx="112" cy="50" r="2" fill="#facc15" className="sticker-particle-p1" />
          </svg>
        );

      case 'coffee':
        return (
          <svg viewBox="0 0 160 160" width="110" height="110" className="sticker-3d-graphic">
            <defs>
              <linearGradient id={`mugBody_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="40%" stopColor="#e2e8f0" />
                <stop offset="85%" stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#64748b" />
              </linearGradient>
              <linearGradient id={`espresso_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#451a03" />
                <stop offset="60%" stopColor="#78350f" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>
              <linearGradient id={`saucer_${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#cbd5e1" />
                <stop offset="100%" stopColor="#64748b" />
              </linearGradient>
            </defs>

            {/* Saucer */}
            <ellipse cx="78" cy="120" rx="55" ry="16" fill={`url(#saucer_${uid})`} opacity="0.8" />
            <ellipse cx="78" cy="118" rx="46" ry="12" fill="#f8fafc" />

            {/* 3D Mug Handle */}
            <path
              d="M102 70 C122 70 128 100 102 102"
              fill="none"
              stroke={`url(#mugBody_${uid})`}
              strokeWidth="9"
              strokeLinecap="round"
              filter="drop-shadow(2px 3px 4px rgba(0,0,0,0.3))"
            />

            {/* Mug Outer Shell */}
            <path
              d="M44 64 C44 98 52 114 78 114 C104 114 112 98 112 64 Z"
              fill={`url(#mugBody_${uid})`}
              filter="drop-shadow(0 8px 12px rgba(0,0,0,0.35))"
            />

            {/* Mug Rim & Liquid Surface */}
            <ellipse cx="78" cy="64" rx="34" ry="12" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="2" />
            <ellipse cx="78" cy="64" rx="30" ry="10" fill={`url(#espresso_${uid})`} />

            {/* Crema Swirl / Foam Art */}
            <ellipse cx="76" cy="63" rx="15" ry="4.5" fill="#d97706" opacity="0.65" />
            <circle cx="74" cy="63" r="2.5" fill="#fef3c7" opacity="0.8" />

            {/* Rising Steam Swirls (Animated) */}
            <path
              d="M66 48 C62 38 72 32 68 22 C66 18 70 14 66 10"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="3.5"
              strokeLinecap="round"
              opacity="0.75"
              className="sticker-steam-left"
            />
            <path
              d="M86 46 C90 36 80 30 84 20 C87 16 82 12 85 8"
              fill="none"
              stroke="#f8fafc"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.85"
              className="sticker-steam-right"
            />
          </svg>
        );

      case 'diamond':
        return (
          <svg viewBox="0 0 160 160" width="110" height="110" className="sticker-3d-graphic">
            <defs>
              <linearGradient id={`diaTop_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e0f2fe" />
                <stop offset="100%" stopColor="#7dd3fc" />
              </linearGradient>
              <linearGradient id={`diaFacetL_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
              <linearGradient id={`diaFacetC_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#67e8f9" />
                <stop offset="100%" stopColor="#0369a1" />
              </linearGradient>
              <linearGradient id={`diaFacetR_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#4338ca" />
              </linearGradient>
              <filter id={`diaGlow_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#38bdf8" floodOpacity="0.5" />
              </filter>
            </defs>

            {/* Main Diamond Facets */}
            <g filter={`url(#diaGlow_${uid})`}>
              {/* Crown Top */}
              <polygon points="52,38 108,38 132,68 28,68" fill={`url(#diaTop_${uid})`} />

              {/* Pavilion Center */}
              <polygon points="56,68 80,132 104,68" fill={`url(#diaFacetC_${uid})`} />
              {/* Pavilion Left */}
              <polygon points="28,68 56,68 80,132" fill={`url(#diaFacetL_${uid})`} />
              {/* Pavilion Right */}
              <polygon points="104,68 132,68 80,132" fill={`url(#diaFacetR_${uid})`} />

              {/* Upper Triangles */}
              <polygon points="52,38 80,68 108,38" fill="#ffffff" opacity="0.65" />
              <polygon points="52,38 28,68 80,68" fill="#bae6fd" opacity="0.8" />
              <polygon points="108,38 80,68 132,68" fill="#a5b4fc" opacity="0.85" />
            </g>

            {/* Prismatic Specular Star Glints */}
            <g className="sticker-particle-p1">
              <polygon points="50,38 53,30 56,38 64,41 56,44 53,52 50,44 42,41" fill="#ffffff" />
            </g>
            <g className="sticker-particle-p2">
              <polygon points="108,66 110,60 112,66 118,68 112,70 110,76 108,70 102,68" fill="#fde047" />
            </g>
          </svg>
        );

      case 'crown':
        return (
          <svg viewBox="0 0 160 160" width="110" height="110" className="sticker-3d-graphic">
            <defs>
              <linearGradient id={`goldCrown_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fffbeb" />
                <stop offset="25%" stopColor="#fde047" />
                <stop offset="60%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#a16207" />
              </linearGradient>
              <linearGradient id={`crownVelvet_${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#701a75" />
                <stop offset="100%" stopColor="#3b0764" />
              </linearGradient>
              <filter id={`crownGlow_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#eab308" floodOpacity="0.55" />
              </filter>
            </defs>

            {/* Royal Velvet Cushion Interior */}
            <path
              d="M38 98 C38 62 122 62 122 98 Z"
              fill={`url(#crownVelvet_${uid})`}
              opacity="0.85"
            />

            {/* 3D Gold Spires & Body */}
            <g filter={`url(#crownGlow_${uid})`}>
              <polygon
                points="24,106 32,54 56,84 80,38 104,84 128,54 136,106"
                fill={`url(#goldCrown_${uid})`}
              />

              {/* Lower Band */}
              <rect x="22" y="104" width="116" height="18" rx="6" fill={`url(#goldCrown_${uid})`} stroke="#854d0e" strokeWidth="1" />

              {/* Gemstones on Band */}
              <ellipse cx="44" cy="113" rx="5" ry="5" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
              <ellipse cx="80" cy="113" rx="6" ry="6" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.2" />
              <ellipse cx="116" cy="113" rx="5" ry="5" fill="#10b981" stroke="#ffffff" strokeWidth="1" />

              {/* Golden Peak Spheres */}
              <circle cx="32" cy="52" r="5" fill="#ffffff" />
              <circle cx="80" cy="36" r="7" fill="#ffffff" />
              <circle cx="128" cy="52" r="5" fill="#ffffff" />
            </g>

            {/* Radiant Sparkles */}
            <g className="sticker-particle-p1">
              <polygon points="80,20 82,14 84,20 90,22 84,24 82,30 80,24 74,22" fill="#fde047" />
            </g>
          </svg>
        );

      default:
        return (
          <div className="sticker-3d-generic-orb">
            <span style={{ fontSize: '4rem', filter: 'drop-shadow(0 8px 12px rgba(0,0,0,0.35))' }}>
              🎁
            </span>
          </div>
        );
    }
  };

  return (
    <div className="sticker-3d-container" style={{ userSelect: 'none' }}>
      {/* 3D Floating Sticker with Physics */}
      <div className="sticker-3d-hover-card">
        {render3dGraphic()}
        {/* Dynamic Ground Contact Shadow */}
        <div className="sticker-3d-shadow" />
      </div>

      {/* Exclusively Spark Count Pill + Ticks (No Other Text) */}
      {showFooter && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isMine ? 'flex-end' : 'flex-start',
            gap: '6px',
            marginTop: '6px'
          }}
        >
          {/* Spark Count Pill */}
          <span
            className="sticker-spark-pill"
            title={`Pulse Gift: ${sparkAmount} Sparks`}
          >
            <Zap size={13} fill="#f59e0b" color="#f59e0b" style={{ flexShrink: 0 }} />
            <span>{sparkAmount} Sparks</span>
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
