import React, { useState, useEffect } from 'react';
import { getCachedMediaUrl, getSyncCachedMediaUrl } from '../../utils/mediaCache';

/**
 * CachedImage component for PulseChat:
 * Automatically uses CacheStorage & IndexedDB to avoid repeated Cloudinary / CDN bandwidth.
 * Loads instantaneously from local device storage (0ms, 0 byte network on reload).
 */
export default function CachedImage({
  src,
  alt = '',
  style,
  className,
  onClick,
  loading = 'lazy',
  decoding = 'async',
  fallbackSrc = '/icon-192.png',
  ...props
}) {
  const [resolvedSrc, setResolvedSrc] = useState(() => {
    return getSyncCachedMediaUrl(src) || src || fallbackSrc;
  });

  useEffect(() => {
    if (!src) {
      setResolvedSrc(fallbackSrc);
      return;
    }

    let isMounted = true;
    const immediate = getSyncCachedMediaUrl(src);
    if (immediate) {
      setResolvedSrc(immediate);
    } else {
      setResolvedSrc(src);
      getCachedMediaUrl(src).then((cached) => {
        if (isMounted && cached && cached !== src) {
          setResolvedSrc(cached);
        }
      }).catch(() => {});
    }

    const handleCachedEvent = (e) => {
      if (isMounted && e.detail?.remoteUrl === src && e.detail?.blobUrl) {
        setResolvedSrc(e.detail.blobUrl);
      }
    };

    window.addEventListener('pulsechat_media_cached', handleCachedEvent);
    return () => {
      isMounted = false;
      window.removeEventListener('pulsechat_media_cached', handleCachedEvent);
    };
  }, [src, fallbackSrc]);

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      style={style}
      className={className}
      onClick={onClick}
      loading={loading}
      decoding={decoding}
      onError={(e) => {
        if (resolvedSrc !== src && src) {
          setResolvedSrc(src);
        } else if (fallbackSrc && resolvedSrc !== fallbackSrc) {
          setResolvedSrc(fallbackSrc);
        }
      }}
      {...props}
    />
  );
}
