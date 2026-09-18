export const POLL_THEMES = [
  {
    id: 'purple',
    name: 'Pulse Purple',
    primary: '#6366f1',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    bgLight: 'rgba(99, 102, 241, 0.12)',
    barBg: 'rgba(99, 102, 241, 0.28)',
    border: 'rgba(99, 102, 241, 0.4)',
    color: '#a5b4fc'
  },
  {
    id: 'emerald',
    name: 'Mint Emerald',
    primary: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
    bgLight: 'rgba(16, 185, 129, 0.12)',
    barBg: 'rgba(16, 185, 129, 0.28)',
    border: 'rgba(16, 185, 129, 0.4)',
    color: '#6ee7b7'
  },
  {
    id: 'ocean',
    name: 'Ocean Blue',
    primary: '#0ea5e9',
    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)',
    bgLight: 'rgba(14, 165, 233, 0.12)',
    barBg: 'rgba(14, 165, 233, 0.28)',
    border: 'rgba(14, 165, 233, 0.4)',
    color: '#7dd3fc'
  },
  {
    id: 'sunset',
    name: 'Sunset Coral',
    primary: '#f97316',
    gradient: 'linear-gradient(135deg, #f97316 0%, #f43f5e 100%)',
    bgLight: 'rgba(249, 115, 22, 0.12)',
    barBg: 'rgba(249, 115, 22, 0.28)',
    border: 'rgba(249, 115, 22, 0.4)',
    color: '#fdba74'
  },
  {
    id: 'rose',
    name: 'Neon Rose',
    primary: '#ec4899',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)',
    bgLight: 'rgba(236, 72, 153, 0.12)',
    barBg: 'rgba(236, 72, 153, 0.28)',
    border: 'rgba(236, 72, 153, 0.4)',
    color: '#f472b6'
  },
  {
    id: 'amber',
    name: 'Cyber Gold',
    primary: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
    bgLight: 'rgba(245, 158, 11, 0.12)',
    barBg: 'rgba(245, 158, 11, 0.28)',
    border: 'rgba(245, 158, 11, 0.4)',
    color: '#fcd34d'
  }
];

export const getPollTheme = (themeId) => {
  return POLL_THEMES.find(t => t.id === themeId) || POLL_THEMES[0];
};
