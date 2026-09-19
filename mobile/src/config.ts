import { TestIds } from 'react-native-google-mobile-ads';

export const CONFIG = {
  // Render Live Backend URL
  API_BASE_URL: 'https://pulsechat-xzul.onrender.com/api',
  SOCKET_URL: 'https://pulsechat-xzul.onrender.com',

  // Google AdMob Unit IDs (Uses Google official Test Unit IDs for development)
  ADMOB: {
    BANNER_ID: TestIds.BANNER, // Sample: ca-app-pub-3940256099942544/6300978111
    INTERSTITIAL_ID: TestIds.INTERSTITIAL, // Sample: ca-app-pub-3940256099942544/1033173712
  },

  // Local Storage Keys
  STORAGE_KEYS: {
    AUTH_TOKEN: '@pulsechat_token',
    USER_DATA: '@pulsechat_user',
    CHAT_USERS: '@pulsechat_cached_users',
    MESSAGES_PREFIX: '@pulsechat_msgs_',
    OUTBOX: '@pulsechat_outbox',
  },
};
