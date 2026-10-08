import React from 'react';

/**
 * Robust React.lazy wrapper that handles chunk load failures
 * (which occur when a new version is deployed to Vercel/production and old asset hashes 404).
 * It automatically reloads the page once to pull fresh HTML and the latest JS bundles.
 */
export function lazyWithRetry(componentImport) {
  return React.lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      const isChunkLoadFailed =
        error?.name === 'ChunkLoadError' ||
        /Failed to fetch dynamically imported module/i.test(error?.message || '') ||
        /error loading dynamically imported module/i.test(error?.message || '') ||
        /Importing a module script failed/i.test(error?.message || '');

      if (isChunkLoadFailed) {
        const lastReload = sessionStorage.getItem('pulsechat_chunk_reload_ts');
        const now = Date.now();
        // Prevent infinite reload loop if offline (allow once every 12 seconds)
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
}
