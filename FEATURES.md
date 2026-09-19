# ⚡ PulseChat — Complete Features Documentation (फ़ीचर लिस्ट)

PulseChat ek ultra-modern, high-performance, real-time messaging aur communication platform hai jo WhatsApp, Telegram aur Discord ke best features ko combine karta hai.

---

## 📑 Table of Contents (विषय सूची)
1. [💬 Core Real-Time Messaging](#1--core-real-time-messaging)
2. [🔒 Privacy, Security & Anti-Leak Suite](#2--privacy-security--anti-leak-suite)
3. [⏱️ 24-Hour Disappearing Messages](#3-️-24-hour-disappearing-messages)
4. [🚫 Block & Contact Management](#4--block--contact-management)
5. [🎙️ Voice Notes & Audio System](#5-️-voice-notes--audio-system)
6. [📞 WebRTC Voice & Video Calling](#6--webrtc-voice--video-calling)
7. [🎨 Collaborative Whiteboard Canvas](#7--collaborative-whiteboard-canvas)
8. [📊 Interactive Polls System](#8--interactive-polls-system)
9. [👥 Groups & Community Management](#9--groups--community-management)
10. [🧠 AI Sentiment, Smart Replies & Mood Timeline](#10--ai-sentiment-smart-replies--mood-timeline)
11. [✨ UI/UX, Animations & Panda Mascot](#11--uiux-animations--panda-mascot)
12. [🔐 Authentication & Account Verification](#12--authentication--account-verification)
13. [📱 Mobile & Android Native Support](#13--mobile--android-native-support)

---

## 1. 💬 Core Real-Time Messaging

- ⚡ **Instant Socket.io Delivery**: Messages bina page reload kiye millisecond speed se deliver hote hain.
- 📎 **Rich Media Attachments**:
  - **Photos**: JPEG, PNG, WEBP, GIF with instant in-chat preview.
  - **Videos**: MP4, WebM with responsive inline video player.
  - **Documents**: PDF, Word (.doc, .docx), Excel (.xls, .xlsx), PowerPoint (.ppt, .pptx), Text (.txt), ZIP, RAR file transfer with size and name display.
- 👁️ **View-Once Media (1-Time Photo/Video)**: Instagram/WhatsApp style media jo receiver sirf ek baar dekh sakta hai, uske baad hamesha ke liye expire/lock ho jata hai.
- ↩️ **WhatsApp-Style Reply Preview Strip**: Kisi bhi message par reply karte waqt message ke upar preview strip dikhti hai jisme sender name, message snippet aur cancel (X) option hota hai.
- 😊 **Built-in Emoji Picker**: Quick emoji search and insertion tool.
- ✍️ **Live Typing Indicators**: User jab bhi message type karta hai toh samne wale ko real-time *"typing..."* indicator dikhta hai.
- 🟢 **Live Online/Offline Status**: Har contact ke profile aur chat header par real-time presence indicators.
- 📬 **Double Tick & Blue Tick (Read Receipts)**:
  - Single tick: Sent to server.
  - Double grey tick: Delivered to recipient device.
  - Double blue tick: Message read by recipient.
- ❌ **Delete for Everyone (Unsend)**: Message bhejne ke baad use sabhi participants ke liye real-time unsend/delete kiya ja sakta hai.
- 🗑️ **Delete for Me**: Sirf apne conversation view se local message delete karne ka option.
- ↩️ **Undo Message Delete Toast**: Delete karne ke baad 6-second ka undo countdown toast aata hai jisse galti se delete hua message wapas restore ho jata hai.
- ☑️ **Multi-Select Messages & Batch Delete**: Ek saath multiple messages select karke batch delete karne ka feature.
- 🧹 **Clear Chat with Undo**: Poori chat ko ek click mein clear karna with temporary backup restore feature.

---

## 2. 🔒 Privacy, Security & Anti-Leak Suite

- 🛡️ **Hardware-Level Screenshot & Screen Record Blocking (Android)**:
  - Android APK mein `WindowManager.LayoutParams.FLAG_SECURE` integrate kiya gaya hai.
  - Phone par screenshot lene ya screen recorder chalane par pure app ki screen hardware level par **black out** ho jati hai.
- 🛡️ **Web & Desktop Anti-Screenshot Shield**:
  - **Snipping Tool & Window Blur Intercept**: Agar user snippet tool open karta hai ya dusre tab/window par switch karta hai, view-once image turant black ho jati hai aur security alert aata hai.
  - **Keyboard Capture Block**: `PrintScreen`, `Ctrl+P`, `Ctrl+S`, `Cmd+Shift` press karne par media blank ho jata hai aur clipboard memory wipe ho jati hai.
  - **Touch Shield Overlay**: Image ke upar transparent unselectable shield hai jo browser ke long-press *"Save Image"* ya drag-and-drop ko block karta hai.
  - **Confidential Diagonal Watermark**: View-once screen par dynamic security watermark show hota hai.
- 👻 **Ghost Unseen Mode (Seen Indicator Off)**:
  - User Settings mein **"Unseen Privacy Mode"** enable kar sakta hai.
  - Is mode ke ON hone par user doosron ke messages read kar lega par samne wale user ko **blue ticks ya seen ka pata nahi chalega** (unseen hi rahega).
- 🕵️ **Selective Silent Mode (Incognito Presence)**:
  - Apna online status chupane ke liye silent mode privacy switch.

---

## 3. ⏱️ 24-Hour Disappearing Messages

- 🕒 **Automatic 24h Message Expiration**: Chat setting enable karne par har naya message 24 ghante baad automatically database se delete ho jata hai.
- 🗄️ **MongoDB TTL Index Integration**: Backend `Message` collection mein native TTL (`expiresAt`) index hai jo physical auto-cleanup handle karta hai.
- 🔄 **Real-Time Synchronized Setting**:
  - 1-to-1 Chat aur Group Chat dono ke profile modal mein **"Disappearing Messages (24h)"** toggle button.
  - Ek participant toggle karega toh doosre ke screen par real-time update hoga.
- 🏷️ **Header Badge**: Disappearing active hone par Chat header mein `⏱️ 24h` visual badge show hota hai.
- 📢 **System Announcements**: Chat mein info pill notification display hota hai: *"⏱️ Messages in this chat will disappear 24 hours after being sent."*

---

## 4. 🚫 Block & Contact Management

- 🚫 **One-Click Block Contact**: Kisi bhi user ko uski profile modal ya chat window ke 3-dots menu se block kiya ja sakta hai.
- 🛡️ **Server-Enforced Block Enforcement**:
  - Blocked user agar message bhejega toh backend reject kar deta hai aur sender ko *"Communication not allowed"* alert bhejta hai.
  - Blocked users ek dusre ko **Voice ya Video call** nahi kar sakte.
- 🚫 **Chat Block Banner**:
  - Blocked contact ki chat kholne par input bar disable ho jata hai aur **"You have blocked this contact [Unblock]"** banner display hota hai.
  - Agar samne wale ne aapko block kiya hai toh **"You cannot reply to this conversation"** banner dikhta hai.
- 📋 **Settings Blocked List**:
  - Settings Modal mein **"Blocked Contacts"** ka dedicated section hai jahan saare blocked users count ke saath list hote hain aur wahan se unhe unblock kiya ja sakta hai.

---

## 5. 🎙️ Voice Notes & Audio System

- 🎤 **Mobile-Optimized Voice Recording Bar**:
  - Mobile screen par recording on karne par Send button **kabhi crop ya cut nahi hota** (`flexShrink: 0` aur `width: 100%`).
  - Recording ke dauran extra icons hide ho jate hain taaki recorder ko poori space mile.
- 🌊 **Live Audio Waveform & Timer**: Bolte waqt dynamic audio bar animations aur recording time seconds mein show hota hai.
- 🎧 **Pre-Send Playback Preview**: Voice note send karne se pehle use play karke sun sakte hain ya cancel/delete kar sakte hain.
- 🔊 **Inline Audio Player with Speed Control**: Chat timeline mein custom styled player with seekbar aur playback speed (1x, 1.5x, 2x).
- 🏷️ **Voice Emotion Badges**: Audio analysis se tone detect karke emotion badge (`Calm`, `Excited`, `Casual`) display hota hai.

---

## 6. 📞 WebRTC Voice & Video Calling

- 🎙️ **1-to-1 Voice Calls**: High-definition peer-to-peer WebRTC voice calling.
- 📹 **1-to-1 Video Calls**: Full-screen video chat with camera switch aur picture-in-picture local preview.
- 👥 **Group Video & Voice Calls**: Multiple group members ek saath video/voice call join kar sakte hain with grid layouts.
- 🖥️ **Live Screen Sharing**: Video call ke dauran apni screen share karne ka built-in `getDisplayMedia` support.
- 🔔 **Incoming Call Ringing Overlay**: Audio ringing sound ke saath animated Accept / Decline popup dialog.
- 🌐 **Global STUN Servers Pool**: Google aur Mozilla STUN servers ke through NAT traversal aur cross-network connectivity.

---

## 7. 🎨 Collaborative Whiteboard Canvas

- 🖌️ **Real-Time Multi-User Whiteboard**: Chat ke participants ek hi canvas par ek saath live drawing aur doodling kar sakte hain.
- ⚡ **Stroke-by-Stroke Socket Sync**: Har pen stroke instant socket events ke through har member ke device par render hoti hai.
- 📐 **Normalized Coordinate Scaling**: Screen resolution choti ya badi hone par bhi drawings exact same proportion mein match hoti hain (`0.0 - 1.0` ratio).
- 🎨 **Creative Tools**: Multi-color palette, brush thickness controls, undo, redo aur clear canvas.
- 📤 **Send Artwork to Chat**: Bani hui drawing ko ek click mein export karke chat mein image message ki tarah send kiya ja sakta hai.

---

## 8. 📊 Interactive Polls System

- 📈 **Custom Poll Creation**: Question aur 2 se 6 options tak ke polls create karne ka option.
- 🔘 **Single / Multiple Choice Modes**: "Allow multiple answers" toggle support.
- 📊 **Real-Time Live Votes & Percentage Bars**: Vote dene par bina reload hue instantly percentage aur progress bar update hote hain.
- 🎨 **Poll Themes**: Alag-alag gradient aur colorful themes choose karne ka option.
- ✏️ **Edit Poll**: Poll creator options ya settings ko update kar sakta hai.

---

## 9. 👥 Groups & Community Management

- ➕ **Create Group**: Custom Group Name, Group Icon (Avatar upload), aur Group Bio/Description ke saath naye groups create karna.
- 👑 **Admin Role & Permissions**: Group creator automatically Admin hota hai jiske paas group edit karne aur members manage karne ke rights hote hain.
- 👥 **Add & Remove Members**: Search karke existing contacts ko group mein add karna ya remove karna.
- 🚪 **Leave Group**: Member apni marzi se kisi bhi waqt group leave kar sakta hai.
- 🖼️ **Group Profile Details**: Modal jisme group media, members list (with online status) aur bio display hota hai.

---

## 10. 🧠 AI Sentiment, Smart Replies & Mood Timeline

- 📊 **Conversation Mood Timeline**: Messages ke tone ko analyze karke conversation ka overall mood score chat header mein visually dikhata hai.
- 💡 **AI Suggested Quick Replies**: Conversation context ke hisaab se ready-made suggested quick replies chips (e.g. *"Sounds great! 👍"*, *"Let's call! 📞"*).
- ⏳ **10-Second Emotional Cooldown Send**: Agar user gusse ya hyper emotion mein message likhta hai, toh 10-second ka countdown timer milta hai jisse wo soch samajh kar bhej sake ya cancel kar sake.
- 🧵 **Branching Reply Threads**: WhatsApp aur Slack jaisa thread discussion drawer for specific topics.

---

## 11. ✨ UI/UX, Animations & Panda Mascot

- 🎆 **Cinematic Entrance Animation**: Login ke baad glowing cosmic particles aur typewriter welcome screen.
- 🐼 **Interactive 3D/CSS Panda Mascot**: Khali home screen par lively waving Panda hero jo app ko unique feel deta hai.
- 🌸 **Flower Confetti Explosion**: Panda mascot par click karne par screen par festive flower confetti shower aur fun greeting modal trigger hota hai.
- 🖼️ **Full Screen DP Viewer**: Profile photos ko HD mein view aur zoom karne ke liye modal.
- 🌓 **Themes & Visual Modes**: Responsive Dark/Light UI with glassmorphism effects.
- 🔊 **Haptic Audio Feedback**: Messages aane aur jaane par distinct pleasant audio sound effects (`sent.mp3`, `received.mp3`).

---

## 12. 🔐 Authentication & Account Verification

- 🔑 **Secure Authentication**: JWT (JSON Web Tokens) aur bcrypt encrypted passwords.
- ✉️ **Email Syntax & Domain Verification**: Fake emails prevent karne ke liye live regex aur domain validation.
- 🔢 **6-Digit OTP Email Verification Flow**: Sign-up ke waqt verification code workflow with demo test helpers.
- 🛡️ **Verified Profile Badges**: Verified users ke profile aur names ke saath green checkmark badge display hota hai.

---

## 13. 📱 Mobile & Android Native Support

- 📱 **Dynamic Viewport Height (`100dvh`)**: Mobile Chrome aur Safari par address bar aane-jaane se layout shift nahi hota.
- 🤖 **Capacitor Android Native App**:
  - Hardware-level `FLAG_SECURE` in Java `MainActivity` (anti-screenshot & anti-screen recording).
  - Native back navigation handling.
  - Native push notification support ready.
- 📲 **React Native / Expo Companion App**: Mobile directory (`/mobile`) mein dedicated cross-platform React Native code.

---

## 📊 Feature Summary Matrix (त्वरित सारांश)

| Feature Category | Features Included | Status |
| :--- | :--- | :--- |
| **Messaging** | Text, Voice Notes, Photos, Videos, Documents, Emojis | ✅ Fully Active |
| **Privacy** | Screenshot Block, Blur Detect, Ghost Unseen Mode, Incognito | ✅ Fully Active |
| **Chat Controls** | 24h Disappearing Messages, Block/Unblock, Clear Chat, Unsend | ✅ Fully Active |
| **Voice & Video** | 1-on-1 Calls, Group Calls, Screen Share, WebRTC P2P | ✅ Fully Active |
| **Collaboration** | Live Whiteboard, Interactive Polls, Reply Threads | ✅ Fully Active |
| **AI Features** | Mood Timeline, Cooldown Delay, Smart Suggested Replies | ✅ Fully Active |
| **Security** | JWT, OTP Verification, Bcrypt Passwords, Android `FLAG_SECURE` | ✅ Fully Active |
| **Mobile UX** | 100dvh, Full-Width Mic Voice Recorder, Drawer Sidebar | ✅ Fully Active |

---
*Created for PulseChat v2.0 • Real-Time Modern Communication Suite*
