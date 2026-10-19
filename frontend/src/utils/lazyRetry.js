import React from 'react';

/**
 * Friendly offline fallback component when a dynamic chunk cannot be loaded without internet
 */
function DefaultOfflineFallback({ onClose }) {
  return React.createElement(
    'div',
    {
      className: 'modal-overlay',
      style: {
        zIndex: 9999,
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      },
      onClick: (e) => {
        if (e.target === e.currentTarget && typeof onClose === 'function') onClose();
      }
    },
    React.createElement(
      'div',
      {
        className: 'modal-card',
        style: {
          maxWidth: '380px',
          width: '100%',
          padding: '24px',
          textAlign: 'center',
          background: 'var(--bg-card, #18181b)',
          border: '1px solid var(--border, rgba(255, 255, 255, 0.12))',
          borderRadius: '18px',
          color: '#fff',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          animation: 'fadeIn 0.2s ease-out'
        },
        onClick: (e) => e.stopPropagation()
      },
      React.createElement('div', { style: { fontSize: '2.5rem', marginBottom: '12px' } }, '📡'),
      React.createElement(
        'h3',
        { style: { margin: '0 0 8px 0', fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' } },
        'Offline Mode'
      ),
      React.createElement(
        'p',
        { style: { margin: '0 0 20px 0', color: '#94a3b8', fontSize: '0.86rem', lineHeight: 1.5 } },
        'This feature is not cached in local storage yet and requires an active internet connection to download. Please reconnect to the internet.'
      ),
      React.createElement(
        'button',
        {
          onClick: () => {
            if (typeof onClose === 'function') onClose();
            else window.history.back();
          },
          className: 'interactive-tap action-btn',
          style: {
            width: '100%',
            padding: '11px',
            borderRadius: '12px',
            fontWeight: 700,
            background: 'var(--accent, #6366f1)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            transform: 'translateZ(0)',
            willChange: 'transform'
          }
        },
        'Dismiss'
      )
    )
  );
}

/**
 * Robust React.lazy wrapper that handles chunk load failures
 * (which occur when a new version is deployed to Vercel/production and old asset hashes 404,
 * or when the user is offline and dynamic imports fail).
 * It automatically reloads once for production deploys, and safely returns an offline fallback
 * instead of crashing React with TypeError: Cannot read properties of undefined (reading 'default').
 */
export function lazyWithRetry(componentImport) {
  let cachedPromise = null;

  const load = () => {
    if (!cachedPromise) {
      cachedPromise = componentImport().catch(error => {
        cachedPromise = null;
        throw error;
      });
    }
    return cachedPromise;
  };

  const LazyComponent = React.lazy(async () => {
    try {
      const module = await load();
      // Ensure we ALWAYS return an object with a valid 'default' export so React never throws
      if (module && typeof module === 'object') {
        if (module.default) return module;
        return { default: module };
      }
      if (typeof module === 'function') {
        return { default: module };
      }
      return { default: DefaultOfflineFallback };
    } catch (error) {
      const isChunkLoadFailed =
        error?.name === 'ChunkLoadError' ||
        /Failed to fetch dynamically imported module/i.test(error?.message || '') ||
        /error loading dynamically imported module/i.test(error?.message || '') ||
        /Importing a module script failed/i.test(error?.message || '') ||
        /Asset not found/i.test(error?.message || '');

      const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

      if (isChunkLoadFailed) {
        // If device is strictly offline, NEVER reload and NEVER crash! Return offline fallback component
        if (isOffline) {
          return { default: DefaultOfflineFallback };
        }

        const lastReload = sessionStorage.getItem('pulsechat_chunk_reload_ts');
        const now = Date.now();
        // Prevent infinite reload loop (allow once every 12 seconds)
        if (!lastReload || now - parseInt(lastReload, 10) > 12000) {
          sessionStorage.setItem('pulsechat_chunk_reload_ts', now.toString());
          window.location.reload();
          // Keep promise pending while reload is happening so UI doesn't crash
          return new Promise(() => {});
        }
      }

      // If chunk loading failed due to network disruption or offline status, return fallback safely
      if (isChunkLoadFailed || isOffline) {
        return { default: DefaultOfflineFallback };
      }

      throw error;
    }
  });

  LazyComponent.preload = load;
  return LazyComponent;
}

/**
 * Preload modal chunks during browser idle time so clicking buttons is instant (0ms delay)
 */
export function scheduleIdlePreload(lazyComponents = []) {
  if (typeof window === 'undefined') return;

  const preloadAll = () => {
    // Only attempt preloads if online to prevent network error spam in offline mode
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    lazyComponents.forEach(comp => {
      try {
        if (typeof comp?.preload === 'function') {
          comp.preload();
        }
      } catch (_) {}
    });
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(preloadAll, { timeout: 2500 });
  } else {
    setTimeout(preloadAll, 1200);
  }
}
