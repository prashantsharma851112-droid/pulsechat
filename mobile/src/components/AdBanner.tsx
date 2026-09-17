import React from 'react';
import { View, Text, StyleSheet } from 'react'
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { CONFIG } from '../config';

const adUnitId = CONFIG.ADMOB.BANNER_ID || TestIds.BANNER;

export const AdBanner: React.FC = () => {
  return (
    <View style={styles.container}>
      {tryRenderBanner()}
    </View>
  );
};

const tryRenderBanner = () => {
  try {
    return (
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdFailedToLoad={(error) => {
          console.log('AdMob Banner Failed to Load:', error);
        }}
      />
    );
  } catch (e) {
    // Fallback UI when running in Expo Go or non-native build
    return (
      <View style={styles.fallbackBox}>
        <Text style={styles.fallbackText}>📢 Google AdMob Banner Ad (Test Mode)</Text>
      </View>
    );
  }
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111b21',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: '#202c33',
  },
  fallbackBox: {
    backgroundColor: '#1f2c34',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#00a884',
    marginVertical: 4,
  },
  fallbackText: {
    color: '#00a884',
    fontSize: 12,
    fontWeight: '600',
  },
});
