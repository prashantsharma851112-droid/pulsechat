// App Disguise & Camouflage Utility (Fake App Icon & Name)
// Allows user to disguise PulseChat as Calculator, Notes, Weather, Clock, etc.

export const DISGUISE_PRESETS = [
  {
    id: 'default',
    name: 'PulseChat',
    subtitle: 'Original cyber-pulse AMOLED branding',
    title: 'PulseChat - Feel The Beat of Chatting',
    badge: 'Default',
    accentColor: '#6366f1',
    iconUrl: '/icon-192.png',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
      <defs>
        <linearGradient id="pcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#2563eb"/>
          <stop offset="50%" stop-color="#4f46e5"/>
          <stop offset="100%" stop-color="#7c3aed"/>
        </linearGradient>
      </defs>
      <!-- Chat bubble container with tail -->
      <path d="M40 24h112a28 28 0 0 1 28 28v68a28 28 0 0 1-28 28H132l-22 22a4 4 0 0 1-6.8-2.8V148H40a28 28 0 0 1-28-28V52a28 28 0 0 1 28-28z" fill="url(#pcGrad)"/>
      <!-- Inner white rounded badge -->
      <rect x="28" y="38" width="136" height="96" rx="22" fill="#ffffff"/>
      <!-- Bold stylized P letter -->
      <path d="M52 56h34c14 0 23 8 23 20s-9 20-23 20H68v24H52V56zm16 13v14h18c5 0 8.5-3 8.5-7s-3.5-7-8.5-7H68z" fill="url(#pcGrad)"/>
      <!-- Heartbeat / ECG pulse waveform -->
      <path d="M98 90l7-16 9 32 9-24 7 10h18" fill="none" stroke="#2563eb" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
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
    title: 'Daily Weather',
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
    title: 'Clock & Timer',
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
  if (typeof document !== 'undefined') {
    document.title = preset.title;
  }

  // 2. Determine target icon URL
  const isDefault = preset.id === 'default';
  const svgDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(preset.iconSvg)}`;
  const initialIconUrl = isDefault ? '/icon-192.png' : svgDataUri;

  // 3. Helper to update all head icon links
  const setFavicons = (href, type = 'image/png') => {
    if (typeof document === 'undefined') return;
    try {
      // Remove all existing icon links to force Chrome/Android to reload & not stick to cached icons
      const existingIcons = document.querySelectorAll("link[rel*='icon'], link[rel='apple-touch-icon'], link[rel='shortcut icon']");
      existingIcons.forEach(el => el.remove());

      const addLink = (rel, mime) => {
        const link = document.createElement('link');
        link.rel = rel;
        if (mime) link.type = mime;
        link.href = `${href}${href.startsWith('data:') ? '' : (href.includes('?') ? '&' : '?') + 'v=' + Date.now()}`;
        document.head.appendChild(link);
      };

      addLink('icon', type);
      addLink('shortcut icon', type);
      addLink('apple-touch-icon', type);
    } catch (e) {}
  };

  // Immediately apply initial icon link
  setFavicons(initialIconUrl, isDefault ? 'image/png' : 'image/svg+xml');

  // 4. Update Web App Manifest dynamically so Android PWA / Home Screen uses disguise name & icon
  const updateManifest = (iconHref, appName) => {
    if (typeof document === 'undefined') return;
    try {
      let manifestLink = document.querySelector('link[rel="manifest"]');
      const dynamicManifest = {
        id: "com.pulsechat.app",
        short_name: appName,
        name: appName,
        start_url: "/",
        display: "standalone",
        background_color: "#000000",
        theme_color: "#000000",
        icons: [
          { src: iconHref, sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: iconHref, sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
      };
      const blob = new Blob([JSON.stringify(dynamicManifest)], { type: 'application/manifest+json' });
      const blobUrl = URL.createObjectURL(blob);
      if (!manifestLink) {
        manifestLink = document.createElement('link');
        manifestLink.rel = 'manifest';
        document.head.appendChild(manifestLink);
      }
      manifestLink.href = blobUrl;
    } catch (e) {}
  };

  // 5. For non-default SVG icons, convert SVG to PNG Data URL via offscreen canvas
  // Android Chrome, Samsung Internet, and mobile task switchers only render PNG icons!
  if (!isDefault && typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 192;
      canvas.height = 192;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          ctx.clearRect(0, 0, 192, 192);
          ctx.drawImage(img, 0, 0, 192, 192);
          const pngUrl = canvas.toDataURL('image/png');
          setFavicons(pngUrl, 'image/png');
          updateManifest(pngUrl, preset.name);
        } catch (e) {}
      };
      img.src = svgDataUri;
    } catch (e) {}
  } else {
    updateManifest('/icon-192.png', preset.name);
  }

  // 6. Update Mobile Meta tags
  if (typeof document !== 'undefined') {
    try {
      let appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (appleTitleMeta) appleTitleMeta.content = preset.name;
      let appNameMeta = document.querySelector('meta[name="application-name"]');
      if (!appNameMeta) {
        appNameMeta = document.createElement('meta');
        appNameMeta.name = 'application-name';
        document.head.appendChild(appNameMeta);
      }
      appNameMeta.content = preset.name;
    } catch (e) {}
  }

  // 7. Save choice to localStorage
  try {
    localStorage.setItem('pulsechat_app_disguise', preset.id);
  } catch (e) {}

  // 8. Broadcast custom event
  try {
    window.dispatchEvent(new CustomEvent('pulsechat_app_disguise_changed', { detail: { disguise: preset } }));
  } catch (e) {}

  return preset;
};

// Cross-tab synchronization so opening/switching tabs keeps camouflage in sync
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'pulsechat_app_disguise' && e.newValue) {
      applyAppDisguise(e.newValue);
    }
  });
}

