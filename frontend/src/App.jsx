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
import Toast from './components/common/Toast';

export default function App() {
  const { user, loading } = useContext(AuthContext);
  const { lastNotification } = useContext(SocketContext);
  const [isRegisterView, setIsRegisterView] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeCall, setActiveCall] = useState(null);
  const [toasts, setToasts] = useState([]);
  const activeChatRef = useRef(activeChat);
  activeChatRef.current = activeChat;

  // Show a toast ONLY when the message isn't for the chat you're currently
  // looking at (if you're already looking at it, ChatWindow shows it inline).
  useEffect(() => {
    if (!lastNotification) return;
    const currentlyOpenId = activeChatRef.current?.id;
    if (lastNotification.senderId === currentlyOpenId) return;

    const toastId = lastNotification.id + '_' + lastNotification.receivedAt;
    setToasts(prev => [...prev, { id: toastId, senderId: lastNotification.senderId, body: lastNotification.type === 'text' ? lastNotification.content : `Sent a ${lastNotification.type}` }]);
  }, [lastNotification]);

  const dismissToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  if (loading) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)' }}>Loading PulseChat...</div>;
  }

  if (!user) {
    return isRegisterView ? (
      <Register switchToLogin={() => setIsRegisterView(false)} />
    ) : (
      <Login switchToRegister={() => setIsRegisterView(true)} />
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Sidebar 
        activeChat={activeChat} 
        setActiveChat={setActiveChat} 
        openProfileModal={() => setShowProfile(true)}
        openSettingsModal={() => setShowSettings(true)}
      />

      {activeChat ? (
        <ChatWindow 
          activeChat={activeChat} 
          onStartCall={(isVideo) => setActiveCall({ isVideo })} 
        />
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-chat)' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Welcome to PulseChat 👋</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Select or search a user from sidebar using unique @username to start messaging!</p>
        </div>
      )}

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {activeCall && <CallModal user={activeChat} isVideo={activeCall.isVideo} onClose={() => setActiveCall(null)} />}

      {/* Toast notifications for new messages from chats you're not currently viewing */}
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
