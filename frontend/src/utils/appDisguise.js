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
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 512 512">
      <rect width="512" height="512" rx="128" fill="#0b0f19"/>
      <circle cx="256" cy="256" r="180" fill="url(#grad)" />
      <path d="M180 210 Q256 160 332 210 Q360 256 332 302 Q256 352 180 302 Q152 256 180 210 Z" fill="#ffffff" />
      <circle cx="215" cy="256" r="20" fill="#6366f1" />
      <circle cx="297" cy="256" r="20" fill="#6366f1" />
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#6366f1" />
          <stop offset="100%" stop-color="#4f46e5" />
        </linearGradient>
      </defs>
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

  // 3. Helper to update all head icon links with multi-resolution support (16x16, 32x32, 48x48, 192x192)
  const setFavicons = (iconsMap = {}) => {
    if (typeof document === 'undefined') return;
    try {
      // Remove all existing icon links to force browser & Windows OS titlebar to reload
      const existingIcons = document.querySelectorAll("link[rel*='icon'], link[rel='apple-touch-icon'], link[rel='shortcut icon']");
      existingIcons.forEach(el => el.remove());

      const addLink = (rel, mime, sizes, href) => {
        if (!href) return;
        const link = document.createElement('link');
        link.rel = rel;
        if (mime) link.type = mime;
        if (sizes) link.setAttribute('sizes', sizes);
        link.href = `${href}${href.startsWith('data:') ? '' : (href.includes('?') ? '&' : '?') + 'v=' + Date.now()}`;
        document.head.appendChild(link);
      };

      if (typeof iconsMap === 'string') {
        addLink('icon', 'image/png', '192x192', iconsMap);
        addLink('icon', 'image/png', '32x32', iconsMap);
        addLink('icon', 'image/png', '16x16', iconsMap);
        addLink('shortcut icon', 'image/png', '32x32', iconsMap);
        addLink('apple-touch-icon', 'image/png', '180x180', iconsMap);
      } else {
        if (iconsMap.png16) addLink('icon', 'image/png', '16x16', iconsMap.png16);
        if (iconsMap.png32) addLink('icon', 'image/png', '32x32', iconsMap.png32);
        if (iconsMap.png48) addLink('icon', 'image/png', '48x48', iconsMap.png48);
        if (iconsMap.png192) addLink('icon', 'image/png', '192x192', iconsMap.png192);
        if (iconsMap.png32 || iconsMap.png192) addLink('shortcut icon', 'image/png', '32x32', iconsMap.png32 || iconsMap.png192);
        if (iconsMap.png192) addLink('apple-touch-icon', 'image/png', '180x180', iconsMap.png192);
        if (iconsMap.svg) addLink('icon', 'image/svg+xml', 'any', iconsMap.svg);
      }
    } catch (e) {}
  };

  // Immediately apply initial icon link
  setFavicons(isDefault ? '/icon-192.png' : { svg: svgDataUri, png192: svgDataUri });

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
          { src: iconHref, sizes: "16x16", type: "image/png" },
          { src: iconHref, sizes: "32x32", type: "image/png" },
          { src: iconHref, sizes: "48x48", type: "image/png" },
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

  // 5. Multi-size Canvas PNG rendering: Windows titlebars specifically require 16x16 & 32x32 icons!
  if (!isDefault && typeof document !== 'undefined') {
    try {
      const svgBlob = new Blob([preset.iconSvg], { type: 'image/svg+xml;charset=utf-8' });
      const blobUrl = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        try {
          const renderPng = (sz) => {
            const canvas = document.createElement('canvas');
            canvas.width = sz;
            canvas.height = sz;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, sz, sz);
            return canvas.toDataURL('image/png');
          };

          const icons = {
            png16: renderPng(16),
            png32: renderPng(32),
            png48: renderPng(48),
            png192: renderPng(192),
            svg: svgDataUri
          };

          setFavicons(icons);
          updateManifest(icons.png192, preset.name);
          URL.revokeObjectURL(blobUrl);
        } catch (e) {
          URL.revokeObjectURL(blobUrl);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
      };
      img.src = blobUrl;
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

