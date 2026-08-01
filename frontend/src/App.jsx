import React, { useContext, useState, useEffect, useRef } from 'react';
import { AuthContext } from './context/AuthContext';
import { SocketContext } from './context/SocketContext';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Sidebar from './components/chat/Sidebar';
import ChatWindow from './components/chat/ChatWindow';
import ProfileModal from './components/profile/ProfileModal';
import SettingsModal from './components/profile/SettingsModal';
import CallModal from './components/chat/CallModal';
import IncomingCallModal from './components/chat/IncomingCallModal';
import EntranceAnimation from './components/common/EntranceAnimation';
import PandaHero from './components/common/PandaHero';
import Toast from './components/common/Toast';
import { Zap } from 'lucide-react';

export default function App() {
  const { user, loading } = useContext(AuthContext);
  const { socket, lastNotification } = useContext(SocketContext);
  const [isRegisterView, setIsRegisterView] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Entrance Animation state
  const [showEntrance, setShowEntrance] = useState(false);
  const userLoggedInRef = useRef(false);

  // WebRTC Call States
  const [activeCall, setActiveCall] = useState(null); // { targetUser, isVideo, isCaller, incomingSignal }
  const [incomingCallData, setIncomingCallData] = useState(null);
  const [toasts, setToasts] = useState([]);

  const activeChatRef = useRef(activeChat);
  activeChatRef.current = activeChat;

  // Trigger entrance animation when user logs in
  useEffect(() => {
    if (user && !userLoggedInRef.current) {
      userLoggedInRef.current = true;
      setShowEntrance(true);
    } else if (!user) {
      userLoggedInRef.current = false;
      setShowEntrance(false);
    }
  }, [user]);

  const pendingIceCandidatesRef = useRef([]);

  // Listen for incoming calls & buffer early ICE candidates during ringing
  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = (data) => {
      pendingIceCandidatesRef.current = [];
      setIncomingCallData(data);
    };

    const handleEarlyCandidate = ({ candidate }) => {
      if (candidate) {
        pendingIceCandidatesRef.current.push(candidate);
      }
    };

    socket.on('incoming_call', handleIncomingCall);
    socket.on('ice_candidate', handleEarlyCandidate);

    return () => {
      socket.off('incoming_call', handleIncomingCall);
      socket.off('ice_candidate', handleEarlyCandidate);
    };
  }, [socket]);

  // Toast notifications for unviewed chats
  useEffect(() => {
    if (!lastNotification) return;
    const currentlyOpenId = activeChatRef.current?.id;
    if (lastNotification.senderId === currentlyOpenId) return;

    const toastId = lastNotification.id + '_' + lastNotification.receivedAt;
    setToasts(prev => [...prev, {
      id: toastId,
      senderId: lastNotification.senderId,
      body: lastNotification.type === 'text' ? lastNotification.content : `Sent a ${lastNotification.type}`
    }]);
  }, [lastNotification]);

  const dismissToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleAcceptIncomingCall = () => {
    if (!incomingCallData) return;
    setActiveCall({
      targetUser: {
        id: incomingCallData.from,
        displayName: incomingCallData.callerName,
        avatar: incomingCallData.callerAvatar
      },
      isVideo: incomingCallData.isVideo,
      isCaller: false,
      incomingSignal: incomingCallData.signal,
      initialCandidates: [...pendingIceCandidatesRef.current]
    });
    pendingIceCandidatesRef.current = [];
    setIncomingCallData(null);
  };

  const handleDeclineIncomingCall = () => {
    if (incomingCallData && socket) {
      socket.emit('reject_call', { to: incomingCallData.from });

      const chatId = [user.id, incomingCallData.from].sort().join('_');
      socket.emit('send_message', {
        chatId,
        senderId: incomingCallData.from,
        receiverId: user.id,
        isGroup: false,
        type: 'call',
        content: incomingCallData.isVideo ? 'Video Call' : 'Voice Call',
        callData: {
          isVideo: incomingCallData.isVideo,
          status: 'declined',
          duration: 0
        }
      });
    }
    setIncomingCallData(null);
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', color: 'var(--text-main)' }}>
        Loading PulseChat...
      </div>
    );
  }

  if (!user) {
    return isRegisterView ? (
      <Register switchToLogin={() => setIsRegisterView(false)} />
    ) : (
      <Login switchToRegister={() => setIsRegisterView(true)} />
    );
  }

  return (
    <div style={{ display: 'flex', height: '100dvh', width: '100dvw', overflow: 'hidden', position: 'relative' }}>
      {/* Master Post-Login Entrance Animation */}
      {showEntrance && (
        <EntranceAnimation
          user={user}
          onComplete={() => setShowEntrance(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        activeChat={activeChat}
        setActiveChat={setActiveChat}
        openProfileModal={() => setShowProfile(true)}
        openSettingsModal={() => setShowSettings(true)}
      />

      {/* Main Chat Area */}
      {activeChat ? (
        <ChatWindow
          activeChat={activeChat}
          onBack={() => setActiveChat(null)}
          onStartCall={(isVideo) => setActiveCall({
            targetUser: activeChat,
            isVideo,
            isCaller: true,
            incomingSignal: null
          })}
        />
      ) : (
        <div className="empty-chat-placeholder">
          <PandaHero />
        </div>
      )}

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {/* Incoming Call Popup */}
      {incomingCallData && (
        <IncomingCallModal
          callData={incomingCallData}
          onAccept={handleAcceptIncomingCall}
          onDecline={handleDeclineIncomingCall}
        />
      )}

      {/* WebRTC Video/Audio Call Window */}
      {activeCall && (
        <CallModal
          targetUser={activeCall.targetUser}
          isVideo={activeCall.isVideo}
          isCaller={activeCall.isCaller}
          incomingSignal={activeCall.incomingSignal}
          initialCandidates={activeCall.initialCandidates}
          onClose={() => setActiveCall(null)}
        />
      )}

      {/* Toast Notifications */}
      <div style={{ position: 'fixed', top: '20px', right: '20px', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 1000 }}>
        {toasts.map(t => (
          <Toast
            key={t.id}
            title="New message"
            body={t.body}
            onClick={() => dismissToast(t.id)}
            onDismiss={() => dismissToast(t.id)}
          />
        ))}
      </div>
    </div>
  );
}
