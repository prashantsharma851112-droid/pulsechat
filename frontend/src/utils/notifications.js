// push notification utils
import { BACKEND_URL } from './config';

// convert base64 to uint8array for vapid key
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

// request notification permission
export async function requestNotificationPermission(forcePrompt = false, token = null) {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;

  // if already granted
  if (Notification.permission === 'granted') {
    localStorage.setItem('pulsechat_notif_granted', 'true');
    if (token) {
      subscribeUserToPush(token).catch(() => {});
    }
    return true;
  }

  // if denied
  if (Notification.permission === 'denied') {
    return false;
  }

  // if dismissed before
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

// subscribe user to web push
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

    // fetch vapid public key
    const res = await fetch(`${BACKEND_URL}/api/users/vapid-public-key`);
    const { publicKey } = await res.json();
    if (!publicKey) return false;

    // check existing subscription
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

    // register push sub with backend
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
        return true;
      }
    }
  } catch (err) {
    console.warn('Push subscription setup failed:', err.message);
  }
  return false;
}

// dismiss notification banner
export function dismissNotificationBanner() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('pulsechat_notif_dismissed', 'true');
  }
}

// show browser push notification
export async function showPushNotification(title, body, icon = '/icon-192.png', tag = 'pulsechat-msg', data = {}) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (localStorage.getItem('pulsechat_notifications_enabled') === 'false') return;
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
