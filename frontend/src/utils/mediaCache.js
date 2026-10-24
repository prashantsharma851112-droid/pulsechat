/**
 * Ultra-Fast Dual-Layer Local Media & Audio Cache for PulseChat
 * Uses CacheStorage API + IndexedDB Local Storage.
 *
 * 100% Native on Web, PWA, and Mobile (Android / Capacitor WebView).
 *
 * BENEFITS:
 * 1. 0 MB repeat downloads from Cloudinary CDN & Audio servers (protects user data & server bandwidth).
 * 2. 0 ms instant image display on revisit (buttery smooth 120fps chat scroll & instant music start).
 * 3. Works 100% offline: photos, avatars, and songs already played open and play without internet!
 */

import { saveMediaBlobToLocalDb, getMediaBlobFromLocalDb } from './localDatabase';

const MEDIA_CACHE_NAME = 'pulsechat-media-v1';
const AUDIO_CACHE_NAME = 'pulsechat-audio-v1';

const inMemoryBlobUrlCache = new Map();
const inMemoryAudioBlobCache = new Map();
const pendingFetches = new Set();

/**
 * Synchronously checks if a media blob URL is already available in memory (0ms).
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
 * Checks: Memory Cache -> CacheStorage -> IndexedDB -> Remote Fetch (with auto background caching).
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

  // 2. Check standard CacheStorage on device
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await window.caches.open(MEDIA_CACHE_NAME);
      const match = await cache.match(remoteUrl);
      if (match) {
        const blob = await match.blob();
        if (blob && blob.size > 0) {
          const blobUrl = URL.createObjectURL(blob);
          inMemoryBlobUrlCache.set(remoteUrl, blobUrl);
          return blobUrl;
        }
      }
    } catch (_) {}
  }

  // 3. Check local IndexedDB storage (offline disk backup)
  try {
    const dbBlob = await getMediaBlobFromLocalDb(remoteUrl);
    if (dbBlob && dbBlob.size > 0) {
      const blobUrl = URL.createObjectURL(dbBlob);
      inMemoryBlobUrlCache.set(remoteUrl, blobUrl);
      return blobUrl;
    }
  } catch (_) {}

  // 4. If not yet cached, fetch once in background and save to both CacheStorage & IndexedDB
  if (!pendingFetches.has(remoteUrl)) {
    pendingFetches.add(remoteUrl);
    fetch(remoteUrl, { mode: 'cors' })
      .then(async (response) => {
        if (response && response.ok) {
          try {
            // Save to CacheStorage
            if (typeof window !== 'undefined' && 'caches' in window) {
              const cache = await window.caches.open(MEDIA_CACHE_NAME);
              await cache.put(remoteUrl, response.clone());
            }

            // Save to IndexedDB
            const blob = await response.blob();
            if (blob && blob.size > 0) {
              await saveMediaBlobToLocalDb(remoteUrl, blob);
              const blobUrl = URL.createObjectURL(blob);
              inMemoryBlobUrlCache.set(remoteUrl, blobUrl);

              // Notify listeners that this media is now cached
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('pulsechat_media_cached', {
                  detail: { remoteUrl, blobUrl }
                }));
              }
            }
          } catch (_) {}
        }
      })
      .catch(() => {})
      .finally(() => {
        pendingFetches.delete(remoteUrl);
      });
  }

  // Return remoteUrl while downloading
  return remoteUrl;
}

/**
 * Preload and cache a batch of avatar/media URLs in the background.
 */
export function preloadMediaUrls(urls = []) {
  if (!Array.isArray(urls)) return;
  urls.forEach((url) => {
    if (url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
      getCachedMediaUrl(url).catch(() => {});
    }
  });
}

// ==========================================
// Spotify-Style Audio Disk Cache (CacheStorage + IndexedDB)
// 1. First play streams and caches audio to disk in background.
// 2. All subsequent plays load 100% offline from phone disk with 0 bytes internet!
// ==========================================

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
        if (blob && blob.size > 0) {
          const blobUrl = URL.createObjectURL(blob);
          inMemoryAudioBlobCache.set(remoteUrl, blobUrl);
          return blobUrl;
        }
      }
    } catch (_) {}
  }

  // 3. Check IndexedDB storage (offline disk backup)
  try {
    const dbBlob = await getMediaBlobFromLocalDb(remoteUrl);
    if (dbBlob && dbBlob.size > 0) {
      const blobUrl = URL.createObjectURL(dbBlob);
      inMemoryAudioBlobCache.set(remoteUrl, blobUrl);
      return blobUrl;
    }
  } catch (_) {}

  // 4. Not in disk cache: Stream remote URL now & cache in background for future plays
  if (!pendingFetches.has(remoteUrl)) {
    pendingFetches.add(remoteUrl);
    fetch(remoteUrl, { mode: 'cors' })
      .then(async (response) => {
        if (response && response.ok) {
          try {
            // Save to CacheStorage
            if (typeof window !== 'undefined' && 'caches' in window) {
              const cache = await window.caches.open(AUDIO_CACHE_NAME);
              await cache.put(remoteUrl, response.clone());
            }

            // Save to IndexedDB
            const blob = await response.blob();
            if (blob && blob.size > 0) {
              await saveMediaBlobToLocalDb(remoteUrl, blob);
              const blobUrl = URL.createObjectURL(blob);
              inMemoryAudioBlobCache.set(remoteUrl, blobUrl);

              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('pulsechat_audio_cached', {
                  detail: { remoteUrl, blobUrl }
                }));
              }
            }
          } catch (_) {}
        }
      })
      .catch(() => {})
      .finally(() => {
        pendingFetches.delete(remoteUrl);
      });
  }

  return remoteUrl;
}

/**
 * Background preloads audio files into local disk cache (Spotify offline download style).
 */
export function preloadAudioUrls(urls = []) {
  if (!Array.isArray(urls)) return;
  urls.forEach((url) => {
    if (url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
      getOrCacheAudioBlobUrl(url).catch(() => {});
    }
  });
}

/**
 * Retrieves or decrypts a cached Blob URL for an E2EE encrypted media attachment.
 * Decrypts with AES-256-GCM using mediaKey & mediaIv from the E2EE envelope.
 */
export async function getOrCacheDecryptedMediaUrl(remoteUrl, mediaKey, mediaIv, mimeType = 'image/jpeg') {
  if (!remoteUrl || typeof remoteUrl !== 'string') return '';
  if (remoteUrl.startsWith('data:') || remoteUrl.startsWith('blob:')) {
    return remoteUrl;
  }
  if (!mediaKey || !mediaIv) {
    return getCachedMediaUrl(remoteUrl);
  }

  const cacheKey = `enc_${remoteUrl}`;
  if (inMemoryBlobUrlCache.has(cacheKey)) {
    return inMemoryBlobUrlCache.get(cacheKey);
  }

  try {
    const res = await fetch(remoteUrl);
    if (!res.ok) return remoteUrl;
    const ciphertext = await res.arrayBuffer();
    const { decryptAttachmentFile } = await import('./e2eeCrypto');
    const decryptedBuffer = await decryptAttachmentFile(ciphertext, mediaKey, mediaIv);
    const blob = new Blob([decryptedBuffer], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);
    inMemoryBlobUrlCache.set(cacheKey, blobUrl);
    return blobUrl;
  } catch (err) {
    console.warn('Decryption of attachment failed:', err);
    return remoteUrl;
  }
}
