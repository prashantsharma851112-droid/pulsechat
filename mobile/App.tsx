import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { loadInterstitialAd } from './src/services/admob';

export default function App() {
  useEffect(() => {
    // Preload Google AdMob Interstitial Ad
    loadInterstitialAd();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" backgroundColor="#0b141a" />
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
