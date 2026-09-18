// PulseChat Push Notification Utility
// Browser/PWA push notifications ke liye helper functions

/**
 * User se notification permission maango
 * @returns {Promise<boolean>} true if granted
 */
export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    console.warn('Notification permission request error:', err);
    return false;
  }
}

/**
 * Push notification show karo (Service Worker ke through - Android/PWA compatible)
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {string} icon - Icon URL
 * @param {string} tag - Unique tag
 */
export async function showPushNotification(title, body, icon = '/icon-192.png', tag = 'pulsechat-msg') {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    // 1. Android PWA aur Chrome ke liye ServiceWorkerRegistration se notification bhejna mandatory hai
    if ('serviceWorker' in navigator) {
      let reg = null;
      try {
        reg = await navigator.serviceWorker.getRegistration();
      } catch (e) {}
      if (!reg) {
        reg = await navigator.serviceWorker.ready;
      }

      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, {
          body,
          icon: icon || '/icon-192.png',
          badge: '/icon-192.png',
          tag: tag || 'pulsechat-notification',
          renotify: true,
          vibrate: [200, 100, 200],
          data: { url: window.location.origin }
        });
        return;
      }
    }

    // 2. Fallback: Desktop browsers jahan SW available na ho
    new Notification(title, {
      body,
      icon: icon || '/icon-192.png',
      tag: tag || 'pulsechat-notification'
    });
  } catch (err) {
    console.warn('showPushNotification failed:', err);
  }
}
