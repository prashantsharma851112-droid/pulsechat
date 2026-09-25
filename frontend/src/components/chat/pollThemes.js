export const POLL_THEMES = [
  {
    id: 'purple',
    name: 'Pulse Purple',
    primary: '#6366f1',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    bgLight: 'rgba(99, 102, 241, 0.12)',
    barBg: 'rgba(99, 102, 241, 0.28)',
    border: 'rgba(99, 102, 241, 0.4)',
    color: '#a5b4fc',
    glow: 'rgba(99, 102, 241, 0.35)',
    isPro: false
  },
  {
    id: 'emerald',
    name: 'Mint Emerald',
    primary: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
    bgLight: 'rgba(16, 185, 129, 0.12)',
    barBg: 'rgba(16, 185, 129, 0.28)',
    border: 'rgba(16, 185, 129, 0.4)',
    color: '#6ee7b7',
    glow: 'rgba(16, 185, 129, 0.35)',
    isPro: true
  },
  {
    id: 'ocean',
    name: 'Ocean Blue',
    primary: '#0ea5e9',
    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)',
    bgLight: 'rgba(14, 165, 233, 0.12)',
    barBg: 'rgba(14, 165, 233, 0.28)',
    border: 'rgba(14, 165, 233, 0.4)',
    color: '#7dd3fc',
    glow: 'rgba(14, 165, 233, 0.35)',
    isPro: false
  },
  {
    id: 'sunset',
    name: 'Sunset Coral',
    primary: '#f97316',
    gradient: 'linear-gradient(135deg, #f97316 0%, #f43f5e 100%)',
    bgLight: 'rgba(249, 115, 22, 0.12)',
    barBg: 'rgba(249, 115, 22, 0.28)',
    border: 'rgba(249, 115, 22, 0.4)',
    color: '#fdba74',
    glow: 'rgba(249, 115, 22, 0.35)',
    isPro: true
  },
  {
    id: 'rose',
    name: 'Neon Rose',
    primary: '#ec4899',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)',
    bgLight: 'rgba(236, 72, 153, 0.12)',
    barBg: 'rgba(236, 72, 153, 0.28)',
    border: 'rgba(236, 72, 153, 0.4)',
    color: '#f472b6',
    glow: 'rgba(236, 72, 153, 0.35)',
    isPro: true
  },
  {
    id: 'amber',
    name: 'Cyber Gold',
    primary: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
    bgLight: 'rgba(245, 158, 11, 0.12)',
    barBg: 'rgba(245, 158, 11, 0.28)',
    border: 'rgba(245, 158, 11, 0.4)',
    color: '#fcd34d',
    glow: 'rgba(245, 158, 11, 0.35)',
    isPro: true
  }
];

export const getPollTheme = (themeId) => {
  return POLL_THEMES.find(t => t.id === themeId) || POLL_THEMES[0];
};

export const POLL_AURAS = [
  {
    id: 'standard',
    name: 'Standard Pulse',
    icon: '✨',
    desc: 'Clean subtle glow border',
    isPro: false,
    gradient: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    borderColor: 'rgba(99, 102, 241, 0.4)'
  },
  {
    id: 'gold-stardust',
    name: 'Gold Stardust 👑',
    icon: '👑',
    desc: 'Shimmering golden stardust aura',
    isPro: true,
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
    borderColor: '#f59e0b'
  },
  {
    id: 'cyber-matrix',
    name: 'Cyber Matrix 👑',
    icon: '⚡',
    desc: 'Matrix green neon scanner aura',
    isPro: true,
    gradient: 'linear-gradient(135deg, #10b981 0%, #22c55e 100%)',
    borderColor: '#10b981'
  },
  {
    id: 'flame-blaze',
    name: 'Inferno Blaze 👑',
    icon: '🔥',
    desc: 'Fiery magma ember border aura',
    isPro: true,
    gradient: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
    borderColor: '#ef4444'
  },
  {
    id: 'love-hearts',
    name: 'Love Hearts 👑',
    icon: '💖',
    desc: 'Floating pink hearts glow aura',
    isPro: true,
    gradient: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
    borderColor: '#ec4899'
  }
];

export const getPollAura = (auraId) => {
  return POLL_AURAS.find(a => a.id === auraId) || POLL_AURAS[0];
};
