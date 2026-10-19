import React from 'react';

/**
 * Robust React.lazy wrapper that handles chunk load failures
 * (which occur when a new version is deployed to Vercel/production and old asset hashes 404).
 * It automatically reloads the page once to pull fresh HTML and the latest JS bundles.
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
      return await load();
    } catch (error) {
      const isChunkLoadFailed =
        error?.name === 'ChunkLoadError' ||
        /Failed to fetch dynamically imported module/i.test(error?.message || '') ||
        /error loading dynamically imported module/i.test(error?.message || '') ||
        /Importing a module script failed/i.test(error?.message || '');

      if (isChunkLoadFailed) {
        // NEVER trigger page reload when device is offline!
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          throw error;
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
