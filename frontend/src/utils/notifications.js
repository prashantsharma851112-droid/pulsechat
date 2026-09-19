// PulseChat Push Notification Utility
// Browser/PWA push notifications + Web Push background service helper functions
import { BACKEND_URL } from './config';

/**
 * Convert VAPID base64 string to Uint8Array required by pushManager.subscribe
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * User se notification permission maango bina baar-baar pareshan kiye
 * @param {boolean} forcePrompt - Whether user manually tapped Allow / Enable
 * @param {string|null} token - Auth JWT token to register Web Push
 * @returns {Promise<boolean>} true if granted
 */
export async function requestNotificationPermission(forcePrompt = false, token = null) {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;

  // Agar already granted hai
  if (Notification.permission === 'granted') {
    localStorage.setItem('pulsechat_notif_granted', 'true');
    if (token) {
      subscribeUserToPush(token).catch(() => {});
    }
    return true;
  }

  // Agar user ne pehle hi block/deny kar diya hai
  if (Notification.permission === 'denied') {
    return false;
  }

  // Agar automatic call hai aur user ne pehle banner dismiss kar diya tha, toh dobara prompt mat karo
  if (!forcePrompt && localStorage.getItem('pulsechat_notif_dismissed') === 'true') {
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      localStorage.setItem('pulsechat_notif_granted', 'true');
      localStorage.removeItem('pulsechat_notif_dismissed');
      if (token) {
        subscribeUserToPush(token).catch(() => {});
      }
      return true;
    } else if (permission === 'denied') {
      localStorage.setItem('pulsechat_notif_dismissed', 'true');
    }
    return permission === 'granted';
  } catch (err) {
    console.warn('Notification permission request error:', err);
    return false;
  }
}

/**
 * Register Web Push subscription with Service Worker & Backend
 * Taaki app poori band hone par bhi notifications receive ho sakein
 */
export async function subscribeUserToPush(token = null) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') return false;

  try {
    let reg = null;
    try {
      reg = await navigator.serviceWorker.getRegistration();
    } catch (e) {}
    if (!reg) {
      reg = await navigator.serviceWorker.ready;
    }
    if (!reg || !reg.pushManager) return false;

    // 1. Backend se persistent VAPID public key fetch karo
    const res = await fetch(`${BACKEND_URL}/api/users/vapid-public-key`);
    const { publicKey } = await res.json();
    if (!publicKey) return false;

    // 2. Existing subscription check karo aur key mismatch ho toh renew karo
    let subscription = await reg.pushManager.getSubscription();
    const storedKey = localStorage.getItem('pulsechat_vapid_key');

    if (subscription && storedKey !== publicKey) {
      try {
        await subscription.unsubscribe();
        subscription = null;
      } catch (e) {}
    }

    if (!subscription) {
      const convertedKey = urlBase64ToUint8Array(publicKey);
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });
      localStorage.setItem('pulsechat_vapid_key', publicKey);
    }

    // 3. Subscription backend mein register karo (taaki app band hone par bhi notification aaye)
    const authToken = token || localStorage.getItem('pulsechat_token');
    if (subscription && authToken) {
      const subJson = subscription.toJSON();
      const p256dh = subJson.keys?.p256dh || (subscription.getKey ? btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh')))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : null);
      const auth = subJson.keys?.auth || (subscription.getKey ? btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth')))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : null);

      if (subJson.endpoint && p256dh && auth) {
        await fetch(`${BACKEND_URL}/api/users/push-subscription`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({
            endpoint: subJson.endpoint,
            keys: { p256dh, auth }
          })
        });
        console.log('✅ Registered Push Subscription for closed app notifications');
        return true;
      }
    }
  } catch (err) {
    console.warn('Push subscription setup failed:', err.message);
  }
  return false;
}

/**
 * User ne notification banner dismiss kiya
 */
export function dismissNotificationBanner() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('pulsechat_notif_dismissed', 'true');
  }
}

/**
 * Push notification show karo (Service Worker ke through - Android/PWA compatible)
 */
export async function showPushNotification(title, body, icon = '/icon-192.png', tag = 'pulsechat-msg', data = {}) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const notifPayloadData = {
    url: window.location.origin,
    ...data
  };

  try {
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
          data: notifPayloadData
        });
        return;
      }
    }

    const notif = new Notification(title, {
      body,
      icon: icon || '/icon-192.png',
      tag: tag || 'pulsechat-notification',
      data: notifPayloadData
    });

    notif.onclick = (e) => {
      e.preventDefault();
      window.focus();
      if (data && (data.chatId || data.senderId)) {
        window.dispatchEvent(new CustomEvent('pulsechat_open_chat', { detail: data }));
      }
      notif.close();
    };
  } catch (err) {
    console.warn('showPushNotification failed:', err);
  }
}
