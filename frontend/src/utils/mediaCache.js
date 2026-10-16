/**
 * Ultra-Fast Local Media Cache for PulseChat
 * Uses standard CacheStorage API (supported natively across all Android/iOS WebViews & browsers).
 *
 * BENEFITS:
 * 1. 0 MB repeat downloads from Cloudinary CDN (protects user data & network).
 * 2. 0 ms instant image display on revisit (buttery smooth 120fps chat scroll).
 * 3. Offline access: photos & avatars already seen open instantly without internet!
 */

const CACHE_NAME = 'pulsechat-media-v1';
const inMemoryBlobUrlCache = new Map();

/**
 * Synchronously checks if a blob URL is already available in memory.
 * Returns the blob URL if available, or the original URL if local/data, or empty string.
 */
export function getSyncCachedMediaUrl(remoteUrl) {
  if (!remoteUrl || typeof remoteUrl !== 'string') return '';
  if (remoteUrl.startsWith('data:') || remoteUrl.startsWith('blob:') || remoteUrl.startsWith('/')) {
    return remoteUrl;
  }
  return inMemoryBlobUrlCache.get(remoteUrl) || '';
}

/**
 * Retrieves a cached Blob URL for a given remote image/media URL.

 * If not cached, fetches in background, caches to device storage, and returns.
 *
 * @param {string} remoteUrl
 * @returns {Promise<string>} Blob URL or original URL as fallback
 */
export async function getCachedMediaUrl(remoteUrl) {
  if (!remoteUrl || typeof remoteUrl !== 'string') return '';

  // Skip data URLs, blob URLs, and local relative paths
  if (remoteUrl.startsWith('data:') || remoteUrl.startsWith('blob:') || remoteUrl.startsWith('/')) {
    return remoteUrl;
  }

  // 1. Check in-memory fast cache (0ms)
  if (inMemoryBlobUrlCache.has(remoteUrl)) {
    return inMemoryBlobUrlCache.get(remoteUrl);
  }

  // 2. Check CacheStorage on device
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await window.caches.open(CACHE_NAME);
      const match = await cache.match(remoteUrl);
      if (match) {
        const blob = await match.blob();
        const blobUrl = URL.createObjectURL(blob);
        inMemoryBlobUrlCache.set(remoteUrl, blobUrl);
        return blobUrl;
      }

      // If not in cache, fetch and store
      fetch(remoteUrl, { mode: 'cors' })
        .then(async (response) => {
          if (response && response.ok) {
            try {
              await cache.put(remoteUrl, response.clone());
              const blob = await response.blob();
              const blobUrl = URL.createObjectURL(blob);
              inMemoryBlobUrlCache.set(remoteUrl, blobUrl);
            } catch (_) {}
          }
        })
        .catch(() => {});
    } catch (_) {}
  }

  // Default to remoteUrl if caching fails or is loading
  return remoteUrl;
}

/**
 * Preload and cache a batch of avatar/media URLs in the background.
 */
export function preloadMediaUrls(urls = []) {
  if (typeof window === 'undefined' || !('caches' in window) || !Array.isArray(urls)) return;

  window.caches.open(CACHE_NAME).then((cache) => {
    urls.forEach((url) => {
      if (url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
        if (!inMemoryBlobUrlCache.has(url)) {
          cache.match(url).then((matched) => {
            if (!matched) {
              fetch(url, { mode: 'cors' })
                .then((res) => {
                  if (res && res.ok) cache.put(url, res);
                })
                .catch(() => {});
            }
          }).catch(() => {});
        }
      }
    });
  }).catch(() => {});
}

// ==========================================
// Spotify-Style Audio Disk Cache (CacheStorage)
// 1. First play streams and caches audio to disk in background.
// 2. All subsequent plays load 100% offline from phone disk with 0 bytes internet!
// ==========================================
const AUDIO_CACHE_NAME = 'pulsechat-audio-v1';
const inMemoryAudioBlobCache = new Map();

/**
 * Synchronously checks if an audio blob URL is already in fast memory cache.
 */
export function getSyncCachedAudioUrl(remoteUrl) {
  if (!remoteUrl || typeof remoteUrl !== 'string') return '';
  if (remoteUrl.startsWith('data:') || remoteUrl.startsWith('blob:') || remoteUrl.startsWith('/')) {
    return remoteUrl;
  }
  return inMemoryAudioBlobCache.get(remoteUrl) || '';
}

/**
 * Returns a local cached Blob URL for an audio track or voice note.
 * If already cached on phone disk, returns it immediately (0ms, 0 byte network).
 * If not cached, starts background caching and returns the streaming URL.
 */
export async function getOrCacheAudioBlobUrl(remoteUrl) {
  if (!remoteUrl || typeof remoteUrl !== 'string') return '';
  if (remoteUrl.startsWith('data:') || remoteUrl.startsWith('blob:') || remoteUrl.startsWith('/')) {
    return remoteUrl;
  }

  // 1. Fast in-memory check (0ms)
  if (inMemoryAudioBlobCache.has(remoteUrl)) {
    return inMemoryAudioBlobCache.get(remoteUrl);
  }

  // 2. Check device disk cache (CacheStorage API)
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await window.caches.open(AUDIO_CACHE_NAME);
      const match = await cache.match(remoteUrl);
      if (match) {
        const blob = await match.blob();
        const blobUrl = URL.createObjectURL(blob);
        inMemoryAudioBlobCache.set(remoteUrl, blobUrl);
        return blobUrl;
      }

      // 3. Not in disk cache: Stream remote URL now & cache in background for future plays
      fetch(remoteUrl, { mode: 'cors' })
        .then(async (response) => {
          if (response && response.ok) {
            try {
              await cache.put(remoteUrl, response.clone());
              const blob = await response.blob();
              const blobUrl = URL.createObjectURL(blob);
              inMemoryAudioBlobCache.set(remoteUrl, blobUrl);
            } catch (_) {}
          }
        })
        .catch(() => {});
    } catch (_) {}
  }

  return remoteUrl;
}

/**
 * Background preloads audio files into local disk cache (Spotify offline download style).
 */
export function preloadAudioUrls(urls = []) {
  if (typeof window === 'undefined' || !('caches' in window) || !Array.isArray(urls)) return;

  window.caches.open(AUDIO_CACHE_NAME).then((cache) => {
    urls.forEach((url) => {
      if (url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
        if (!inMemoryAudioBlobCache.has(url)) {
          cache.match(url).then((matched) => {
            if (!matched) {
              fetch(url, { mode: 'cors' })
                .then(async (res) => {
                  if (res && res.ok) {
                    try {
                      await cache.put(url, res.clone());
                      const blob = await res.blob();
                      inMemoryAudioBlobCache.set(url, URL.createObjectURL(blob));
                    } catch (_) {}
                  }
                })
                .catch(() => {});
            }
          }).catch(() => {});
        }
      }
    });
  }).catch(() => {});
}
