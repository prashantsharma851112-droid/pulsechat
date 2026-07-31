# ⚡ PulseChat - Next Gen Real-Time Messaging Platform

PulseChat is a modern, ultra-responsive WhatsApp & Discord hybrid messaging platform built with **Node.js, Express, Socket.io, MongoDB, and React**.

---

## 🌟 Key Features

### 📞 Real-Time WebRTC Calling
- 📹 **Peer-to-Peer Video & Audio Calls**: Built with WebRTC `RTCPeerConnection` & Socket.io signaling.
- 📺 **Live Screen Sharing**: Integrated `getDisplayMedia` screen sharing during calls.
- 🔔 **Incoming Call Ringing Overlay**: Animated ring indicator with instant Accept / Decline controls.

### 👥 Group Chat & Messaging
- 👥 **Group Chat Creation**: Create groups with custom names, avatars, descriptions, and multi-user selection.
- 🏷️ **Group Badges & Sender Previews**: Distinct group timeline rendering with member avatars.

### 📊 Interactive Polls
- 📈 **Real-Time Voting**: Create polls with 2–6 options and single/multiple choice toggles.
- 🗳️ **Live Progress Bars**: Real-time percentage bars & voter counts broadcast over WebSockets.

### 📧 Email Verification & Security
- ✉️ **Syntax & Domain Validation**: Real-time email validation on Login & Register.
- 🔑 **6-Digit OTP Verification Flow**: Email verification code system with on-screen demo helper.
- 🛡️ **Verified Badges**: Green checkmark badges on verified user profiles.

### ✨ Master Entrance & Interactive Panda Hero
- 🎆 **Post-Login Splash Animation**: Cinematic glowing particle entrance screen with dynamic typewriter welcome text.
- 🐼 **Interactive Waving Panda Mascot**: Animated 3D/CSS Panda hero on empty homepage.
- 🌸 **Flower Confetti Shower**: Click the Panda mascot to trigger a festive flower confetti explosion & greeting modal!

### 🗑️ Message Unsend & Deletion
- ❌ **Delete for Everyone (Unsend)**: Remove sent messages in real-time across all connected clients.
- 🗑️ **Delete for Me**: Clean local conversation history.

### 🚀 9 Next-Gen Ultra Features
1. 📊 **Conversation "Mood Timeline"**: Visual chat tone sentiment strip in chat header.
2. ⏳ **Time-Delayed "Cooldown Send"**: 10-second countdown delay for emotional messages.
3. 🧵 **Contextual Reply Threads**: Mini nested thread side panel for branching conversations.
4. 🕵️ **Selective Silent Mode**: Per-contact online visibility privacy toggle.
5. 🍂 **Smart Message Decay**: Auto-cleanup logic for inactive dead conversations.
6. 🎙️ **Voice Note Emotion Tags**: Auto transcription preview & emotion badges (`Calm`, `Excited`, `Urgent`).
7. 🎨 **Shared Whiteboard Canvas**: Interactive live collaborative doodle board per chat.
8. 🚨 **Panic Wipe Gesture**: Emergency PIN trigger to instantly clear local conversation cache.
9. 💡 **AI Style-Matched Smart Replies**: Suggested reply chips matching user message tone.

### 📱 Full Mobile & Desktop Responsiveness
- 📲 **Adaptive Layout**: Mobile split navigation (toggleable sidebar & back button for screens $\le 768\text{px}$).

---

## 🚀 How to Run Locally

### Step 1: Start Backend Server
```bash
cd backend
npm install
npm run dev
```
*Backend will run on http://localhost:5000*

### Step 2: Start Frontend App
```bash
cd frontend
npm install
npm run dev
```
*Frontend will run on http://localhost:5173*
