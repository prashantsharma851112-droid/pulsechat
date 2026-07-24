import React, { useContext, useState } from 'react';
import { AuthContext } from './context/AuthContext';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Sidebar from './components/chat/Sidebar';
import ChatWindow from './components/chat/ChatWindow';
import ProfileModal from './components/profile/ProfileModal';
import SettingsModal from './components/profile/SettingsModal';
import CallModal from './components/chat/CallModal';

export default function App() {
  const { user, loading } = useContext(AuthContext);
  const [isRegisterView, setIsRegisterView] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeCall, setActiveCall] = useState(null);

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
    </div>
  );
}
