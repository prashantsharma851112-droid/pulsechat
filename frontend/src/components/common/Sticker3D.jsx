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
  showFooter = true,
  onClick = null
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


      case 'chocolates':
        return (
          <svg viewBox="0 0 160 160" width="112" height="112" className="sticker-3d-graphic">
            <defs>
              <linearGradient id={`chocBox_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#be123c" />
                <stop offset="60%" stopColor="#881337" />
                <stop offset="100%" stopColor="#4c0519" />
              </linearGradient>
              <linearGradient id={`chocGold_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="60%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#a16207" />
              </linearGradient>
              <linearGradient id={`darkChoc_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#581c87" />
                <stop offset="60%" stopColor="#3b0764" />
                <stop offset="100%" stopColor="#1e1b4b" />
              </linearGradient>
              <filter id={`chocGlow_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#be123c" floodOpacity="0.45" />
              </filter>
            </defs>

            <g filter={`url(#chocGlow_${uid})`}>
              {/* Heart Box Base */}
              <path
                d="M80 138 C60 122 22 92 22 52 C22 30 40 18 60 18 C72 18 78 24 80 30 C82 24 88 18 100 18 C120 18 138 30 138 52 C138 92 100 122 80 138 Z"
                fill={`url(#chocBox_${uid})`}
                stroke={`url(#chocGold_${uid})`}
                strokeWidth="3.5"
              />

              {/* Satin Cushion Tray */}
              <path
                d="M80 128 C64 114 32 88 32 54 C32 36 46 26 62 26 C72 26 77 31 80 36 C83 31 88 26 98 26 C114 26 128 36 128 54 C128 88 96 114 80 128 Z"
                fill="#2e0513"
              />

              {/* Assorted 3D Chocolates */}
              {/* 1. Golden Truffle */}
              <circle cx="56" cy="52" r="10" fill="url(#chocGold_${uid})" stroke="#78350f" strokeWidth="1.2" />
              <circle cx="53" cy="49" r="3" fill="#ffffff" opacity="0.6" />

              {/* 2. Swirled Dark Truffle */}
              <circle cx="104" cy="52" r="10" fill="#260e04" stroke="#451a03" strokeWidth="1.2" />
              <path d="M98 52 Q104 46 110 52 Q104 58 98 52" fill="none" stroke="#fef08a" strokeWidth="1.5" />

              {/* 3. Milk Chocolate Heart */}
              <path d="M80 84 C74 77 62 66 62 54 C62 48 67 44 72 44 C76 44 78 47 80 49 C82 47 84 44 88 44 C93 44 98 48 98 54 C98 66 86 77 80 84 Z" fill="#78350f" stroke="#451a03" strokeWidth="1" />
              <path d="M72 50 Q80 58 88 50" fill="none" stroke="#fbcfe8" strokeWidth="1.5" />

              {/* 4. White Chocolate Praline */}
              <circle cx="64" cy="88" r="9" fill="#fef3c7" stroke="#d97706" strokeWidth="1" />
              <circle cx="62" cy="86" r="2.5" fill="#ffffff" />

              {/* 5. Ruby Berry Bonbon */}
              <circle cx="96" cy="88" r="9" fill="#e11d48" stroke="#9f1239" strokeWidth="1" />
              <circle cx="94" cy="86" r="2.5" fill="#fecdd3" />
            </g>

            {/* Sparkles */}
            <g className="sticker-particle-p1">
              <polygon points="128,30 130,24 132,30 138,32 132,34 130,40 128,34 122,32" fill="#fde047" />
            </g>
          </svg>
        );

      case 'rose':
        return (
          <svg viewBox="0 0 160 160" width="112" height="112" className="sticker-3d-graphic">
            <defs>
              <radialGradient id={`rosePetal_${uid}`} cx="40%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#f43f5e" />
                <stop offset="45%" stopColor="#e11d48" />
                <stop offset="80%" stopColor="#9f1239" />
                <stop offset="100%" stopColor="#4c0519" />
              </radialGradient>
              <linearGradient id={`roseStem_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22c55e" />
                <stop offset="70%" stopColor="#15803d" />
                <stop offset="100%" stopColor="#14532d" />
              </linearGradient>
              <filter id={`roseGlow_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#f43f5e" floodOpacity="0.5" />
              </filter>
            </defs>

            {/* Curved Emerald Stem */}
            <path
              d="M80 88 Q74 116 86 148"
              fill="none"
              stroke={`url(#roseStem_${uid})`}
              strokeWidth="5"
              strokeLinecap="round"
            />
            {/* Emerald Leaves */}
            <path
              d="M78 114 Q58 106 50 114 Q66 122 78 118 Z"
              fill={`url(#roseStem_${uid})`}
            />
            <path
              d="M82 128 Q102 120 110 128 Q94 136 82 132 Z"
              fill={`url(#roseStem_${uid})`}
            />

            {/* 3D Rose Flower Head */}
            <g filter={`url(#roseGlow_${uid})`}>
              {/* Outer Petals */}
              <path d="M80 32 C54 32 38 52 46 76 C54 94 74 98 80 98 C86 98 106 94 114 76 C122 52 106 32 80 32 Z" fill={`url(#rosePetal_${uid})`} />
              {/* Middle Layer Petals */}
              <path d="M80 40 C62 40 52 56 58 74 C64 86 76 90 80 90 C84 90 96 86 102 74 C108 56 98 40 80 40 Z" fill="#e11d48" />
              {/* Inner Petal Swirls */}
              <path d="M72 48 Q80 40 88 48 Q94 60 88 72 Q80 78 72 70 Q66 58 72 48 Z" fill="#be123c" />
              <path d="M76 54 Q80 50 84 54 Q86 62 82 66 Q78 66 76 60 Z" fill="#9f1239" />
              <circle cx="80" cy="58" r="4" fill="#881337" />

              {/* Dewdrop Specular */}
              <ellipse cx="64" cy="62" rx="4" ry="2.5" transform="rotate(-20 64 62)" fill="#ffffff" opacity="0.8" />
              <circle cx="94" cy="70" r="2.5" fill="#ffffff" opacity="0.7" />
            </g>

            {/* Falling Crimson Petal */}
            <path
              d="M116 112 Q126 106 128 116 Q122 124 114 120 Z"
              fill={`url(#rosePetal_${uid})`}
              opacity="0.85"
              className="sticker-particle-p1"
            />
            {/* Sparkles */}
            <g className="sticker-particle-p2">
              <polygon points="44,38 46,32 48,38 54,40 48,42 46,48 44,42 38,40" fill="#fde047" />
            </g>
          </svg>
        );

      case 'pizza':
        return (
          <svg viewBox="0 0 160 160" width="112" height="112" className="sticker-3d-graphic">
            <defs>
              <linearGradient id={`pizzaCrust_${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#b45309" />
                <stop offset="50%" stopColor="#d97706" />
                <stop offset="100%" stopColor="#92400e" />
              </linearGradient>
              <linearGradient id={`pizzaCheese_${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="45%" stopColor="#facc15" />
                <stop offset="100%" stopColor="#eab308" />
              </linearGradient>
              <filter id={`pizzaGlow_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#f59e0b" floodOpacity="0.45" />
              </filter>
            </defs>

            <g filter={`url(#pizzaGlow_${uid})`}>
              {/* Back Crust */}
              <path d="M30 46 Q80 20 130 46 Q80 32 30 46 Z" fill={`url(#pizzaCrust_${uid})`} />
              <ellipse cx="80" cy="36" rx="52" ry="12" fill={`url(#pizzaCrust_${uid})`} />

              {/* Main Cheese Body */}
              <polygon points="32,46 128,46 80,140" fill={`url(#pizzaCheese_${uid})`} />

              {/* Melting Dripping Cheese */}
              <path d="M72 134 Q80 152 86 136 Z" fill={`url(#pizzaCheese_${uid})`} />
              <path d="M52 88 Q56 102 60 88 Z" fill={`url(#pizzaCheese_${uid})`} />

              {/* Sizzling Pepperonis */}
              <circle cx="68" cy="62" r="10" fill="#dc2626" stroke="#991b1b" strokeWidth="1.5" />
              <circle cx="66" cy="60" r="2.5" fill="#f87171" />

              <circle cx="96" cy="74" r="9" fill="#dc2626" stroke="#991b1b" strokeWidth="1.5" />
              <circle cx="94" cy="72" r="2" fill="#f87171" />

              <circle cx="78" cy="98" r="8" fill="#dc2626" stroke="#991b1b" strokeWidth="1.5" />

              {/* Basil Leaf */}
              <ellipse cx="64" cy="82" rx="6" ry="3.5" transform="rotate(-30 64 82)" fill="#16a34a" />
              <ellipse cx="94" cy="56" rx="5" ry="3" transform="rotate(25 94 56)" fill="#16a34a" />
            </g>

            {/* Rising Sizzle Steam */}
            <path d="M68 28 Q62 18 68 10" fill="none" stroke="#f1f5f9" strokeWidth="2.5" strokeLinecap="round" opacity="0.75" className="sticker-steam-left" />
            <path d="M92 26 Q98 16 92 8" fill="none" stroke="#f1f5f9" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" className="sticker-steam-right" />
          </svg>
        );

      case 'gelato':
        return (
          <svg viewBox="0 0 160 160" width="112" height="112" className="sticker-3d-graphic">
            <defs>
              <linearGradient id={`coneGrad_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="50%" stopColor="#d97706" />
                <stop offset="100%" stopColor="#92400e" />
              </linearGradient>
              <radialGradient id={`strawberryScoop_${uid}`} cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#fda4af" />
                <stop offset="60%" stopColor="#f43f5e" />
                <stop offset="100%" stopColor="#be123c" />
              </radialGradient>
              <radialGradient id={`vanillaScoop_${uid}`} cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="55%" stopColor="#fef08a" />
                <stop offset="100%" stopColor="#ca8a04" />
              </radialGradient>
              <radialGradient id={`chocScoop_${uid}`} cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#78350f" />
                <stop offset="60%" stopColor="#451a03" />
                <stop offset="100%" stopColor="#1c0a00" />
              </radialGradient>
              <filter id={`gelatoGlow_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#f43f5e" floodOpacity="0.4" />
              </filter>
            </defs>

            <g filter={`url(#gelatoGlow_${uid})`}>
              {/* Waffle Cone */}
              <polygon points="54,88 106,88 80,146" fill={`url(#coneGrad_${uid})`} />
              {/* Cone Waffle Grid Lines */}
              <line x1="60" y1="94" x2="90" y2="132" stroke="#78350f" strokeWidth="1.2" opacity="0.6" />
              <line x1="72" y1="92" x2="84" y2="140" stroke="#78350f" strokeWidth="1.2" opacity="0.6" />
              <line x1="100" y1="94" x2="70" y2="132" stroke="#78350f" strokeWidth="1.2" opacity="0.6" />

              {/* Bottom Scoops */}
              {/* Scoop 1: Chocolate */}
              <circle cx="64" cy="80" r="18" fill={`url(#chocScoop_${uid})`} />
              {/* Scoop 2: Vanilla */}
              <circle cx="96" cy="80" r="18" fill={`url(#vanillaScoop_${uid})`} />

              {/* Top Scoop: Strawberry */}
              <circle cx="80" cy="54" r="22" fill={`url(#strawberryScoop_${uid})`} />
              <circle cx="74" cy="46" r="6" fill="#ffffff" opacity="0.45" />

              {/* Golden Drizzle on top */}
              <path d="M70 48 Q80 56 90 48 Q94 60 90 68" fill="none" stroke="#fef08a" strokeWidth="3" strokeLinecap="round" />

              {/* Glossy Red Cherry on Top */}
              <circle cx="80" cy="30" r="8" fill="#dc2626" stroke="#991b1b" strokeWidth="1" />
              <circle cx="78" cy="28" r="2.5" fill="#ffffff" opacity="0.8" />
              <path d="M80 24 Q86 12 94 14" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" />
            </g>

            {/* Sparkles */}
            <g className="sticker-particle-p1">
              <polygon points="116,42 118,36 120,42 126,44 120,46 118,52 116,46 110,44" fill="#fde047" />
            </g>
          </svg>
        );

      case 'teddy':
        return (
          <svg viewBox="0 0 160 160" width="112" height="112" className="sticker-3d-graphic">
            <defs>
              <radialGradient id={`bearFur_${uid}`} cx="40%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="60%" stopColor="#b45309" />
                <stop offset="100%" stopColor="#78350f" />
              </radialGradient>
              <radialGradient id={`bearSnout_${uid}`} cx="40%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#fef3c7" />
                <stop offset="100%" stopColor="#fde68a" />
              </radialGradient>
              <radialGradient id={`teddyHeart_${uid}`} cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#f472b6" />
                <stop offset="60%" stopColor="#ec4899" />
                <stop offset="100%" stopColor="#be185d" />
              </radialGradient>
              <filter id={`teddyGlow_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#f59e0b" floodOpacity="0.4" />
              </filter>
            </defs>

            <g filter={`url(#teddyGlow_${uid})`}>
              {/* Ears */}
              <circle cx="50" cy="44" r="14" fill={`url(#bearFur_${uid})`} />
              <circle cx="50" cy="44" r="8" fill="#fde68a" opacity="0.8" />
              <circle cx="110" cy="44" r="14" fill={`url(#bearFur_${uid})`} />
              <circle cx="110" cy="44" r="8" fill="#fde68a" opacity="0.8" />

              {/* Head */}
              <circle cx="80" cy="62" r="30" fill={`url(#bearFur_${uid})`} />

              {/* Muzzle Snout */}
              <ellipse cx="80" cy="70" rx="14" ry="10" fill={`url(#bearSnout_${uid})`} />
              {/* Heart Nose */}
              <polygon points="76,66 84,66 80,72" fill="#451a03" />
              {/* Smile */}
              <path d="M76 74 Q80 78 84 74" fill="none" stroke="#451a03" strokeWidth="1.5" strokeLinecap="round" />

              {/* Eyes */}
              <circle cx="68" cy="58" r="4.5" fill="#1c0a00" />
              <circle cx="66.5" cy="56.5" r="1.5" fill="#ffffff" />
              <circle cx="92" cy="58" r="4.5" fill="#1c0a00" />
              <circle cx="90.5" cy="56.5" r="1.5" fill="#ffffff" />

              {/* Teddy Body */}
              <ellipse cx="80" cy="114" rx="28" ry="26" fill={`url(#bearFur_${uid})`} />

              {/* Glowing Heart hugged in paws */}
              <path
                d="M80 126 C72 118 52 102 52 86 C52 74 62 66 72 66 C77 66 79 69 80 72 C81 69 83 66 88 66 C98 66 108 74 108 86 C108 102 88 118 80 126 Z"
                fill={`url(#teddyHeart_${uid})`}
                filter="drop-shadow(0 0 10px rgba(236,72,153,0.8))"
              />
              <circle cx="68" cy="78" r="3.5" fill="#ffffff" opacity="0.7" />

              {/* Hugging Paws */}
              <circle cx="56" cy="94" r="11" fill={`url(#bearFur_${uid})`} />
              <circle cx="104" cy="94" r="11" fill={`url(#bearFur_${uid})`} />
            </g>

            {/* Sparkles */}
            <g className="sticker-particle-p1">
              <polygon points="122,80 124,74 126,80 132,82 126,84 124,90 122,84 116,82" fill="#fde047" />
            </g>
          </svg>
        );

      case 'ring':
        return (
          <svg viewBox="0 0 160 160" width="115" height="115" className="sticker-3d-graphic">
            <defs>
              <linearGradient id={`velvetBox_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1e3a8a" />
                <stop offset="60%" stopColor="#172554" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
              <linearGradient id={`goldRingBand_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="40%" stopColor="#e2e8f0" />
                <stop offset="80%" stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#64748b" />
              </linearGradient>
              <linearGradient id={`ringDia_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="45%" stopColor="#a5f3fc" />
                <stop offset="85%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
              <filter id={`ringGlow_${uid}`} x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="8" stdDeviation="14" floodColor="#38bdf8" floodOpacity="0.65" />
              </filter>
            </defs>

            <g filter={`url(#ringGlow_${uid})`}>
              {/* Open Box Lid (Tilted Up) */}
              <polygon points="32,60 80,36 128,60 80,74" fill={`url(#velvetBox_${uid})`} stroke="#3b82f6" strokeWidth="1" />
              <polygon points="32,60 80,74 80,68 32,54" fill="#172554" />
              <polygon points="80,74 128,60 128,54 80,68" fill="#0f172a" />

              {/* Lower Box Body */}
              <polygon points="28,78 80,102 132,78 132,122 80,146 28,122" fill={`url(#velvetBox_${uid})`} />
              {/* Velvet Cushion Slot */}
              <ellipse cx="80" cy="100" rx="36" ry="16" fill="#020617" stroke="#1d4ed8" strokeWidth="2" />
              <ellipse cx="80" cy="100" rx="30" ry="12" fill="#ffffff" opacity="0.15" />

              {/* 3D Platinum Ring Band */}
              <ellipse cx="80" cy="88" rx="22" ry="24" fill="none" stroke={`url(#goldRingBand_${uid})`} strokeWidth="5.5" />
              <ellipse cx="80" cy="88" rx="22" ry="24" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.8" />

              {/* 4-Prong Setting */}
              <polygon points="76,64 84,64 82,70 78,70" fill="#cbd5e1" />

              {/* Dazzling Solitaire Diamond */}
              <polygon points="66,54 94,54 102,64 80,82 58,64" fill={`url(#ringDia_${uid})`} stroke="#ffffff" strokeWidth="1.5" />
              <polygon points="72,54 88,54 80,64" fill="#ffffff" opacity="0.85" />
              <polygon points="66,54 80,64 58,64" fill="#bae6fd" opacity="0.75" />
              <polygon points="94,54 80,64 102,64" fill="#7dd3fc" opacity="0.75" />
            </g>

            {/* Dazzling Starburst Flares */}
            <g className="sticker-particle-p1">
              <polygon points="80,36 82,48 94,50 82,52 80,64 78,52 66,50 78,48" fill="#ffffff" />
              <circle cx="80" cy="50" r="4" fill="#ffffff" />
            </g>
            <g className="sticker-particle-p2">
              <polygon points="112,68 114,62 116,68 122,70 116,72 114,78 112,72 106,70" fill="#38bdf8" />
            </g>
          </svg>
        );

      case 'supercar':
        return (
          <svg viewBox="0 0 160 160" width="118" height="118" className="sticker-3d-graphic">
            <defs>
              <linearGradient id={`carBody_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="50%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
              <linearGradient id={`carGlass_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0f172a" />
                <stop offset="70%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
              <filter id={`carGlow_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="10" stdDeviation="14" floodColor="#06b6d4" floodOpacity="0.6" />
              </filter>
            </defs>

            {/* Neon Underglow Ground Beam */}
            <ellipse cx="80" cy="126" rx="60" ry="14" fill="#06b6d4" opacity="0.45" filter="blur(6px)" />

            <g filter={`url(#carGlow_${uid})`}>
              {/* Aerodynamic Hypercar Body */}
              <path
                d="M18 106 L34 86 L62 76 L112 76 L138 92 L144 104 L142 116 L18 116 Z"
                fill={`url(#carBody_${uid})`}
              />

              {/* Tinted Glass Cockpit Dome */}
              <polygon points="46,84 66,62 106,62 122,84" fill={`url(#carGlass_${uid})`} stroke="#38bdf8" strokeWidth="1" />
              {/* Windshield Reflection Streak */}
              <polygon points="56,80 70,66 78,66 64,80" fill="#ffffff" opacity="0.6" />

              {/* Rear Aerodynamic Spoiler */}
              <polygon points="18,84 32,84 28,88 16,88" fill="#0f172a" />
              <rect x="22" y="88" width="4" height="12" fill="#1e293b" />

              {/* Wheels */}
              {/* Front Wheel */}
              <circle cx="118" cy="116" r="14" fill="#0f172a" stroke="#06b6d4" strokeWidth="3" />
              <circle cx="118" cy="116" r="6" fill="#94a3b8" />
              {/* Rear Wheel */}
              <circle cx="44" cy="116" r="14" fill="#0f172a" stroke="#06b6d4" strokeWidth="3" />
              <circle cx="44" cy="116" r="6" fill="#94a3b8" />

              {/* Laser Headlights */}
              <polygon points="138,98 144,102 140,106" fill="#fef08a" filter="drop-shadow(0 0 6px #fef08a)" />
              {/* Headlight Light Cone */}
              <polygon points="144,102 158,94 158,112" fill="#38bdf8" opacity="0.65" />

              {/* Side Air Intake Vent */}
              <polygon points="68,96 86,96 78,104" fill="#0f172a" />
            </g>

            {/* Speed Particles */}
            <circle cx="20" cy="100" r="2" fill="#38bdf8" className="sticker-particle-p1" />
            <circle cx="12" cy="112" r="3" fill="#06b6d4" className="sticker-particle-p2" />
          </svg>
        );

      case 'castle':
        return (
          <svg viewBox="0 0 160 160" width="115" height="115" className="sticker-3d-graphic">
            <defs>
              <linearGradient id={`castleStone_${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="60%" stopColor="#4f46e5" />
                <stop offset="100%" stopColor="#312e81" />
              </linearGradient>
              <linearGradient id={`castleRoof_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fde047" />
                <stop offset="60%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#a16207" />
              </linearGradient>
              <filter id={`castleGlow_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#818cf8" floodOpacity="0.5" />
              </filter>
            </defs>

            <g filter={`url(#castleGlow_${uid})`}>
              {/* Main Keep Wall */}
              <rect x="44" y="80" width="72" height="54" fill={`url(#castleStone_${uid})`} />
              {/* Battlements */}
              <rect x="44" y="74" width="12" height="8" fill="#4338ca" />
              <rect x="62" y="74" width="12" height="8" fill="#4338ca" />
              <rect x="86" y="74" width="12" height="8" fill="#4338ca" />
              <rect x="104" y="74" width="12" height="8" fill="#4338ca" />

              {/* Left Tower */}
              <rect x="26" y="60" width="22" height="74" fill={`url(#castleStone_${uid})`} />
              <polygon points="22,60 37,28 52,60" fill={`url(#castleRoof_${uid})`} />
              {/* Left Flag */}
              <polygon points="37,28 37,18 48,23" fill="#ef4444" />

              {/* Right Tower */}
              <rect x="112" y="60" width="22" height="74" fill={`url(#castleStone_${uid})`} />
              <polygon points="108,60 123,28 138,60" fill={`url(#castleRoof_${uid})`} />
              {/* Right Flag */}
              <polygon points="123,28 123,18 134,23" fill="#ef4444" />

              {/* Center Grand Spire */}
              <rect x="68" y="50" width="24" height="34" fill={`url(#castleStone_${uid})`} />
              <polygon points="62,50 80,12 98,50" fill={`url(#castleRoof_${uid})`} />
              {/* Center Golden Flag */}
              <polygon points="80,12 80,2 94,7" fill="#fde047" />

              {/* Arched Portcullis Gate */}
              <path d="M70 134 L70 106 C70 98 90 98 90 106 L90 134 Z" fill="#0f172a" />
              <circle cx="80" cy="104" r="5" fill="#fef08a" opacity="0.8" />
            </g>

            {/* Magical Fireworks & Starbursts */}
            <g className="sticker-particle-p1">
              <polygon points="18,36 20,30 22,36 28,38 22,40 20,46 18,40 12,38" fill="#fde047" />
            </g>
            <g className="sticker-particle-p2">
              <polygon points="142,42 144,36 146,42 152,44 146,46 144,52 142,46 136,44" fill="#a855f7" />
            </g>
          </svg>
        );

      case 'ufo':
        return (
          <svg viewBox="0 0 160 160" width="115" height="115" className="sticker-3d-graphic">
            <defs>
              <linearGradient id={`ufoHull_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e2e8f0" />
                <stop offset="45%" stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#334155" />
              </linearGradient>
              <linearGradient id={`ufoBeam_${uid}`} x1="50%" y1="0%" x2="50%" y2="100%">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.8" />
                <stop offset="70%" stopColor="#06b6d4" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#0891b2" stopOpacity="0.05" />
              </linearGradient>
              <filter id={`ufoGlow_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="8" stdDeviation="14" floodColor="#22d3ee" floodOpacity="0.65" />
              </filter>
            </defs>

            {/* Glowing Tractor Beam Cone */}
            <polygon points="68,82 92,82 136,148 24,148" fill={`url(#ufoBeam_${uid})`} />
            <ellipse cx="80" cy="148" rx="56" ry="10" fill="#22d3ee" opacity="0.35" />

            {/* Sparks rising up in Tractor Beam */}
            <circle cx="80" cy="130" r="3.5" fill="#ffffff" className="sticker-particle-p1" />
            <circle cx="72" cy="108" r="2.5" fill="#a5f3fc" className="sticker-particle-p2" />
            <circle cx="88" cy="116" r="3" fill="#fde047" className="sticker-particle-p1" />

            <g filter={`url(#ufoGlow_${uid})`}>
              {/* Glass Cockpit Dome */}
              <ellipse cx="80" cy="54" rx="26" ry="22" fill="#06b6d4" opacity="0.9" />
              <ellipse cx="76" cy="46" rx="14" ry="7" fill="#ffffff" opacity="0.75" />

              {/* Metallic Flying Saucer Hull */}
              <ellipse cx="80" cy="72" rx="60" ry="16" fill={`url(#ufoHull_${uid})`} />
              <ellipse cx="80" cy="76" rx="48" ry="10" fill="#1e293b" />

              {/* Rotating Perimeter Neon Lights */}
              <circle cx="36" cy="73" r="3.5" fill="#fde047" />
              <circle cx="56" cy="77" r="3.5" fill="#22d3ee" />
              <circle cx="80" cy="78" r="4" fill="#a855f7" />
              <circle cx="104" cy="77" r="3.5" fill="#22d3ee" />
              <circle cx="124" cy="73" r="3.5" fill="#fde047" />
            </g>
          </svg>
        );

      case 'box':
      case 'giftbox':
        return (
          <svg viewBox="0 0 160 160" width="130" height="130" className="sticker-3d-graphic">
            <defs>
              <linearGradient id={`boxTop_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f43f5e" />
                <stop offset="100%" stopColor="#be123c" />
              </linearGradient>
              <linearGradient id={`boxLeft_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#be123c" />
                <stop offset="100%" stopColor="#881337" />
              </linearGradient>
              <linearGradient id={`boxRight_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#9f1239" />
                <stop offset="100%" stopColor="#4c0519" />
              </linearGradient>
              <linearGradient id={`ribbonGold_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>
              <filter id={`boxShadow_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="12" stdDeviation="12" floodColor="#f43f5e" floodOpacity="0.5" />
              </filter>
            </defs>

            {/* 3D Isometric Drop Shadow */}
            <ellipse cx="80" cy="144" rx="46" ry="12" fill="#000000" opacity="0.45" />

            {/* 3D Gift Box Main Body */}
            <g filter={`url(#boxShadow_${uid})`}>
              {/* Left Side Face */}
              <polygon points="34,76 80,102 80,138 34,112" fill={`url(#boxLeft_${uid})`} />
              {/* Right Side Face */}
              <polygon points="80,102 126,76 126,112 80,138" fill={`url(#boxRight_${uid})`} />
              {/* Left Face Ribbon */}
              <polygon points="53,87 61,91 61,127 53,123" fill={`url(#ribbonGold_${uid})`} />
              {/* Right Face Ribbon */}
              <polygon points="99,91 107,87 107,123 99,127" fill={`url(#ribbonGold_${uid})`} />

              {/* 3D Lid (Slightly larger overhang) */}
              <polygon points="30,68 80,96 80,103 30,75" fill="#be123c" />
              <polygon points="80,96 130,68 130,75 80,103" fill="#881337" />
              <polygon points="80,40 130,68 80,96 30,68" fill={`url(#boxTop_${uid})`} />

              {/* Top Face Gold Ribbons */}
              <polygon points="52,54 58,51 108,79 102,82" fill={`url(#ribbonGold_${uid})`} />
              <polygon points="102,54 108,51 58,79 52,82" fill={`url(#ribbonGold_${uid})`} />

              {/* Specular Highlight on Lid Rim */}
              <polyline points="30,68 80,96 130,68" fill="none" stroke="#fda4af" strokeWidth="1.5" opacity="0.8" />

              {/* 3D Golden Bow on Top */}
              <g className="sticker-flame-core">
                <path d="M80 66 C65 42 42 46 60 64 C68 70 76 68 80 66 Z" fill={`url(#ribbonGold_${uid})`} />
                <path d="M80 66 C95 42 118 46 100 64 C92 70 84 68 80 66 Z" fill={`url(#ribbonGold_${uid})`} />
                <ellipse cx="80" cy="66" rx="7" ry="5.5" fill="#fef08a" stroke="#d97706" strokeWidth="1" />
                <path d="M78 68 C74 76 64 82 58 84 C62 81 72 74 76 68 Z" fill={`url(#ribbonGold_${uid})`} />
                <path d="M82 68 C86 76 96 82 102 84 C98 81 88 74 84 68 Z" fill={`url(#ribbonGold_${uid})`} />
              </g>
            </g>

            {/* Floating Magical Golden Sparks */}
            <g className="sticker-particle-p1">
              <polygon points="26,44 28,38 30,44 36,46 30,48 28,54 26,48 20,46" fill="#fef08a" />
            </g>
            <g className="sticker-particle-p2">
              <polygon points="134,36 136,30 138,36 144,38 138,40 136,46 134,40 128,38" fill="#f59e0b" />
            </g>
          </svg>
        );

      case 'rolex':
        return (
          <svg viewBox="0 0 160 160" width="115" height="115" className="sticker-3d-graphic">
            <defs>
              <linearGradient id={`goldLug_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="50%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#a16207" />
              </linearGradient>
              <radialGradient id={`dial_${uid}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#064e3b" />
                <stop offset="70%" stopColor="#022c22" />
                <stop offset="100%" stopColor="#000000" />
              </radialGradient>
              <filter id={`rolexGlow_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#eab308" floodOpacity="0.5" />
              </filter>
            </defs>
            <ellipse cx="80" cy="142" rx="42" ry="8" fill="#000" opacity="0.35" />
            <g filter={`url(#rolexGlow_${uid})`}>
              <rect x="66" y="16" width="28" height="34" rx="4" fill={`url(#goldLug_${uid})`} />
              <rect x="66" y="110" width="28" height="34" rx="4" fill={`url(#goldLug_${uid})`} />
              <line x1="75" y1="16" x2="75" y2="50" stroke="#ca8a04" strokeWidth="1.5" />
              <line x1="85" y1="16" x2="85" y2="50" stroke="#ca8a04" strokeWidth="1.5" />
              <line x1="75" y1="110" x2="75" y2="144" stroke="#ca8a04" strokeWidth="1.5" />
              <line x1="85" y1="110" x2="85" y2="144" stroke="#ca8a04" strokeWidth="1.5" />

              <circle cx="80" cy="80" r="42" fill={`url(#goldLug_${uid})`} />
              <circle cx="80" cy="80" r="37" fill="#ca8a04" stroke="#fef08a" strokeWidth="2" strokeDasharray="3 2" />
              <circle cx="80" cy="80" r="33" fill={`url(#dial_${uid})`} />

              {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg, i) => (
                <line
                  key={i}
                  x1="80" y1="52" x2="80" y2="57"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  transform={`rotate(${deg} 80 80)`}
                />
              ))}

              <polygon points="78,54 82,54 83,50 80,48 77,50" fill="#fef08a" />
              <line x1="80" y1="80" x2="98" y2="68" stroke="#fef08a" strokeWidth="3" strokeLinecap="round" />
              <line x1="80" y1="80" x2="72" y2="60" stroke="#fef08a" strokeWidth="2" strokeLinecap="round" />
              <line x1="80" y1="80" x2="86" y2="102" stroke="#ef4444" strokeWidth="1" />
              <circle cx="80" cy="80" r="3" fill="#fef08a" />
              <rect x="99" y="74" width="10" height="12" rx="2" fill="#ffffff" opacity="0.3" stroke="#fef08a" strokeWidth="1" />
            </g>
            <g className="sticker-particle-p1">
              <polygon points="128,40 130,34 132,40 138,42 132,44 130,50 128,44 122,42" fill="#fef08a" />
            </g>
          </svg>
        );

      case 'perfume':
        return (
          <svg viewBox="0 0 160 160" width="115" height="115" className="sticker-3d-graphic">
            <defs>
              <linearGradient id={`perfumeGlass_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fdf2f8" stopOpacity="0.9" />
                <stop offset="40%" stopColor="#f472b6" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#be185d" stopOpacity="0.85" />
              </linearGradient>
              <linearGradient id={`goldCap_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>
              <filter id={`perfumeGlow_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#ec4899" floodOpacity="0.45" />
              </filter>
            </defs>
            <ellipse cx="80" cy="142" rx="44" ry="10" fill="#000" opacity="0.3" />
            <g filter={`url(#perfumeGlow_${uid})`}>
              <rect x="68" y="24" width="24" height="20" rx="3" fill="#18181b" stroke="#f59e0b" strokeWidth="1.5" />
              <rect x="74" y="44" width="12" height="10" fill={`url(#goldCap_${uid})`} />
              <rect x="44" y="54" width="72" height="82" rx="14" fill={`url(#perfumeGlass_${uid})`} stroke="#ffffff" strokeWidth="1.5" />
              <path d="M50 62 L60 62 L54 128 L48 128 Z" fill="#ffffff" opacity="0.6" />
              <rect x="58" y="78" width="44" height="34" rx="4" fill="rgba(255,255,255,0.2)" stroke="#fef08a" strokeWidth="1" />
              <text x="80" y="96" fill="#ffffff" fontSize="9" fontWeight="900" textAnchor="middle" letterSpacing="1.5">PULSE</text>
              <text x="80" y="106" fill="#fef08a" fontSize="6.5" fontWeight="700" textAnchor="middle">PARFUM</text>
            </g>
            <circle cx="80" cy="18" r="3" fill="#f472b6" opacity="0.8" className="sticker-particle-p1" />
            <circle cx="92" cy="12" r="2.5" fill="#fde047" opacity="0.9" className="sticker-particle-p2" />
            <circle cx="68" cy="14" r="2" fill="#f472b6" opacity="0.7" className="sticker-particle-p1" />
          </svg>
        );

      case 'guitar':
        return (
          <svg viewBox="0 0 160 160" width="115" height="115" className="sticker-3d-graphic">
            <defs>
              <linearGradient id={`guitarBody_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="40%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#7f1d1d" />
              </linearGradient>
              <filter id={`guitarGlow_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="6" stdDeviation="12" floodColor="#ef4444" floodOpacity="0.55" />
              </filter>
            </defs>
            <ellipse cx="80" cy="142" rx="40" ry="8" fill="#000" opacity="0.3" />
            <g filter={`url(#guitarGlow_${uid})`}>
              <rect x="74" y="16" width="12" height="65" fill="#78350f" stroke="#451a03" strokeWidth="1" />
              <polygon points="72,16 88,16 86,2 74,4" fill="#18181b" />
              <circle cx="70" cy="6" r="2.5" fill="#fef08a" />
              <circle cx="70" cy="11" r="2.5" fill="#fef08a" />
              <circle cx="90" cy="6" r="2.5" fill="#fef08a" />
              <circle cx="90" cy="11" r="2.5" fill="#fef08a" />

              <path
                d="M62 70 C48 74 38 88 42 106 C46 126 64 142 80 142 C96 142 114 126 118 106 C122 88 112 74 98 70 C106 62 108 52 104 46 C100 40 94 48 90 58 L70 58 C66 48 60 40 56 46 C52 52 54 62 62 70 Z"
                fill={`url(#guitarBody_${uid})`}
              />

              <path d="M72 74 C64 78 58 88 62 102 C66 114 78 120 86 116 C88 104 86 86 82 74 Z" fill="#ffffff" opacity="0.9" />
              <rect x="76" y="86" width="8" height="4" rx="1" fill="#18181b" />
              <rect x="76" y="96" width="8" height="4" rx="1" fill="#18181b" />
              <rect x="75" y="112" width="10" height="6" fill="#94a3b8" />

              <line x1="77" y1="16" x2="77" y2="114" stroke="#ffffff" strokeWidth="1" opacity="0.9" />
              <line x1="80" y1="16" x2="80" y2="114" stroke="#ffffff" strokeWidth="1" opacity="0.9" />
              <line x1="83" y1="16" x2="83" y2="114" stroke="#ffffff" strokeWidth="1" opacity="0.9" />
            </g>
            <g className="sticker-particle-p1">
              <text x="34" y="60" fill="#fef08a" fontSize="16" fontWeight="bold">♪</text>
            </g>
            <g className="sticker-particle-p2">
              <text x="120" y="70" fill="#ef4444" fontSize="18" fontWeight="bold">♫</text>
            </g>
          </svg>
        );

      case 'jet':
        return (
          <svg viewBox="0 0 160 160" width="120" height="120" className="sticker-3d-graphic">
            <defs>
              <linearGradient id={`jetHull_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="60%" stopColor="#cbd5e1" />
                <stop offset="100%" stopColor="#64748b" />
              </linearGradient>
              <linearGradient id={`jetWindow_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0369a1" />
              </linearGradient>
              <filter id={`jetGlow_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#38bdf8" floodOpacity="0.45" />
              </filter>
            </defs>
            <ellipse cx="80" cy="140" rx="46" ry="8" fill="#000" opacity="0.25" />
            <line x1="56" y1="102" x2="38" y2="136" stroke="#e0f2fe" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
            <line x1="104" y1="102" x2="122" y2="136" stroke="#e0f2fe" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
            <g filter={`url(#jetGlow_${uid})`}>
              <polygon points="80,74 20,96 28,102 78,86" fill={`url(#jetHull_${uid})`} />
              <polygon points="80,74 140,96 132,102 82,86" fill={`url(#jetHull_${uid})`} />
              <circle cx="20" cy="96" r="2.5" fill="#ef4444" />
              <circle cx="140" cy="96" r="2.5" fill="#10b981" />

              <polygon points="80,108 52,122 56,126 80,118" fill="#94a3b8" />
              <polygon points="80,108 108,122 104,126 80,118" fill="#94a3b8" />
              <polygon points="78,98 82,98 83,78 77,78" fill="#cbd5e1" />

              <ellipse cx="80" cy="74" rx="12" ry="48" fill={`url(#jetHull_${uid})`} />
              <ellipse cx="80" cy="38" rx="7" ry="9" fill={`url(#jetWindow_${uid})`} />
              <circle cx="75" cy="56" r="2" fill={`url(#jetWindow_${uid})`} />
              <circle cx="75" cy="64" r="2" fill={`url(#jetWindow_${uid})`} />
              <circle cx="75" cy="72" r="2" fill={`url(#jetWindow_${uid})`} />
              <circle cx="75" cy="80" r="2" fill={`url(#jetWindow_${uid})`} />
              <circle cx="85" cy="56" r="2" fill={`url(#jetWindow_${uid})`} />
              <circle cx="85" cy="64" r="2" fill={`url(#jetWindow_${uid})`} />
              <circle cx="85" cy="72" r="2" fill={`url(#jetWindow_${uid})`} />
              <circle cx="85" cy="80" r="2" fill={`url(#jetWindow_${uid})`} />
            </g>
          </svg>
        );

      case 'yacht':
        return (
          <svg viewBox="0 0 160 160" width="120" height="120" className="sticker-3d-graphic">
            <defs>
              <linearGradient id={`yachtHull_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="70%" stopColor="#e2e8f0" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
              <filter id={`yachtGlow_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#06b6d4" floodOpacity="0.4" />
              </filter>
            </defs>
            <ellipse cx="80" cy="132" rx="60" ry="12" fill="#0284c7" opacity="0.75" />
            <ellipse cx="80" cy="135" rx="48" ry="7" fill="#38bdf8" opacity="0.6" />
            <g filter={`url(#yachtGlow_${uid})`}>
              <path d="M24 116 L44 130 L116 130 L136 116 L124 102 L36 102 Z" fill={`url(#yachtHull_${uid})`} />
              <rect x="42" y="86" width="76" height="18" rx="4" fill="#ffffff" />
              <rect x="48" y="90" width="64" height="8" rx="2" fill="#0f172a" />
              <rect x="54" y="70" width="52" height="16" rx="4" fill="#f8fafc" />
              <rect x="58" y="74" width="44" height="7" rx="2" fill="#0284c7" />
              <line x1="80" y1="70" x2="80" y2="56" stroke="#94a3b8" strokeWidth="2.5" />
              <ellipse cx="80" cy="56" rx="10" ry="3" fill="#38bdf8" />
            </g>
          </svg>
        );

      case 'galaxy':
        return (
          <svg viewBox="0 0 160 160" width="120" height="120" className="sticker-3d-graphic">
            <defs>
              <radialGradient id={`cosmicCore_${uid}`} cx="40%" cy="40%" r="60%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="25%" stopColor="#38bdf8" />
                <stop offset="55%" stopColor="#a855f7" />
                <stop offset="85%" stopColor="#4c1d95" />
                <stop offset="100%" stopColor="#09090b" />
              </radialGradient>
              <linearGradient id={`ringGrad_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f472b6" />
                <stop offset="50%" stopColor="#60a5fa" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
              <filter id={`cosmicGlow_${uid}`} x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="16" floodColor="#a855f7" floodOpacity="0.8" />
              </filter>
            </defs>
            <g filter={`url(#cosmicGlow_${uid})`}>
              <ellipse cx="80" cy="80" rx="58" ry="18" fill="none" stroke={`url(#ringGrad_${uid})`} strokeWidth="4" strokeDasharray="90 100" transform="rotate(-25 80 80)" />
              <circle cx="80" cy="80" r="38" fill={`url(#cosmicCore_${uid})`} />
              <circle cx="72" cy="74" r="3" fill="#ffffff" opacity="0.9" />
              <circle cx="88" cy="84" r="2.5" fill="#fde047" opacity="0.8" />
              <circle cx="76" cy="90" r="2" fill="#67e8f9" opacity="0.9" />
              <ellipse cx="80" cy="80" rx="58" ry="18" fill="none" stroke={`url(#ringGrad_${uid})`} strokeWidth="4" strokeDasharray="100 90" strokeDashoffset="90" transform="rotate(-25 80 80)" />
            </g>
            <g className="sticker-particle-p1">
              <polygon points="128,34 130,28 132,34 138,36 132,38 130,44 128,38 122,36" fill="#fde047" />
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
    <div
      className="sticker-3d-container"
      onClick={onClick}
      style={{ userSelect: 'none', cursor: onClick ? 'pointer' : 'default' }}
    >
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

          {giftId === 'giftbox' && (
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                color: '#f43f5e',
                background: 'rgba(244, 63, 94, 0.16)',
                border: '1px solid rgba(244, 63, 94, 0.35)',
                borderRadius: '12px',
                padding: '2px 8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                cursor: 'pointer'
              }}
            >
              🎁 Tap to open
            </span>
          )}

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
