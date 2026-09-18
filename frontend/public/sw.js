const CACHE_NAME = 'pulsechat-v2';

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

// Push notification receive karo (future server-side push ke liye)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'PulseChat';
  const options = {
    body: data.body || 'New message received',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'pulsechat-msg',
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: data.url || self.registration.scope }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click hone par app open karo
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || self.registration.scope;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Agar app already open hai toh focus karo
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
