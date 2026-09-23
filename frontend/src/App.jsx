import React, { useContext, useState, useEffect, useRef, useCallback } from 'react';
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
import GroupCallModal from './components/chat/GroupCallModal';
import IncomingGroupCallModal from './components/chat/IncomingGroupCallModal';
import EntranceAnimation from './components/common/EntranceAnimation';
import PandaHero from './components/common/PandaHero';
import FullDpModal from './components/common/FullDpModal';
import Toast from './components/common/Toast';
import { BACKEND_URL } from './utils/config';
import { updateUserProfileInStorage, clearUnreadCount } from './utils/offlineStorage';
import { Zap, AlertTriangle } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("PulseChat ErrorBoundary caught error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: 'var(--bg-main, #000000)',
          color: 'var(--text-main, #ffffff)',
          textAlign: 'center'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem'
          }}>
            <AlertTriangle size={32} color="#ef4444" />
          </div>
          <h2 style={{ marginBottom: '0.5rem', fontWeight: 700 }}>PulseChat recovered safely</h2>
          <p style={{ color: 'var(--text-muted, #a1a1aa)', marginBottom: '1.5rem', maxWidth: '420px', fontSize: '0.9rem' }}>
            We protected your session from a blank screen. Click below to continue messaging.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false });
              window.location.href = '/';
            }}
            style={{
              padding: '10px 22px',
              borderRadius: '12px',
              background: 'var(--accent, #4f46e5)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem'
            }}
          >
            Reload Chats
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const { user, token, loading } = useContext(AuthContext);
  const { socket, lastNotification } = useContext(SocketContext);
  const [isRegisterView, setIsRegisterView] = useState(true);
  const [activeChat, setActiveChat] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [fullDpData, setFullDpData] = useState(null); // { imageUrl, name, username }

  // Entrance Animation state
  const [showEntrance, setShowEntrance] = useState(false);
  const userLoggedInRef = useRef(false);

  // WebRTC Call States (1-to-1 & Group)
  const [activeCall, setActiveCall] = useState(null); // { targetUser, isVideo, isCaller, incomingSignal }
  const [incomingCallData, setIncomingCallData] = useState(null);
  const [activeGroupCall, setActiveGroupCall] = useState(null); // { group, isVideo, isCaller }
  const [incomingGroupCallData, setIncomingGroupCallData] = useState(null);
  const [toasts, setToasts] = useState([]);

  const activeChatRef = useRef(activeChat);
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  // Real-time DP & Profile sync across activeChat and local caches
  useEffect(() => {
    if (!socket) return;

    const handleProfileUpdate = (data) => {
      if (!data) return;
      const targetUserId = data.userId;
      updateUserProfileInStorage(targetUserId, data, user?.id);

      // Instantly update activeChat if it's the user whose DP changed
      setActiveChat(prev => {
        if (!prev) return null;
        const isTarget = prev.id === targetUserId ||
          (data.userMongoId && (prev.id === data.userMongoId || prev._id === data.userMongoId)) ||
          (data.username && prev.username === data.username);

        if (isTarget) {
          return {
            ...prev,
            ...(data.displayName !== undefined && data.displayName !== '' && { displayName: data.displayName }),
            ...(data.avatar !== undefined && data.avatar !== '' && { avatar: data.avatar }),
            ...(data.status !== undefined && { status: data.status })
          };
        }
        return prev;
      });
    };

    socket.on('user_profile_updated', handleProfileUpdate);
    return () => socket.off('user_profile_updated', handleProfileUpdate);
  }, [socket, user?.id]);

  // Responsive Mobile Detection (screen width, user agent, touch points)
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    const isMobileWidth = window.innerWidth <= 1024;
    const isMobileAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    return isMobileWidth || (isMobileAgent && isTouch);
  });

  useEffect(() => {
    const handleResize = () => {
      const isMobileWidth = window.innerWidth <= 1024;
      const isMobileAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
      setIsMobile(isMobileWidth || (isMobileAgent && isTouch));
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Handle Browser Back Button & ESC Key for WhatsApp-style navigation
  const handleCloseChat = useCallback(() => {
    if (activeChatRef.current?.id && user?.id) {
      clearUnreadCount(user.id, activeChatRef.current.id);
      window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));
    }
    setActiveChat(null);
  }, [user?.id]);

  useEffect(() => {
    const handlePopState = () => {
      handleCloseChat();
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && activeChatRef.current) {
        handleCloseChat();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleCloseChat]);

  const handleSelectActiveChat = (chat) => {
    if (chat?.id && user?.id) {
      clearUnreadCount(user.id, chat.id);
      window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));
    }
    setActiveChat(chat);
    if (chat) {
      window.history.pushState({ chatOpen: true }, '');
    }
  };

  const openChatById = useCallback(async (targetChatId, targetSenderId, isGroupTarget) => {
    const authToken = token || localStorage.getItem('pulsechat_token');
    if (!authToken) return;

    try {
      // 1. Group chat navigation
      if (isGroupTarget || (targetChatId && targetChatId.startsWith('group_'))) {
        const res = await fetch(`${BACKEND_URL}/api/groups/${targetChatId}`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (res.ok) {
          const groupData = await res.json();
          if (groupData && groupData.id) {
            handleSelectActiveChat({
              ...groupData,
              isGroup: true,
              displayName: groupData.name,
              id: groupData.id
            });
            return;
          }
        }
      }

      // 2. Direct 1-on-1 chat navigation
      let partnerId = targetSenderId;
      if (!partnerId && targetChatId) {
        const parts = targetChatId.split('_');
        if (user && parts.length === 2) {
          partnerId = parts.find(p => p !== user.id);
        } else if (parts.length === 1) {
          partnerId = parts[0];
        }
      }

      if (partnerId && partnerId !== user?.id) {
        const res = await fetch(`${BACKEND_URL}/api/users/${partnerId}`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (res.ok) {
          const userData = await res.json();
          if (userData && userData.id) {
            handleSelectActiveChat(userData);
            return;
          }
        }
      }
    } catch (err) {
      console.warn('Failed to open chat from notification:', err);
    }
  }, [token, user]);

  // Deep-link from notification clicks (when app opens with ?openChat=...)
  useEffect(() => {
    if (!user) return;

    const urlParams = new URLSearchParams(window.location.search);
    const openChat = urlParams.get('openChat');
    const senderId = urlParams.get('senderId');
    const isGroup = urlParams.get('isGroup') === '1' || urlParams.get('isGroup') === 'true';

    if (openChat || senderId) {
      window.history.replaceState({}, document.title, window.location.pathname);
      openChatById(openChat, senderId, isGroup);
    }
  }, [user, openChatById]);

  // Handle service worker & desktop notification click events
  useEffect(() => {
    if (!user) return;

    const handleServiceWorkerMessage = (event) => {
      if (event.data?.type === 'OPEN_CHAT') {
        const { chatId, senderId, isGroup } = event.data;
        openChatById(chatId, senderId, isGroup);
      }
    };

    const handleCustomEvent = (event) => {
      if (event.detail) {
        const { chatId, senderId, isGroup } = event.detail;
        openChatById(chatId, senderId, isGroup);
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }
    window.addEventListener('pulsechat_open_chat', handleCustomEvent);

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
      window.removeEventListener('pulsechat_open_chat', handleCustomEvent);
    };
  }, [user, openChatById]);

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

  // Toast notifications for unviewed chats & friend requests
  useEffect(() => {
    if (!lastNotification) return;
    const currentlyOpenId = activeChatRef.current?.id;
    if (lastNotification.senderId === currentlyOpenId && !lastNotification.isFriendRequest && !lastNotification.isFriendAccepted) return;

    const toastId = lastNotification.id + '_' + lastNotification.receivedAt;
    const senderTitle = lastNotification.isGroup
      ? (lastNotification.groupName || 'Group')
      : (lastNotification.title || lastNotification.senderName || lastNotification.senderId || 'New message');

    setToasts(prev => [...prev, {
      id: toastId,
      title: senderTitle,
      avatar: lastNotification.senderAvatar || lastNotification.avatar || null,
      senderId: lastNotification.senderId,
      chatId: lastNotification.chatId,
      isGroup: !!lastNotification.isGroup,
      isFriendRequest: !!lastNotification.isFriendRequest,
      isFriendAccepted: !!lastNotification.isFriendAccepted,
      body: lastNotification.content || (lastNotification.type === 'text' ? lastNotification.content : `Sent a ${lastNotification.type}`)
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

  // Group Call Socket Listener
  useEffect(() => {
    if (!socket) return;

    const handleIncomingGroupCall = (data) => {
      setIncomingGroupCallData(data);
    };

    socket.on('incoming_group_call', handleIncomingGroupCall);
    return () => socket.off('incoming_group_call', handleIncomingGroupCall);
  }, [socket]);

  const handleAcceptIncomingGroupCall = () => {
    if (incomingGroupCallData) {
      setActiveGroupCall({
        group: {
          id: incomingGroupCallData.groupId,
          name: incomingGroupCallData.groupName,
          displayName: incomingGroupCallData.groupName,
          avatar: incomingGroupCallData.callerAvatar
        },
        isVideo: incomingGroupCallData.isVideo,
        isCaller: false
      });
      setIncomingGroupCallData(null);
    }
  };

  const handleDeclineIncomingGroupCall = () => {
    setIncomingGroupCallData(null);
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

  const handleOpenFullDp = (imageUrl, name, username) => {
    const validUrl = imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username || 'pulse'}`;
    setFullDpData({ imageUrl: validUrl, name, username });
  };

  return (
    <ErrorBoundary>
      <div className={`app-root-container ${isMobile ? 'is-mobile' : 'is-desktop'}`} style={{ display: 'flex', height: '100dvh', width: '100dvw', overflow: 'hidden', position: 'relative' }}>
      {/* Master Post-Login Entrance Animation */}
      {showEntrance && (
        <EntranceAnimation
          user={user}
          onComplete={() => setShowEntrance(false)}
        />
      )}

      {/* WHATSAPP-STYLE RESPONSIVE NAVIGATION: Mobile shows ONLY 1 screen at a time, Desktop shows split view */}
      {isMobile ? (
        activeChat ? (
          <ChatWindow
            activeChat={activeChat}
            onBack={handleCloseChat}
            onStartCall={(isVideo, targetMember) => setActiveCall({
              targetUser: targetMember || activeChat,
              isVideo,
              isCaller: true,
              incomingSignal: null
            })}
            onStartGroupCall={(group, isVideo) => setActiveGroupCall({
              group,
              isVideo,
              isCaller: true
            })}
            onOpenFullDp={handleOpenFullDp}
          />
        ) : (
          <Sidebar
            activeChat={activeChat}
            setActiveChat={handleSelectActiveChat}
            openProfileModal={() => setShowProfile(true)}
            openSettingsModal={() => setShowSettings(true)}
            onOpenFullDp={handleOpenFullDp}
          />
        )
      ) : (
        /* Desktop Split Screen View */
        <>
          <Sidebar
            activeChat={activeChat}
            setActiveChat={handleSelectActiveChat}
            openProfileModal={() => setShowProfile(true)}
            openSettingsModal={() => setShowSettings(true)}
            onOpenFullDp={handleOpenFullDp}
          />

          {activeChat ? (
            <ChatWindow
              activeChat={activeChat}
              onBack={handleCloseChat}
              onStartCall={(isVideo, targetMember) => setActiveCall({
                targetUser: targetMember || activeChat,
                isVideo,
                isCaller: true,
                incomingSignal: null
              })}
              onStartGroupCall={(group, isVideo) => setActiveGroupCall({
                group,
                isVideo,
                isCaller: true
              })}
              onOpenFullDp={handleOpenFullDp}
            />
          ) : (
            <div className="empty-chat-placeholder">
              <PandaHero />
            </div>
          )}
        </>
      )}

      {showProfile && (
        <ProfileModal
          onClose={() => setShowProfile(false)}
          onOpenFullDp={handleOpenFullDp}
        />
      )}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          openProfileModal={() => { setShowSettings(false); setShowProfile(true); }}
          onOpenFullDp={handleOpenFullDp}
        />
      )}

      {/* Full Screen DP Lightbox Modal */}
      {fullDpData && (
        <FullDpModal
          imageUrl={fullDpData.imageUrl}
          name={fullDpData.name}
          username={fullDpData.username}
          onClose={() => setFullDpData(null)}
        />
      )}

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

      {/* Real-Time Multi-Party Group Call Window */}
      {activeGroupCall && (
        <GroupCallModal
          group={activeGroupCall.group}
          isVideo={activeGroupCall.isVideo}
          isCaller={activeGroupCall.isCaller}
          onClose={() => setActiveGroupCall(null)}
        />
      )}

      {/* Incoming Group Call Popup */}
      {incomingGroupCallData && (
        <IncomingGroupCallModal
          callData={incomingGroupCallData}
          onAccept={handleAcceptIncomingGroupCall}
          onDecline={handleDeclineIncomingGroupCall}
        />
      )}

      {/* Toast Notifications */}
      <div style={{ position: 'fixed', top: '20px', right: '20px', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 1000 }}>
        {toasts.map(t => (
          <Toast
            key={t.id}
            title={t.title || "New message"}
            body={t.body}
            avatar={t.avatar}
            onClick={() => {
              if (t.isFriendRequest || t.isFriendAccepted) {
                window.dispatchEvent(new CustomEvent('pulsechat_open_tab', { detail: { tab: 'friends', subTab: t.isFriendRequest ? 'requests' : 'friends' } }));
              } else {
                openChatById(t.chatId, t.senderId, t.isGroup);
              }
              dismissToast(t.id);
            }}
            onDismiss={() => dismissToast(t.id)}
          />
        ))}
      </div>
      </div>
    </ErrorBoundary>
  );
}
