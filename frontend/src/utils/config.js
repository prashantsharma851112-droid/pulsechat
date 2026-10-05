const getBackendUrl = () => {
  if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL;
  if (typeof window !== 'undefined') {
    // 1. Mobile App Container (Capacitor Android/iOS or Android WebView on phone)
    const isMobileApp = Boolean(
      window.Capacitor?.isNativePlatform?.() ||
      window.location.protocol === 'capacitor:' ||
      (window.location.hostname === 'localhost' && window.location.port === '' && /Android|iPhone|iPad/i.test(navigator.userAgent))
    );
    if (isMobileApp) {
      return 'https://pulsechat-api-v2.onrender.com';
    }

    const hostname = window.location.hostname;
    // Local PC development (Vite on port 5173 / localhost)
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }
    // Mobile / LAN Wi-Fi testing (e.g. 192.168.x.x, 10.x.x, 172.16-31.x.x)
    if (hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
      return `${window.location.protocol}//${hostname}:5000`;
    }
    // Hosted on Render / Cloud (frontend & backend served from same origin or custom domain)
    if (hostname.includes('onrender.com')) {
      return window.location.origin;
    }
  }
  return 'https://pulsechat-api-v2.onrender.com';
};

export const BACKEND_URL = getBackendUrl();
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '506857691919-p8rgd8v01840pmnrrc4n033faem9bgdi.apps.googleusercontent.com';

// Official Google AdMob Configuration
export const ADMOB_CONFIG = {
  APP_ID: 'ca-app-pub-8527648187361885~3463130025',
  REWARDED_ARROW_REVIVE_ID: 'ca-app-pub-8527648187361885/3025989630', // Pulse Arrow Revive (Rewarded)
  INTERSTITIAL_STORY_TRANSITION_ID: 'ca-app-pub-8527648187361885/1001538089', // Pulse Story Transition (Interstitial)
};

