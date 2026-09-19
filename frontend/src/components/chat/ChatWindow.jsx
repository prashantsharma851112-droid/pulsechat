import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { Send, Mic, Phone, Video, Smile, BarChart2, ArrowLeft, Users, Paintbrush, Clock, Sparkles, Image as ImageIcon, Paperclip, CheckSquare, Trash2, X, Check, MoreVertical, Info, CornerUpLeft, FileText, Ban, ShieldAlert, WifiOff } from 'lucide-react';
import MessageItem from './MessageItem';
import VoiceRecorder from './VoiceRecorder';
import EmojiPicker from './EmojiPicker';
import CreatePollModal from './CreatePollModal';
import WhiteboardModal from './WhiteboardModal';
import UserProfileModal from './UserProfileModal';
import GroupProfileModal from './GroupProfileModal';
import MediaUploadModal from './MediaUploadModal';
import { playSound } from '../../utils/audio';
import { BACKEND_URL } from '../../utils/config';
import { isEmotionalTriggerMessage, calculateConversationMoodTimeline } from '../../utils/sentiment';
import {
  getCachedMessages,
  setCachedMessages,
  appendCachedMessage,
  updateCachedMessageStatus,
  getOutbox,
  addToOutbox,
  removeFromOutbox,
  updateRecentChatSnippet,
  isDeviceOnline,
  subscribeToNetworkChanges
} from '../../utils/offlineStorage';

export default function ChatWindow({ activeChat, onBack, onStartCall, onStartGroupCall, onOpenFullDp }) {
  const { user, token, blockUser, unblockUser } = useContext(AuthContext);
  const { socket, onlineUsers, typingMap } = useContext(SocketContext);

  const isGroup = !!activeChat.isGroup;
  const chatId = isGroup ? activeChat.id : [user.id, activeChat.id].sort().join('_');
  const isOnline = !isGroup && onlineUsers.includes(activeChat.id);
  const isTyping = typingMap[chatId] === activeChat.username;

  const [messages, setMessages] = useState(() => {
    const cached = getCachedMessages(chatId);
    const outbox = getOutbox(user?.id);
    const pendingForThisChat = outbox.filter(m => m.chatId === chatId);
    const cachedIds = new Set(cached.map(m => m.id));
    return [...cached, ...pendingForThisChat.filter(p => !cachedIds.has(p.id))];
  });
  const [isNetConnected, setIsNetConnected] = useState(() => isDeviceOnline());

  const [text, setText] = useState('');
  const [showRecorder, setShowRecorder] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [showGroupProfileModal, setShowGroupProfileModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [pendingMedia, setPendingMedia] = useState(null);
  const [groupMembersMap, setGroupMembersMap] = useState({});
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Reply state (WhatsApp style)
  const [replyTo, setReplyTo] = useState(null);
  const replyInputRef = useRef(null);

  // Track if this is the initial load (to use instant scroll vs smooth scroll)
  const isInitialLoad = useRef(true);

  // Multi-Select & Clear Chat states
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState([]);
  const [clearedBackup, setClearedBackup] = useState([]);
  const [clearedUndoSecs, setClearedUndoSecs] = useState(0);
  const [multiDeleteBackupIds, setMultiDeleteBackupIds] = useState([]);
  const [multiDeleteUndoSecs, setMultiDeleteUndoSecs] = useState(0);

  // Cooldown timer state (10s delayed send option)
  const [cooldownSecs, setCooldownSecs] = useState(0);
  const [cooldownMsg, setCooldownMsg] = useState(null);

  // Chat settings & block status
  const [chatSetting, setChatSetting] = useState({ disappearingEnabled: false });
  const [blockStatus, setBlockStatus] = useState({ isBlockedByMe: false, isBlockedByThem: false });

  // Automatic Outbox Sync when network or socket reconnects
  const syncOutbox = useCallback(() => {
    if (!user?.id || !socket || !socket.connected) return;
    const outbox = getOutbox(user.id);
    if (!outbox || outbox.length === 0) return;

    outbox.forEach((pendingMsg) => {
      socket.emit('send_message', {
        chatId: pendingMsg.chatId,
        senderId: pendingMsg.senderId,
        receiverId: pendingMsg.receiverId,
        isGroup: pendingMsg.isGroup,
        content: pendingMsg.content,
        type: pendingMsg.type || 'text',
        audioUrl: pendingMsg.audioUrl,
        mediaUrl: pendingMsg.mediaUrl,
        pollData: pendingMsg.pollData,
        replyTo: pendingMsg.replyTo,
        clientTempId: pendingMsg.clientTempId || pendingMsg.id
      });

      // Optimistically update message status to 'sent'
      updateCachedMessageStatus(pendingMsg.chatId, pendingMsg.id, 'sent');
      setMessages(prev => prev.map(m => (m.id === pendingMsg.id || m.clientTempId === pendingMsg.id) ? { ...m, status: 'sent' } : m));
      removeFromOutbox(user.id, pendingMsg.id);
      if (pendingMsg.clientTempId) {
        removeFromOutbox(user.id, pendingMsg.clientTempId);
      }
    });
  }, [user?.id, socket]);

  useEffect(() => {
    const unsub = subscribeToNetworkChanges((online) => {
      setIsNetConnected(online);
      if (online) {
        syncOutbox();
      }
    });
    return unsub;
  }, [syncOutbox]);

  useEffect(() => {
    if (socket) {
      const handleConnect = () => {
        setIsNetConnected(true);
        syncOutbox();
      };
      socket.on('connect', handleConnect);
      if (socket.connected) {
        syncOutbox();
      }
      return () => socket.off('connect', handleConnect);
    }
  }, [socket, syncOutbox]);

  // Close 3-dots more menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.chat-header-more-container')) {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) {
      document.addEventListener('click', handleOutsideClick);
      return () => document.removeEventListener('click', handleOutsideClick);
    }
  }, [showMoreMenu]);

  // Load message history & group details
  useEffect(() => {
    // Chat badle toh reply aur initial scroll flag reset karo
    isInitialLoad.current = true;
    setReplyTo(null);
    setChatSetting({ disappearingEnabled: false });
    setBlockStatus({ isBlockedByMe: false, isBlockedByThem: false });

    if (activeChat) {
      // 1. Instantly display cached messages from local storage
      const cached = getCachedMessages(chatId);
      const outbox = getOutbox(user?.id);
      const pendingForThisChat = outbox.filter(m => m.chatId === chatId);
      const cachedIds = new Set(cached.map(m => m.id));
      const combinedInitial = [...cached, ...pendingForThisChat.filter(p => !cachedIds.has(p.id))];
      setMessages(combinedInitial);

      // 2. Fetch fresh messages if online
      fetch(`${BACKEND_URL}/api/messages/${chatId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            const currentOutbox = getOutbox(user?.id);
            const pendingForChat = currentOutbox.filter(m => m.chatId === chatId);
            const serverIds = new Set(data.map(m => m.id));
            const activePending = pendingForChat.filter(p => !serverIds.has(p.id) && !serverIds.has(p.clientTempId));
            const merged = [...data, ...activePending];
            setMessages(merged);
            setCachedMessages(chatId, merged);
          }
        })
        .catch(() => {
          // Offline: messages already loaded from cache!
        });

      // Fetch disappearing messages setting
      fetch(`${BACKEND_URL}/api/messages/settings/${chatId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data?.disappearingEnabled !== undefined) setChatSetting(data);
        })
        .catch(() => {});

      // Fetch block status (only for 1-to-1 chats)
      if (!isGroup) {
        fetch(`${BACKEND_URL}/api/users/${activeChat.id}/block-status`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => {
            if (data) setBlockStatus(data);
          })
          .catch(() => {});
      }

      if (isGroup) {
        fetch(`${BACKEND_URL}/api/groups/${activeChat.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => {
            if (data.memberUsers) {
              const map = {};
              data.memberUsers.forEach(u => {
                map[u.id] = u;
              });
              setGroupMembersMap(map);
            }
          });
      }

      if (socket) {
        socket.emit('join_chat', chatId);
        socket.emit('mark_chat_read', { chatId, userId: user.id });
      }
    }
  }, [activeChat, chatId, isGroup, token, socket, user.id]);

  // Listen to incoming messages & poll/deletion updates
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => {
      if (msg.chatId === chatId) {
        setMessages(prev => {
          const matchIdx = prev.findIndex(m =>
            (msg.clientTempId && (m.id === msg.clientTempId || m.clientTempId === msg.clientTempId)) ||
            m.id === msg.id
          );
          let updated;
          if (matchIdx !== -1) {
            updated = [...prev];
            updated[matchIdx] = msg;
          } else {
            updated = [...prev, msg];
          }
          setCachedMessages(chatId, updated);
          return updated;
        });

        if (msg.clientTempId) {
          removeFromOutbox(user?.id, msg.clientTempId);
        }

        updateRecentChatSnippet(user?.id, chatId, msg);
        window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));

        if (msg.senderId !== user.id) {
          playSound('received');
          socket.emit('mark_read', { messageId: msg.id, chatId });
        }
      }
    };

    const handlePollUpdate = ({ messageId, pollData }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, pollData } : m));
    };

    const handlePollEdit = ({ messageId, pollData }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, pollData } : m));
    };

    const handleMessageDeleted = ({ messageId }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, type: 'deleted', content: 'This message was deleted' } : m));
    };

    const handleReadUpdate = ({ messageId, status }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status } : m));
    };

    const handleReactionUpdated = ({ messageId, reactions }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
    };

    const handleMessageRestored = ({ restoredMsg }) => {
      setMessages(prev => prev.map(m => m.id === restoredMsg.id ? restoredMsg : m));
    };

    const handleChatCleared = ({ chatId: targetChatId }) => {
      if (targetChatId === chatId) setMessages([]);
    };

    const handleChatRestored = ({ chatId: targetChatId, messages: restoredMsgs }) => {
      if (targetChatId === chatId && Array.isArray(restoredMsgs)) {
        setMessages(restoredMsgs);
      }
    };

    const handleMultipleDeleted = ({ messageIds: targetIds, chatId: targetChatId }) => {
      if (targetChatId === chatId) {
        setMessages(prev => prev.map(m => targetIds.includes(m.id) ? { ...m, type: 'deleted', content: 'This message was deleted' } : m));
      }
    };

    const handleMultipleRestored = ({ messageIds: targetIds, chatId: targetChatId }) => {
      if (targetChatId === chatId) {
        fetch(`${BACKEND_URL}/api/messages/${chatId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data)) setMessages(data);
          });
      }
    };

    const handleChatReadUpdate = ({ chatId: targetChatId, userId }) => {
      if (targetChatId === chatId && userId !== user.id) {
        setMessages(prev => prev.map(m => m.senderId === user.id ? { ...m, status: 'read' } : m));
      }
    };

    const handleMessageDeliveredUpdate = ({ messageId, status }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status: (m.status === 'read' ? 'read' : (status || 'delivered')) } : m));
    };

    const handleMessagesDelivered = ({ messageIds, status }) => {
      if (Array.isArray(messageIds) && messageIds.length > 0) {
        const idSet = new Set(messageIds);
        setMessages(prev => prev.map(m => idSet.has(m.id) ? { ...m, status: (m.status === 'read' ? 'read' : (status || 'delivered')) } : m));
      }
    };

    const handleChatSettingUpdated = (setting) => {
      if (setting && setting.chatId === chatId) {
        setChatSetting(setting);
      }
    };

    const handleMessageBlocked = ({ reason }) => {
      alert(reason || 'Message blocked: Communication not allowed.');
    };

    socket.on('new_message', handleNewMessage);
    socket.on('poll_updated', handlePollUpdate);
    socket.on('poll_edited', handlePollEdit);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('message_read_update', handleReadUpdate);
    socket.on('chat_read_update', handleChatReadUpdate);
    socket.on('message_delivered_update', handleMessageDeliveredUpdate);
    socket.on('messages_delivered', handleMessagesDelivered);
    socket.on('reaction_updated', handleReactionUpdated);
    socket.on('message_restored', handleMessageRestored);
    socket.on('chat_cleared', handleChatCleared);
    socket.on('chat_restored', handleChatRestored);
    socket.on('multiple_messages_deleted', handleMultipleDeleted);
    socket.on('multiple_messages_restored', handleMultipleRestored);
    socket.on('chat_setting_updated', handleChatSettingUpdated);
    socket.on('message_blocked', handleMessageBlocked);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('poll_updated', handlePollUpdate);
      socket.off('poll_edited', handlePollEdit);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('message_read_update', handleReadUpdate);
      socket.off('chat_read_update', handleChatReadUpdate);
      socket.off('message_delivered_update', handleMessageDeliveredUpdate);
      socket.off('messages_delivered', handleMessagesDelivered);
      socket.off('reaction_updated', handleReactionUpdated);
      socket.off('message_restored', handleMessageRestored);
      socket.off('chat_cleared', handleChatCleared);
      socket.off('chat_restored', handleChatRestored);
      socket.off('multiple_messages_deleted', handleMultipleDeleted);
      socket.off('multiple_messages_restored', handleMultipleRestored);
      socket.off('chat_setting_updated', handleChatSettingUpdated);
      socket.off('message_blocked', handleMessageBlocked);
    };
  }, [socket, chatId, user.id, token]);

  const [undoMessageId, setUndoMessageId] = useState(null);

  const handleUndoDelete = () => {
    if (undoMessageId && socket) {
      socket.emit('restore_message', { messageId: undoMessageId, chatId });
      setUndoMessageId(null);
    }
  };

  const handleTriggerUndoToast = (msgId) => {
    setUndoMessageId(msgId);
    setTimeout(() => {
      setUndoMessageId(prev => (prev === msgId ? null : prev));
    }, 6000);
  };

  useEffect(() => {
    if (messages.length === 0) return;
    if (isInitialLoad.current) {
      // Pehli baar load ho toh instantly last message pe jaao
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      isInitialLoad.current = false;
    } else {
      // Naya message aaye toh smoothly scroll karo
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Clear Chat Undo Timer
  useEffect(() => {
    let timer;
    if (clearedUndoSecs > 0) {
      timer = setInterval(() => {
        setClearedUndoSecs(prev => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [clearedUndoSecs]);

  // Multi-Delete Undo Timer
  useEffect(() => {
    let timer;
    if (multiDeleteUndoSecs > 0) {
      timer = setInterval(() => {
        setMultiDeleteUndoSecs(prev => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [multiDeleteUndoSecs]);

  // Clear Entire Current Chat
  const handleClearCurrentChat = () => {
    if (!messages || messages.length === 0) return;
    if (!window.confirm(`Clear all messages in "${activeChat.displayName}"?`)) return;

    const backup = [...messages];
    setClearedBackup(backup);
    setClearedUndoSecs(8);

    if (socket) {
      socket.emit('clear_chat', { chatId });
    }
    setMessages([]);
  };

  const handleUndoClearChat = () => {
    if (clearedBackup.length > 0 && socket) {
      socket.emit('restore_chat_messages', { chatId, messages: clearedBackup });
      setMessages(clearedBackup);
      setClearedBackup([]);
      setClearedUndoSecs(0);
    }
  };

  // Multi-Select Message Operations
  const handleToggleSelectMsg = (msgId) => {
    setSelectedMsgIds(prev =>
      prev.includes(msgId) ? prev.filter(id => id !== msgId) : [...prev, msgId]
    );
  };

  const handleDeleteSelectedMessages = () => {
    if (selectedMsgIds.length === 0) return;

    const idsToDelete = [...selectedMsgIds];
    setMultiDeleteBackupIds(idsToDelete);
    setMultiDeleteUndoSecs(8);

    if (socket) {
      socket.emit('delete_multiple_messages', { messageIds: idsToDelete, chatId });
    }
    setMessages(prev => prev.map(m => idsToDelete.includes(m.id) ? { ...m, type: 'deleted', content: 'This message was deleted' } : m));
    setSelectedMsgIds([]);
    setIsMultiSelectMode(false);
  };

  const handleUndoMultiDelete = () => {
    if (multiDeleteBackupIds.length > 0 && socket) {
      socket.emit('restore_multiple_messages', { messageIds: multiDeleteBackupIds, chatId });
      setMultiDeleteBackupIds([]);
      setMultiDeleteUndoSecs(0);
    }
  };

  const dispatchMessage = (msgContent) => {
    if (!msgContent) return;

    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const isOnlineNow = isDeviceOnline() && socket?.connected;

    const pendingMsg = {
      id: tempId,
      clientTempId: tempId,
      chatId,
      senderId: user.id,
      receiverId: isGroup ? '' : activeChat.id,
      isGroup,
      content: msgContent,
      type: 'text',
      status: isOnlineNow ? 'sent' : 'pending',
      timestamp: new Date().toISOString(),
      reactions: {},
      viewedBy: [],
      replyTo: replyTo ? {
        id: replyTo.id,
        content: replyTo.content,
        type: replyTo.type,
        senderId: replyTo.senderId,
        senderName: replyTo.senderName || replyTo.senderId
      } : null
    };

    // 1. Optimistic UI update: message appears instantly in chat!
    setMessages(prev => [...prev, pendingMsg]);
    appendCachedMessage(chatId, pendingMsg);

    // 2. Update recent chats snippet in localStorage & dispatch event for sidebar
    updateRecentChatSnippet(user.id, chatId, pendingMsg);
    window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));

    // 3. If offline or socket disconnected, save to outbox
    if (!isOnlineNow) {
      addToOutbox(user.id, pendingMsg);
      setReplyTo(null);
      playSound('sent');
      return;
    }

    // 4. Online: emit over socket
    socket.emit('send_message', {
      chatId,
      senderId: user.id,
      receiverId: isGroup ? '' : activeChat.id,
      isGroup,
      content: msgContent,
      type: 'text',
      clientTempId: tempId,
      replyTo: pendingMsg.replyTo
    });

    setReplyTo(null); // Reply clear karo bhejne ke baad
    playSound('sent');
  };

  const handleSendText = (e, forceInstant = false) => {
    e?.preventDefault();
    if (!text.trim()) return;

    // Check emotional trigger words for 3s cooldown using sentiment utility
    if (isEmotionalTriggerMessage(text) && !forceInstant) {
      setCooldownMsg(text);
      setCooldownSecs(3);
      setText('');
      socket.emit('typing_stop', { chatId, userId: user.id });
      return;
    }

    dispatchMessage(text);
    setText('');
    socket.emit('typing_stop', { chatId, userId: user.id });
  };

  // Emotional Message Countdown Timer (3s -> auto send)
  useEffect(() => {
    let timer;
    if (cooldownSecs > 0) {
      timer = setInterval(() => {
        setCooldownSecs(prev => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldownSecs]);

  // When cooldown reaches 0, auto-send message so it doesn't get stuck!
  useEffect(() => {
    if (cooldownSecs === 0 && cooldownMsg) {
      dispatchMessage(cooldownMsg);
      setCooldownMsg(null);
    }
  }, [cooldownSecs, cooldownMsg]);

  const sendCooldownNow = () => {
    if (cooldownMsg) {
      dispatchMessage(cooldownMsg);
      setCooldownMsg(null);
      setCooldownSecs(0);
    }
  };

  const cancelCooldown = () => {
    // Cancel karne par text wapas input box mein daal do taaki edit kar sake
    if (cooldownMsg) {
      setText(cooldownMsg);
    }
    setCooldownSecs(0);
    setCooldownMsg(null);
  };

  const handleSendVoice = (audioUrl) => {
    socket.emit('send_message', {
      chatId,
      senderId: user.id,
      receiverId: isGroup ? '' : activeChat.id,
      isGroup,
      audioUrl,
      type: 'voice'
    });
    playSound('sent');
    setShowRecorder(false);
  };

  const handleCreatePoll = (pollData) => {
    socket.emit('send_message', {
      chatId,
      senderId: user.id,
      receiverId: isGroup ? '' : activeChat.id,
      isGroup,
      type: 'poll',
      pollData
    });
    playSound('sent');
  };

  const handleSendDrawing = (mediaUrl) => {
    socket.emit('send_message', {
      chatId,
      senderId: user.id,
      receiverId: isGroup ? '' : activeChat.id,
      isGroup,
      mediaUrl,
      type: 'image'
    });
    playSound('sent');
    setShowWhiteboard(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Size check — 10MB limit to prevent browser crash
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large! Please select a file under 10MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const isDoc = !file.type.startsWith('image/') && !file.type.startsWith('video/');
      setPendingMedia({
        type: isDoc ? 'document' : file.type,
        dataUrl: event.target.result,
        fileName: file.name,
        fileSize: (file.size / 1024 < 1024)
          ? `${(file.size / 1024).toFixed(1)} KB`
          : `${(file.size / (1024 * 1024)).toFixed(2)} MB`
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSendMedia = ({ mediaUrl, type, isViewOnce, fileName, fileSize }) => {
    const msgType = type === 'document'
      ? 'document'
      : (type?.startsWith('video/') ? 'video' : 'image');

    socket.emit('send_message', {
      chatId,
      senderId: user.id,
      receiverId: isGroup ? '' : activeChat.id,
      isGroup,
      mediaUrl,
      type: msgType,
      isViewOnce: msgType === 'document' ? false : isViewOnce,
      fileName: fileName || null,
      fileSize: fileSize || null,
      replyTo
    });
    playSound('sent');
    setPendingMedia(null);
    setReplyTo(null);
  };

  const handleDeleteLocalMessage = (msgId) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
  };

  const handleTextChange = (e) => {
    setText(e.target.value);
    if (socket) {
      socket.emit('typing_start', { chatId, userId: user.id, username: user.username });
      setTimeout(() => {
        socket.emit('typing_stop', { chatId, userId: user.id });
      }, 2000);
    }
  };

  // Calculate Mood Timeline using sentence + word sentiment from utility
  const moodTimeline = calculateConversationMoodTimeline(messages, cooldownMsg);
  const moodInfo = moodTimeline.currentMood;
  const moodSteps = moodTimeline.timelineSteps;

  // AI Smart Suggested Replies
  const smartReplies = ["Sounds great! 👍", "I'll check and reply soon.", "Let's call! 📞", "Thanks! 🔥"];

  // WhatsApp-style message date grouping helpers
  const formatMessageDateHeader = (timestamp) => {
    if (!timestamp) return 'Today';
    const msgDate = new Date(timestamp);
    if (isNaN(msgDate.getTime())) return 'Today';

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (msgDate.toDateString() === today.toDateString()) return 'Today';
    if (msgDate.toDateString() === yesterday.toDateString()) return 'Yesterday';

    const isCurrentYear = msgDate.getFullYear() === today.getFullYear();
    return msgDate.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: isCurrentYear ? undefined : 'numeric'
    });
  };

  const isDifferentDay = (ts1, ts2) => {
    if (!ts1 || !ts2) return true;
    const d1 = new Date(ts1);
    const d2 = new Date(ts2);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return true;
    return d1.toDateString() !== d2.toDateString();
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg-chat)', overflow: 'hidden' }}>
      {/* Header Bar */}
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-sidebar)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: 0 }}>
            {onBack && (
              <button className="chat-back-btn icon-btn-ghost" onClick={onBack} title="Back to Home / Chats">
                <ArrowLeft size={22} />
              </button>
            )}

            <img
              src={activeChat.avatar}
              alt="Avatar"
              onClick={() => isGroup ? setShowGroupProfileModal(true) : (onOpenFullDp && onOpenFullDp(activeChat.avatar, activeChat.displayName, activeChat.username))}
              style={{ width: '42px', height: '42px', borderRadius: isGroup ? '12px' : '50%', cursor: 'pointer', objectFit: 'cover', flexShrink: 0 }}
              title={isGroup ? 'Click for group details & members' : 'Click to view full screen DP'}
            />

            <div
              className="chat-header-title-box"
              onClick={() => isGroup ? setShowGroupProfileModal(true) : setShowUserProfileModal(true)}
              style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}
              title={isGroup ? 'Click to view group bio, members & edit info' : 'Click to view profile & bio'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>
                  {activeChat.displayName}
                </h3>
                {isGroup && <span className="group-pill-badge"><Users size={12} /> Group</span>}
                {chatSetting?.disappearingEnabled && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '0.7rem',
                      padding: '2px 7px',
                      borderRadius: '10px',
                      background: 'rgba(99, 102, 241, 0.15)',
                      color: 'var(--accent)',
                      fontWeight: 600,
                      flexShrink: 0
                    }}
                    title="24h Disappearing Messages are ON"
                  >
                    <Clock size={11} /> 24h
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.8rem', color: isTyping ? 'var(--accent)' : 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isGroup
                  ? `${activeChat.members?.length || 0} members • Click for info`
                  : isTyping
                    ? 'typing...'
                    : isOnline
                      ? 'Online'
                      : 'Offline • Click for Bio'}
              </p>
            </div>
          </div>

          <div className="chat-header-actions" style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={() => setShowWhiteboard(true)}
              className="icon-btn-ghost"
              title="Shared Whiteboard Canvas"
              style={{ width: '38px', height: '38px', borderRadius: '50%' }}
            >
              <Paintbrush size={19} color="var(--accent)" />
            </button>
            <button
              onClick={() => isGroup ? (onStartGroupCall && onStartGroupCall(activeChat, false)) : onStartCall(false)}
              className="icon-btn-ghost"
              title={isGroup ? 'Start Group Voice Call' : 'Voice Call'}
              style={{ width: '38px', height: '38px', borderRadius: '50%' }}
            >
              <Phone size={19} />
            </button>
            <button
              onClick={() => isGroup ? (onStartGroupCall && onStartGroupCall(activeChat, true)) : onStartCall(true)}
              className="icon-btn-ghost"
              title={isGroup ? 'Start Group Video Call' : 'Video Call'}
              style={{ width: '38px', height: '38px', borderRadius: '50%' }}
            >
              <Video size={19} />
            </button>

            {/* 3-Dots More Options Menu */}
            <div className="chat-header-more-container" style={{ position: 'relative' }}>
              <button
                onClick={() => setShowMoreMenu(prev => !prev)}
                className="icon-btn-ghost"
                title="More Options"
                style={{ width: '38px', height: '38px', borderRadius: '50%', background: showMoreMenu ? 'var(--hover-bg)' : 'transparent' }}
              >
                <MoreVertical size={20} />
              </button>

              {showMoreMenu && (
                <div className="chat-header-dropdown-menu">
                  <button onClick={() => { setShowMoreMenu(false); setShowWhiteboard(true); }}>
                    <Paintbrush size={16} color="var(--accent)" />
                    <span>Whiteboard Canvas</span>
                  </button>
                  <button onClick={() => { setShowMoreMenu(false); setIsMultiSelectMode(true); setSelectedMsgIds([]); }}>
                    <CheckSquare size={16} color="var(--accent)" />
                    <span>Select Messages</span>
                  </button>
                  <button onClick={() => {
                    setShowMoreMenu(false);
                    if (isGroup) {
                      setShowGroupProfileModal(true);
                    } else {
                      setShowUserProfileModal(true);
                    }
                  }}>
                    <Clock size={16} color="var(--accent)" />
                    <span>Disappearing Messages {chatSetting?.disappearingEnabled ? '(On)' : '(Off)'}</span>
                  </button>
                  {!isGroup && (
                    <button
                      onClick={async () => {
                        setShowMoreMenu(false);
                        const willBlock = !blockStatus.isBlockedByMe;
                        const confirmMsg = willBlock
                          ? `Are you sure you want to block ${activeChat.displayName}? You will no longer receive their messages or calls.`
                          : `Unblock ${activeChat.displayName}?`;
                        if (window.confirm(confirmMsg)) {
                          if (willBlock) {
                            await blockUser(activeChat.id);
                            setBlockStatus(prev => ({ ...prev, isBlockedByMe: true }));
                          } else {
                            await unblockUser(activeChat.id);
                            setBlockStatus(prev => ({ ...prev, isBlockedByMe: false }));
                          }
                        }
                      }}
                      style={{ color: blockStatus.isBlockedByMe ? 'var(--accent)' : '#ef4444' }}
                    >
                      <Ban size={16} color={blockStatus.isBlockedByMe ? 'var(--accent)' : '#ef4444'} />
                      <span>{blockStatus.isBlockedByMe ? 'Unblock Contact' : 'Block Contact'}</span>
                    </button>
                  )}
                  <button onClick={() => { setShowMoreMenu(false); handleClearCurrentChat(); }} style={{ color: '#ef4444' }}>
                    <Trash2 size={16} color="#ef4444" />
                    <span>Clear Chat</span>
                  </button>
                  <button onClick={() => { setShowMoreMenu(false); isGroup ? setShowGroupProfileModal(true) : setShowUserProfileModal(true); }}>
                    <Info size={16} color="var(--text-muted)" />
                    <span>{isGroup ? 'Group Info' : 'Contact Info'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Conversation Mood Timeline Strip — sentence-level progression */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden' }}>
          <span style={{ flexShrink: 0 }}>Mood:</span>
          {moodSteps.length > 0 ? (
            <>
              {moodSteps.map((step, idx) => (
                <React.Fragment key={step.id}>
                  <span
                    style={{
                      color: step.color,
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px',
                      background: step.bg,
                      padding: '1px 6px',
                      borderRadius: '8px',
                      border: `1px solid ${step.border}`,
                      whiteSpace: 'nowrap',
                      fontSize: '0.68rem',
                      opacity: step.isPending ? 0.6 : 1
                    }}
                    title={step.preview}
                  >
                    {step.emoji} {step.mood}
                  </span>
                  {idx < moodSteps.length - 1 && (
                    <span style={{ color: 'var(--text-muted)', opacity: 0.4, fontSize: '0.6rem' }}>→</span>
                  )}
                </React.Fragment>
              ))}
            </>
          ) : (
            <span style={{ color: moodInfo.color, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              {moodInfo.emoji} {moodInfo.mood}
            </span>
          )}
          <div style={{ flex: 1, height: '2px', borderRadius: '2px', background: moodInfo.color, opacity: 0.4 }} />
        </div>
      </div>

      {/* WhatsApp-Style Offline Indicator */}
      {!isNetConnected && (
        <div style={{
          background: 'rgba(234, 179, 8, 0.16)',
          borderBottom: '1px solid rgba(234, 179, 8, 0.35)',
          color: '#eab308',
          padding: '5px 14px',
          fontSize: '0.78rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}>
          <WifiOff size={13} style={{ flexShrink: 0 }} />
          <span>Waiting for network · Messages will send automatically when online</span>
        </div>
      )}

        {/* Multi-Select Messages Action Bar */}
        {isMultiSelectMode && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: 'rgba(99, 102, 241, 0.15)', borderTop: '1px solid var(--accent)', fontSize: '0.85rem' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
              Select Messages ({selectedMsgIds.length} selected)
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn-secondary"
                onClick={() => { setIsMultiSelectMode(false); setSelectedMsgIds([]); }}
                style={{ padding: '4px 10px', fontSize: '0.78rem' }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleDeleteSelectedMessages}
                disabled={selectedMsgIds.length === 0}
                style={{ padding: '4px 12px', fontSize: '0.78rem', background: selectedMsgIds.length > 0 ? '#ef4444' : 'var(--bg-card)' }}
              >
                Delete Selected ({selectedMsgIds.length})
              </button>
            </div>
          </div>
        )}

      {/* Message Stream with WhatsApp-Style Date Dividers */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {messages.map((msg, index) => {
          const senderObj = groupMembersMap[msg.senderId];
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const showDateHeader = index === 0 || isDifferentDay(prevMsg?.timestamp, msg.timestamp);
          const dateLabel = formatMessageDateHeader(msg.timestamp);

          return (
            <React.Fragment key={msg.id}>
              {showDateHeader && (
                <div style={{ display: 'flex', justifyContent: 'center', margin: '0.5rem 0' }}>
                  <div
                    style={{
                      background: 'var(--bg-card)',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border)',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      padding: '4px 12px',
                      borderRadius: '10px',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.12)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em'
                    }}
                  >
                    {dateLabel}
                  </div>
                </div>
              )}
              <MessageItem
                message={msg}
                isMine={msg.senderId === user.id}
                chatId={chatId}
                senderName={senderObj?.displayName || senderObj?.username}
                onDeleteLocal={handleDeleteLocalMessage}
                onDeleteTrigger={handleTriggerUndoToast}
                isMultiSelectMode={isMultiSelectMode}
                isSelected={selectedMsgIds.includes(msg.id)}
                onToggleSelect={handleToggleSelectMsg}
                onJoinGroupCall={(isVideo) => onStartGroupCall && onStartGroupCall(activeChat, isVideo)}
                onReply={(msg) => {
                  // Sender ka naam determine karo
                  const senderInfo = groupMembersMap[msg.senderId];
                  setReplyTo({
                    ...msg,
                    senderName: msg.senderId === user.id
                      ? 'You'
                      : (senderInfo?.displayName || senderInfo?.username || activeChat.displayName)
                  });
                  replyInputRef.current?.focus();
                }}
              />
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Clear Chat Undo Banner */}
      {clearedUndoSecs > 0 && (
        <div className="cooldown-banner" style={{ background: 'rgba(239, 68, 68, 0.92)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderRadius: '12px', margin: '0 1rem 0.5rem 1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>
            🧹 Chat cleared for {activeChat.displayName} ({clearedUndoSecs}s)
          </span>
          <button
            onClick={handleUndoClearChat}
            style={{
              background: '#fff',
              color: '#ef4444',
              border: 'none',
              borderRadius: '8px',
              padding: '4px 14px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            ↩ Undo
          </button>
        </div>
      )}

      {/* Multi-Select Delete Undo Banner */}
      {multiDeleteUndoSecs > 0 && (
        <div className="cooldown-banner" style={{ background: 'rgba(239, 68, 68, 0.92)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderRadius: '12px', margin: '0 1rem 0.5rem 1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>
            🗑️ {multiDeleteBackupIds.length} messages deleted ({multiDeleteUndoSecs}s)
          </span>
          <button
            onClick={handleUndoMultiDelete}
            style={{
              background: '#fff',
              color: '#ef4444',
              border: 'none',
              borderRadius: '8px',
              padding: '4px 14px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            ↩ Undo
          </button>
        </div>
      )}

      {/* Single Delete Undo Banner */}
      {undoMessageId && (
        <div className="cooldown-banner" style={{ background: 'rgba(99, 102, 241, 0.95)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderRadius: '12px', margin: '0 1rem 0.5rem 1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>
            🗑️ Message deleted
          </span>
          <button
            onClick={handleUndoDelete}
            style={{
              background: '#fff',
              color: 'var(--accent)',
              border: 'none',
              borderRadius: '8px',
              padding: '4px 14px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            ↩ Undo
          </button>
        </div>
      )}

      {/* Cooldown Timer — elegant countdown bar (no red alert) */}
      {cooldownSecs > 0 && (
        <div style={{
          background: 'rgba(99, 102, 241, 0.12)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          color: 'var(--text-main)',
          borderRadius: '12px',
          margin: '0 1rem 0.5rem 1rem',
          padding: '8px 14px',
          boxShadow: '0 2px 10px rgba(99, 102, 241, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={15} color="var(--accent)" />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                ⏳ Sending in <strong style={{ color: 'var(--accent)' }}>{cooldownSecs}s</strong>...
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={sendCooldownNow}
                style={{
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '3px 12px',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Send Now
              </button>
              <button
                onClick={cancelCooldown}
                style={{
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '3px 12px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
          {/* Smooth animated countdown progress bar */}
          <div style={{ width: '100%', height: '3px', borderRadius: '2px', background: 'rgba(99, 102, 241, 0.15)', overflow: 'hidden' }}>
            <div style={{
              width: `${(cooldownSecs / 3) * 100}%`,
              height: '100%',
              borderRadius: '2px',
              background: 'var(--accent)',
              transition: 'width 1s linear'
            }} />
          </div>
        </div>
      )}

      {/* AI Smart Suggested Reply Chips */}
      <div style={{ padding: '0.4rem 1rem', display: 'flex', gap: '6px', overflowX: 'auto', background: 'var(--bg-chat)' }}>
        {smartReplies.map((replyText, i) => (
          <button
            key={i}
            onClick={() => setText(replyText)}
            style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '16px', padding: '4px 10px', fontSize: '0.75rem', whiteSpace: 'nowrap', cursor: 'pointer' }}
          >
            <Sparkles size={11} color="var(--accent)" style={{ marginRight: '4px' }} />
            {replyText}
          </button>
        ))}
      </div>

      {/* WhatsApp-Style Reply Preview Strip */}
      {replyTo && (
        <div style={{
          padding: '8px 16px',
          background: 'var(--bg-sidebar)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div style={{ color: 'var(--accent)', flexShrink: 0 }}>
            <CornerUpLeft size={16} />
          </div>
          <div style={{
            flex: 1,
            background: 'rgba(0,0,0,0.15)',
            borderLeft: '3px solid var(--accent)',
            borderRadius: '8px',
            padding: '6px 10px',
            minWidth: 0
          }}>
            <div style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--accent)', marginBottom: '2px' }}>
              {replyTo.senderName || 'Someone'}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {replyTo.type === 'text'
                ? (replyTo.content || '')
                : replyTo.type === 'voice'
                  ? '🎤 Voice note'
                  : replyTo.type === 'image'
                    ? '🖼️ Photo'
                    : replyTo.type === 'video'
                      ? '🎥 Video'
                      : replyTo.type || 'Message'}
            </div>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            className="icon-btn-ghost"
            title="Cancel reply"
            style={{ flexShrink: 0 }}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Block Banner or Input Bar */}
      {blockStatus.isBlockedByMe ? (
        <div style={{
          padding: '1.1rem',
          background: 'var(--bg-sidebar)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          color: 'var(--text-muted)',
          fontSize: '0.9rem'
        }}>
          <Ban size={18} color="#ef4444" />
          <span>You have blocked this contact.</span>
          <button
            onClick={async () => {
              await unblockUser(activeChat.id);
              setBlockStatus(prev => ({ ...prev, isBlockedByMe: false }));
            }}
            className="btn-primary"
            style={{ padding: '5px 16px', fontSize: '0.82rem', borderRadius: '14px' }}
          >
            Unblock
          </button>
        </div>
      ) : blockStatus.isBlockedByThem ? (
        <div style={{
          padding: '1.1rem',
          background: 'var(--bg-sidebar)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          color: 'var(--text-muted)',
          fontSize: '0.88rem'
        }}>
          <ShieldAlert size={18} color="var(--text-muted)" />
          <span>You cannot reply to this conversation.</span>
        </div>
      ) : (
        <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-sidebar)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
          {showEmoji && (
            <EmojiPicker onSelectEmoji={(emoji) => setText(prev => prev + emoji)} onClose={() => setShowEmoji(false)} />
          )}

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {!showRecorder && (
            <>
              <button onClick={() => fileInputRef.current?.click()} className="icon-btn-ghost" title="Send Photo, Video or Document"><Paperclip size={20} /></button>
              <button onClick={() => setShowEmoji(!showEmoji)} className="icon-btn-ghost" title="Add Emoji"><Smile size={20} /></button>
              <button onClick={() => setShowCreatePoll(true)} className="icon-btn-ghost" title="Create Poll"><BarChart2 size={20} /></button>
              <button onClick={() => setShowRecorder(true)} className="icon-btn-ghost" title="Voice Note"><Mic size={20} /></button>
            </>
          )}

          {showRecorder ? (
            <VoiceRecorder onSendVoice={handleSendVoice} onCancel={() => setShowRecorder(false)} />
          ) : (
            <form onSubmit={handleSendText} style={{ flex: 1, display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={text}
                onChange={handleTextChange}
                placeholder={isGroup ? 'Message group...' : 'Type a message...'}
                className="form-input"
                ref={replyInputRef}
                style={{ flex: 1, borderRadius: '24px' }}
              />
              <button type="submit" className="btn-primary-round" title="Send Message"><Send size={18} /></button>
            </form>
          )}
        </div>
      )}

      {pendingMedia && (
        <MediaUploadModal
          mediaFile={pendingMedia}
          onSend={handleSendMedia}
          onClose={() => setPendingMedia(null)}
        />
      )}

      {showCreatePoll && (
        <CreatePollModal
          onClose={() => setShowCreatePoll(false)}
          onCreatePoll={handleCreatePoll}
        />
      )}

      {showWhiteboard && (
        <WhiteboardModal
          onClose={() => setShowWhiteboard(false)}
          chatTitle={activeChat.displayName}
          chatId={chatId}
          onSendDrawing={handleSendDrawing}
        />
      )}

      {showUserProfileModal && (
        <UserProfileModal
          targetUser={activeChat}
          onClose={() => setShowUserProfileModal(false)}
          onStartCall={onStartCall}
          onOpenFullDp={onOpenFullDp}
        />
      )}

      {showGroupProfileModal && (
        <GroupProfileModal
          group={activeChat}
          onClose={() => setShowGroupProfileModal(false)}
          onStartCall={onStartCall}
          onOpenFullDp={onOpenFullDp}
        />
      )}
    </div>
  );
}
