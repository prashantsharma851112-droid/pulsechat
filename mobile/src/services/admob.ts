import { InterstitialAd, RewardedAd, RewardedAdEventType, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { CONFIG } from '../config';

const interstitialAdUnitId = CONFIG.ADMOB.INTERSTITIAL_ID || TestIds.INTERSTITIAL;
const rewardedAdUnitId = CONFIG.ADMOB.REWARDED_ID || TestIds.REWARDED;

let interstitial: InterstitialAd | null = null;
let isInterstitialLoaded = false;

let rewarded: RewardedAd | null = null;
let isRewardedLoaded = false;

// 1. Interstitial Ads (Pulse Story Transition)
export const loadInterstitialAd = () => {
  try {
    interstitial = InterstitialAd.createForAdRequest(interstitialAdUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    interstitial.addAdEventListener(AdEventType.LOADED, () => {
      isInterstitialLoaded = true;
      console.log('✅ AdMob Interstitial Ad Loaded (Pulse Story Transition)');
    });

    interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      isInterstitialLoaded = false;
      console.log('ℹ️ AdMob Interstitial Ad Closed - Reloading');
      loadInterstitialAd();
    });

    interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
      isInterstitialLoaded = false;
      console.log('⚠️ AdMob Interstitial Error:', error);
    });

    interstitial.load();
  } catch (err) {
    console.log('⚠️ AdMob Interstitial setup fallback / skipped');
  }
};

export const showInterstitialAd = () => {
  if (interstitial && isInterstitialLoaded) {
    interstitial.show();
  } else {
    console.log('ℹ️ Interstitial ad not loaded yet');
  }
};

// 2. Rewarded Video Ads (Pulse Arrow Revive)
export const loadRewardedAd = () => {
  try {
    rewarded = RewardedAd.createForAdRequest(rewardedAdUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
      isRewardedLoaded = true;
      console.log('✅ AdMob Rewarded Ad Loaded (Pulse Arrow Revive)');
    });

    rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => {
      console.log('🎁 User earned AdMob reward:', reward);
    });

    rewarded.addAdEventListener(AdEventType.CLOSED, () => {
      isRewardedLoaded = false;
      console.log('ℹ️ AdMob Rewarded Ad Closed - Preloading next');
      loadRewardedAd();
    });

    rewarded.addAdEventListener(AdEventType.ERROR, (error) => {
      isRewardedLoaded = false;
      console.log('⚠️ AdMob Rewarded Error:', error);
    });

    rewarded.load();
  } catch (err) {
    console.log('⚠️ AdMob Rewarded setup fallback / skipped');
  }
};

export const showRewardedAd = (onRewardEarned?: (reward: any) => void) => {
  if (rewarded && isRewardedLoaded) {
    if (onRewardEarned) {
      const listener = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => {
        onRewardEarned(reward);
      });
    }
    rewarded.show();
  } else {
    console.log('ℹ️ Rewarded ad not loaded yet');
  }
};
