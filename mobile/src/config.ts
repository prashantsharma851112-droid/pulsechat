import { TestIds } from 'react-native-google-mobile-ads';

export const CONFIG = {
  // Render Live Backend URL
  API_BASE_URL: 'https://pulsechat-xzul.onrender.com/api',
  SOCKET_URL: 'https://pulsechat-xzul.onrender.com',

  // Google AdMob Unit IDs (Official PulseChat Production Units)
  ADMOB: {
    APP_ID: 'ca-app-pub-9694837576493381~3737412445',
    REWARDED_ID: 'ca-app-pub-9694837576493381/8823975753', // Pulse Arrow Revive
    INTERSTITIAL_ID: 'ca-app-pub-9694837576493381/1786036526', // Pulse Story Transition
    BANNER_ID: TestIds.BANNER,
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
