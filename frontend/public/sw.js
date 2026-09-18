const CACHE_NAME = 'pulsechat-v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let network handle socket connections and API requests
  if (event.request.url.includes('/api/') || event.request.url.includes('/socket.io/')) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
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

  if (event.data) {
    try {
      const data = event.data.json();
      if (data.title) title = data.title;
      if (data.body) body = data.body;
      if (data.icon) icon = data.icon;
      if (data.tag) tag = data.tag;
      if (data.data?.url) targetUrl = data.data.url;
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
    data: { url: targetUrl }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification clicked - open app or focus existing window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || self.registration.scope;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Agar app already open hai toh usko focus karo
      for (const client of clientList) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      // Warna naya window open karo
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
