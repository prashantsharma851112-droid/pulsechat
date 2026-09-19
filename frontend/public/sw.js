const CACHE_NAME = 'pulsechat-v5';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Pre-caching assets failed:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Let network handle socket connections and API requests
  if (event.request.url.includes('/api/') || event.request.url.includes('/socket.io/')) {
    return;
  }

  // If user triggered a hard reload (F5 / pull-to-refresh) or in local development with Vite
  const isDev = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';
  const isReload = event.request.cache === 'reload' || event.request.headers.get('cache-control') === 'no-cache';

  if (isDev && (event.request.url.includes('/@') || event.request.url.includes('/src/'))) {
    // Never cache Vite dev modules so HMR and code edits refresh instantly
    return;
  }

  // Navigation requests (opening app / refreshing page)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // If offline, serve cached index.html
          return caches.match(event.request).then((cached) => {
            return cached || caches.match('/') || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // Static assets: If reload requested, fetch fresh from network
  if (isReload) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && event.request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Normal static assets: Network-first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.destination === 'image') {
            return caches.match('/icon-192.png');
          }
        });
      })
  );
});

// Push notification received in background (even when app is completely closed)
self.addEventListener('push', (event) => {
  let title = 'PulseChat';
  let body = 'You have a new message';
  let icon = '/icon-192.png';
  let tag = 'pulsechat-msg';
  let targetUrl = self.registration.scope;
  let messageId = null;
  let chatId = null;
  let senderId = null;
  let isGroup = false;

  if (event.data) {
    try {
      const data = event.data.json();
      if (data.title) title = data.title;
      if (data.body) body = data.body;
      if (data.icon) icon = data.icon;
      if (data.tag) tag = data.tag;
      if (data.data?.url) targetUrl = data.data.url;
      if (data.data?.messageId) messageId = data.data.messageId;
      if (data.data?.chatId) chatId = data.data.chatId;
      if (data.data?.senderId) senderId = data.data.senderId;
      if (data.data?.isGroup) isGroup = !!data.data.isGroup;
    } catch (e) {
      try {
        const text = event.data.text();
        if (text) body = text;
      } catch (err) {}
    }
  }

  const options = {
    body,
    icon: icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: tag || 'pulsechat-notification',
    renotify: true,
    vibrate: [250, 100, 250, 100, 250],
    data: { url: targetUrl, messageId, chatId, senderId, isGroup }
  };

  const tasks = [
    self.registration.showNotification(title, options)
  ];

  // Acknowledge delivery in the background so sender gets Double Tick immediately
  if (messageId) {
    try {
      const ackUrl = new URL('/api/messages/delivered-ack', self.registration.scope).href;
      tasks.push(
        fetch(ackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId, chatId })
        }).catch(() => {})
      );
    } catch (e) {}
  }

  event.waitUntil(Promise.all(tasks));
});

// Notification clicked - open app or focus existing window and open direct chat
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};
  const chatId = notifData.chatId || '';
  const senderId = notifData.senderId || '';
  const isGroup = !!notifData.isGroup;

  const params = new URLSearchParams();
  if (chatId) params.set('openChat', chatId);
  if (senderId) params.set('senderId', senderId);
  if (isGroup) params.set('isGroup', '1');

  const queryStr = params.toString();
  const targetUrl = queryStr
    ? new URL('/?' + queryStr, self.registration.scope).href
    : (notifData.url || self.registration.scope);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open in a tab, focus it and tell it to open the chat
      for (const client of clientList) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          client.postMessage({
            type: 'OPEN_CHAT',
            chatId,
            senderId,
            isGroup
          });
          return client.focus();
        }
      }
      // Otherwise open fresh window with the query params
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
