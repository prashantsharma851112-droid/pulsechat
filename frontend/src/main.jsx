import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { AuthProvider } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { AppMusicProvider } from './context/AppMusicContext.jsx';
import { initSecurityShield } from './utils/securityShield.js';

// Initialize anti-inspect and code protection shield
initSecurityShield();

// Global handler for Vite dynamic chunk updates (reloads fresh bundle if old hash 404s after deploy)
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const lastReload = sessionStorage.getItem('pulsechat_chunk_reload_ts');
  const now = Date.now();
  if (!lastReload || now - parseInt(lastReload, 10) > 12000) {
    sessionStorage.setItem('pulsechat_chunk_reload_ts', now.toString());
    window.location.reload();
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <AppMusicProvider>
            <App />
          </AppMusicProvider>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
