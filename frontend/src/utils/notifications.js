// PulseChat Push Notification Utility
// Browser/PWA push notifications ke liye helper functions

/**
 * User se notification permission maango
 * @returns {Promise<boolean>} true if granted
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

/**
 * Push notification show karo (Service Worker ke through agar available ho)
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {string} icon - Icon URL
 * @param {string} tag - Unique tag (duplicate avoid karne ke liye)
 */
export async function showPushNotification(title, body, icon = '/icon-192.png', tag = 'pulsechat-msg') {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    // Service Worker available hai toh usse use karo (PWA installed state)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        icon,
        badge: '/icon-192.png',
        tag,
        renotify: true,
        vibrate: [200, 100, 200],
        data: { url: window.location.origin }
      });
    } else {
      // Fallback: direct browser notification
      new Notification(title, {
        body,
        icon,
        tag
      });
    }
  } catch (err) {
    console.warn('Notification failed:', err);
  }
}
