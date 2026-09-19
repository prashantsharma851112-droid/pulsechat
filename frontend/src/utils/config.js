const isLocalhost = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.')
);

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (isLocalhost ? 'http://localhost:5000' : 'https://pulsechat-xzul.onrender.com');
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '954329116717-ig5j0hpo8jmp4chvhqrub840dpb8lhf0.apps.googleusercontent.com';
