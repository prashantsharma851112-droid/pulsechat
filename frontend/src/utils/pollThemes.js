// Poll design themes configuration
export const POLL_THEMES = [
  {
    id: 'indigo',
    name: 'Indigo',
    accent: '#6366f1',
    gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    barBg: 'rgba(99, 102, 241, 0.28)',
    border: 'rgba(99, 102, 241, 0.45)',
    headerColor: '#818cf8',
    previewColor: '#6366f1',
    bgBadge: 'rgba(99, 102, 241, 0.15)'
  },
  {
    id: 'emerald',
    name: 'Emerald',
    accent: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    barBg: 'rgba(16, 185, 129, 0.28)',
    border: 'rgba(16, 185, 129, 0.45)',
    headerColor: '#34d399',
    previewColor: '#10b981',
    bgBadge: 'rgba(16, 185, 129, 0.15)'
  },
  {
    id: 'ocean',
    name: 'Ocean',
    accent: '#06b6d4',
    gradient: 'linear-gradient(135deg, #06b6d4, #0284c7)',
    barBg: 'rgba(6, 182, 212, 0.28)',
    border: 'rgba(6, 182, 212, 0.45)',
    headerColor: '#38bdf8',
    previewColor: '#06b6d4',
    bgBadge: 'rgba(6, 182, 212, 0.15)'
  },
  {
    id: 'sunset',
    name: 'Sunset',
    accent: '#f97316',
    gradient: 'linear-gradient(135deg, #f97316, #ec4899)',
    barBg: 'rgba(249, 115, 22, 0.28)',
    border: 'rgba(249, 115, 22, 0.45)',
    headerColor: '#fb923c',
    previewColor: '#f97316',
    bgBadge: 'rgba(249, 115, 22, 0.15)'
  },
  {
    id: 'rose',
    name: 'Rose',
    accent: '#f43f5e',
    gradient: 'linear-gradient(135deg, #f43f5e, #be123c)',
    barBg: 'rgba(244, 63, 94, 0.28)',
    border: 'rgba(244, 63, 94, 0.45)',
    headerColor: '#fb7185',
    previewColor: '#f43f5e',
    bgBadge: 'rgba(244, 63, 94, 0.15)'
  },
  {
    id: 'violet',
    name: 'Violet',
    accent: '#a855f7',
    gradient: 'linear-gradient(135deg, #a855f7, #7c3aed)',
    barBg: 'rgba(168, 85, 247, 0.28)',
    border: 'rgba(168, 85, 247, 0.45)',
    headerColor: '#c084fc',
    previewColor: '#a855f7',
    bgBadge: 'rgba(168, 85, 247, 0.15)'
  },
  {
    id: 'amber',
    name: 'Amber',
    accent: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    barBg: 'rgba(245, 158, 11, 0.28)',
    border: 'rgba(245, 158, 11, 0.45)',
    headerColor: '#fbbf24',
    previewColor: '#f59e0b',
    bgBadge: 'rgba(245, 158, 11, 0.15)'
  },
  {
    id: 'midnight',
    name: 'Midnight',
    accent: '#64748b',
    gradient: 'linear-gradient(135deg, #475569, #1e293b)',
    barBg: 'rgba(100, 116, 139, 0.28)',
    border: 'rgba(100, 116, 139, 0.45)',
    headerColor: '#94a3b8',
    previewColor: '#64748b',
    bgBadge: 'rgba(100, 116, 139, 0.15)'
  }
];

export const getPollTheme = (themeId) => {
  return POLL_THEMES.find(t => t.id === themeId) || POLL_THEMES[0];
};
