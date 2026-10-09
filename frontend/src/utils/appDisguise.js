// App Disguise & Camouflage Utility (Fake App Icon & Name)
// Allows user to disguise PulseChat as Calculator, Notes, Weather, Clock, etc.

export const DISGUISE_PRESETS = [
  {
    id: 'default',
    name: 'PulseChat',
    subtitle: 'Original cyber-pulse AMOLED branding',
    title: 'PulseChat - Feel The Beat of Chatting',
    badge: 'Default',
    accentColor: '#a855f7',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
      <defs>
        <linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#c084fc"/>
          <stop offset="50%" stop-color="#a855f7"/>
          <stop offset="100%" stop-color="#6366f1"/>
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="#0d0b14"/>
      <path d="M34 8L16 34h14l-4 22 22-28H34l4-20z" fill="url(#pg)" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`
  },
  {
    id: 'calculator',
    name: 'Calculator',
    subtitle: 'Standard utility calculator look',
    title: 'Calculator',
    badge: 'Disguise',
    accentColor: '#f97316',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
      <rect width="64" height="64" rx="16" fill="#1c1917"/>
      <rect x="14" y="12" width="36" height="12" rx="4" fill="#292524" stroke="#44403c" stroke-width="1"/>
      <text x="44" y="21" font-family="-apple-system, system-ui, sans-serif" font-size="9" font-weight="700" fill="#a8a29e" text-anchor="end">0</text>
      <!-- Keypad grid -->
      <circle cx="20" cy="32" r="4.5" fill="#44403c"/>
      <circle cx="32" cy="32" r="4.5" fill="#44403c"/>
      <circle cx="44" cy="32" r="4.5" fill="#f97316"/>
      <circle cx="20" cy="43" r="4.5" fill="#44403c"/>
      <circle cx="32" cy="43" r="4.5" fill="#44403c"/>
      <circle cx="44" cy="43" r="4.5" fill="#f97316"/>
      <rect x="15.5" y="50" width="17" height="9" rx="4.5" fill="#44403c"/>
      <circle cx="44" cy="54.5" r="4.5" fill="#f97316"/>
    </svg>`
  },
  {
    id: 'notes',
    name: 'Quick Notes',
    subtitle: 'Private notepad & checklist appearance',
    title: 'Quick Notes',
    badge: 'Disguise',
    accentColor: '#eab308',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
      <rect width="64" height="64" rx="16" fill="#fef08a"/>
      <!-- Pad spiral / top bar -->
      <rect x="12" y="10" width="40" height="44" rx="6" fill="#ffffff" stroke="#ca8a04" stroke-width="1.5"/>
      <rect x="12" y="10" width="40" height="9" rx="3" fill="#facc15"/>
      <!-- Ruled lines -->
      <line x1="18" y1="26" x2="46" y2="26" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
      <line x1="18" y1="33" x2="42" y2="33" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
      <line x1="18" y1="40" x2="36" y2="40" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
      <!-- Pencil icon -->
      <path d="M40 48l8-8 4 4-8 8-5 1 1-5z" fill="#ea580c"/>
    </svg>`
  },
  {
    id: 'weather',
    name: 'Daily Weather',
    subtitle: 'Weather forecast & temperature widget',
    title: 'Weather 28°C - Partly Sunny',
    badge: 'Disguise',
    accentColor: '#38bdf8',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
      <defs>
        <linearGradient id="wg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#38bdf8"/>
          <stop offset="100%" stop-color="#0284c7"/>
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#wg)"/>
      <!-- Sun -->
      <circle cx="26" cy="25" r="11" fill="#facc15"/>
      <!-- Cloud -->
      <path d="M22 43h23a9 9 0 0 0 0-18 10 10 0 0 0-18-2 8 8 0 0 0-5 20z" fill="#ffffff" opacity="0.95"/>
    </svg>`
  },
  {
    id: 'clock',
    name: 'Clock & Timer',
    subtitle: 'Digital timer, clock & stopwatch style',
    title: 'Timer & Clock',
    badge: 'Disguise',
    accentColor: '#10b981',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
      <rect width="64" height="64" rx="16" fill="#0f172a"/>
      <!-- Outer clock dial -->
      <circle cx="32" cy="32" r="20" fill="#1e293b" stroke="#10b981" stroke-width="2.5"/>
      <!-- Center dot & hands -->
      <circle cx="32" cy="32" r="2" fill="#ffffff"/>
      <line x1="32" y1="32" x2="32" y2="19" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>
      <line x1="32" y1="32" x2="42" y2="32" stroke="#10b981" stroke-width="2" stroke-linecap="round"/>
    </svg>`
  }
];

export const getAppDisguise = () => {
  try {
    return localStorage.getItem('pulsechat_app_disguise') || 'default';
  } catch (e) {
    return 'default';
  }
};

export const applyAppDisguise = (disguiseId = 'default') => {
  const preset = DISGUISE_PRESETS.find(p => p.id === disguiseId) || DISGUISE_PRESETS[0];

  // 1. Update Document Title
  document.title = preset.title;

  // 2. Convert SVG into Data URI
  const svgDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(preset.iconSvg)}`;

  // 3. Dynamically replace or set Favicon and Apple Touch Icon
  const iconSelectors = [
    "link[rel*='icon']",
    "link[rel='apple-touch-icon']",
    "link[rel='shortcut icon']"
  ];

  iconSelectors.forEach(sel => {
    let link = document.querySelector(sel);
    if (!link) {
      link = document.createElement('link');
      if (sel.includes('apple')) {
        link.rel = 'apple-touch-icon';
      } else {
        link.rel = 'icon';
      }
      document.head.appendChild(link);
    }
    link.href = svgDataUri;
  });

  // 4. Save choice to localStorage
  try {
    localStorage.setItem('pulsechat_app_disguise', preset.id);
  } catch (e) {}

  // 5. Broadcast custom event
  try {
    window.dispatchEvent(new CustomEvent('pulsechat_app_disguise_changed', { detail: { disguise: preset } }));
  } catch (e) {}

  return preset;
};
