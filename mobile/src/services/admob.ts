import { InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { CONFIG } from '../config';

const interstitialAdUnitId = CONFIG.ADMOB.INTERSTITIAL_ID || TestIds.INTERSTITIAL;

let interstitial: InterstitialAd | null = null;
let isLoaded = false;

export const loadInterstitialAd = () => {
  try {
    interstitial = InterstitialAd.createForAdRequest(interstitialAdUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    interstitial.addAdEventListener(AdEventType.LOADED, () => {
      isLoaded = true;
      console.log('✅ AdMob Interstitial Ad Loaded');
    });

    interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      isLoaded = false;
      console.log('ℹ️ AdMob Interstitial Ad Closed - Reloading');
      // Reload for next transition
      loadInterstitialAd();
    });

    interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
      isLoaded = false;
      console.log('⚠️ AdMob Interstitial Error:', error);
    });

    interstitial.load();
  } catch (err) {
    console.log('⚠️ AdMob setup fallback / skipped in Expo Go');
  }
};

export const showInterstitialAd = () => {
  if (interstitial && isLoaded) {
    interstitial.show();
  } else {
    console.log('ℹ️ Interstitial ad not loaded yet or in dev mode');
  }
};
