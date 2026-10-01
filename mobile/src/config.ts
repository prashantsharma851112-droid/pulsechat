import { TestIds } from 'react-native-google-mobile-ads';

export const CONFIG = {
  // Render Live Backend URL
  API_BASE_URL: 'https://pulsechat-api-v2.onrender.com/api',
  SOCKET_URL: 'https://pulsechat-api-v2.onrender.com',

  // Google AdMob Unit IDs (Official PulseChat Production Units)
  ADMOB: {
    APP_ID: 'ca-app-pub-9694837576493381~3737412445',
    REWARDED_ID: 'ca-app-pub-8527648187361885/3025989630', // Pulse Arrow Revive (Rewarded)
    INTERSTITIAL_ID: 'ca-app-pub-8527648187361885/1001538089', // Pulse Story Transition (Interstitial)
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
