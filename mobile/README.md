# 📱 PulseChat - Native React Native (Expo) App with Google AdMob

The official mobile app frontend for **PulseChat**, built with **React Native (Expo)**, **Socket.io**, **Axios**, and **Google AdMob**. Designed to match the 60 FPS performance, responsiveness, and aesthetics of Instagram and WhatsApp.

---

## 🌟 Features

- 📱 **100% Native Components**: Smooth 60 FPS scrolling, native gestures, zero webview latency.
- ⚡ **Real-Time WebSocket Sync**: Powered by `socket.io-client` connected to `https://pulsechat-xzul.onrender.com`.
- 💬 **WhatsApp-Style Chat UI**: Native chat bubbles, media previews, audio indicators, read receipts, and live typing status.
- ⭕ **Instagram Stories Status**: View & share status updates.
- 📞 **Voice & Video Calling Interface**: Direct calling logs & WebRTC integration hooks.
- 💰 **Google AdMob Monetization**: Integrated non-intrusive AdMob Banner ads and transition Interstitial ads (`react-native-google-mobile-ads`).
- 🔐 **Session Persistence**: JWT auth management with `@react-native-async-storage/async-storage`.

---

## 🚀 How to Run Locally

### 1. Navigate to the `mobile` directory
```bash
cd mobile
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Expo Development Server
```bash
npm start
```
or
```bash
npx expo start
```

### 4. Run on Mobile Device or Emulator
- **Physical Device**: Scan the QR code using the **Expo Go** app on Android or iOS.
- **Android Emulator**: Press `a` in the terminal to launch on Android Studio Emulator.
- **iOS Simulator** (Mac only): Press `i` in the terminal.

---

## ⚙️ Configuration (`src/config.ts`)

- **Backend API Base**: `https://pulsechat-xzul.onrender.com/api`
- **Socket Server**: `https://pulsechat-xzul.onrender.com`
- **AdMob Test Unit IDs**: Uses Google official Test IDs (`TestIds.BANNER`, `TestIds.INTERSTITIAL`). Replace with your Google AdMob Production IDs when publishing to Google Play Store / Apple App Store.

---

## 📦 Building Production Native Builds (EAS Build)

To build a production `.apk` / `.aab` for Android or `.ipa` for iOS:

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Login to Expo Account
eas login

# Build Android APK
eas build --platform android --profile preview
```
