import React, { useState, useEffect, useRef, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { Send, Mic, Phone, Video, Smile, BarChart2, ArrowLeft, Users, Paintbrush, Clock, Sparkles, Image as ImageIcon, Paperclip, CheckSquare, Trash2, X, Check } from 'lucide-react';
import MessageItem from './MessageItem';
import VoiceRecorder from './VoiceRecorder';
import EmojiPicker from './EmojiPicker';
import CreatePollModal from './CreatePollModal';
import WhiteboardModal from './WhiteboardModal';
import UserProfileModal from './UserProfileModal';
import GroupProfileModal from './GroupProfileModal';
import { playSound } from '../../utils/audio';
import { BACKEND_URL } from '../../utils/config';

export default function ChatWindow({ activeChat, onBack, onStartCall, onStartGroupCall, onOpenFullDp }) {
  const { user, token } = useContext(AuthContext);
  const { socket, onlineUsers, typingMap } = useContext(SocketContext);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [showRecorder, setShowRecorder] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [showGroupProfileModal, setShowGroupProfileModal] = useState(false);
  const [pendingMedia, setPendingMedia] = useState(null);
  const [groupMembersMap, setGroupMembersMap] = useState({});
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

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

  const isGroup = !!activeChat.isGroup;
  const chatId = isGroup ? activeChat.id : [user.id, activeChat.id].sort().join('_');
  const isOnline = !isGroup && onlineUsers.includes(activeChat.id);
  const isTyping = typingMap[chatId] === activeChat.username;

  // Load message history & group details
  useEffect(() => {
    if (activeChat) {
      fetch(`${BACKEND_URL}/api/messages/${chatId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setMessages(data);
        });

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
        setMessages(prev => [...prev, msg]);
        if (msg.senderId !== user.id) {
          playSound('received');
          socket.emit('mark_read', { messageId: msg.id, chatId });
        }
      }
    };

    const handlePollUpdate = ({ messageId, pollData }) => {
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

    socket.on('new_message', handleNewMessage);
    socket.on('poll_updated', handlePollUpdate);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('message_read_update', handleReadUpdate);
    socket.on('reaction_updated', handleReactionUpdated);
    socket.on('message_restored', handleMessageRestored);
    socket.on('chat_cleared', handleChatCleared);
    socket.on('chat_restored', handleChatRestored);
    socket.on('multiple_messages_deleted', handleMultipleDeleted);
    socket.on('multiple_messages_restored', handleMultipleRestored);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('poll_updated', handlePollUpdate);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('message_read_update', handleReadUpdate);
      socket.off('reaction_updated', handleReactionUpdated);
      socket.off('message_restored', handleMessageRestored);
      socket.off('chat_cleared', handleChatCleared);
      socket.off('chat_restored', handleChatRestored);
      socket.off('multiple_messages_deleted', handleMultipleDeleted);
      socket.off('multiple_messages_restored', handleMultipleRestored);
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    socket.emit('send_message', {
      chatId,
      senderId: user.id,
      receiverId: isGroup ? '' : activeChat.id,
      isGroup,
      content: msgContent,
      type: 'text'
    });

    playSound('sent');
  };

  const handleSendText = (e, forceInstant = false) => {
    e?.preventDefault();
    if (!text.trim()) return;

    // Check emotional trigger words for 10s cooldown
    const isEmotional = /angry|hate|stop|never|shut up|worst|gussa/i.test(text);

    if (isEmotional && !forceInstant) {
      setCooldownMsg(text);
      setCooldownSecs(10);
      setText('');
      return;
    }

    dispatchMessage(text);
    setText('');
    socket.emit('typing_stop', { chatId, userId: user.id });
  };

  const cancelCooldown = () => {
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

    const reader = new FileReader();
    reader.onload = (event) => {
      setPendingMedia({
        type: file.type,
        dataUrl: event.target.result
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSendMedia = ({ mediaUrl, type, isViewOnce }) => {
    socket.emit('send_message', {
      chatId,
      senderId: user.id,
      receiverId: isGroup ? '' : activeChat.id,
      isGroup,
      mediaUrl,
      type,
      isViewOnce
    });
    playSound('sent');
    setPendingMedia(null);
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

  // Calculate Mood Timeline sentiment for header
  const getMoodTimeline = () => {
    if (messages.length === 0) return { mood: 'Casual', color: '#6366f1', emoji: '😊' };
    const recentText = messages.slice(-5).map(m => m.content || '').join(' ').toLowerCase();
    if (/awesome|love|happy|great|cool|haha|lol/i.test(recentText)) {
      return { mood: 'Joyful', color: '#10b981', emoji: '🎉' };
    }
    if (/sorry|sad|bad|wrong|sigh/i.test(recentText)) {
      return { mood: 'Tense', color: '#f59e0b', emoji: '🟡' };
    }
    return { mood: 'Casual', color: '#6366f1', emoji: '💬' };
  };

  const moodInfo = getMoodTimeline();

  // AI Smart Suggested Replies
  const smartReplies = ["Sounds great! 👍", "I'll check and reply soon.", "Let's call! 📞", "Thanks! 🔥"];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg-chat)', overflow: 'hidden' }}>
      {/* Header Bar */}
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-sidebar)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {onBack && (
              <button className="chat-back-btn icon-btn-ghost" onClick={onBack} title="Back to Home / Chats">
                <ArrowLeft size={20} />
              </button>
            )}

            <img
              src={activeChat.avatar}
              alt="Avatar"
              onClick={() => isGroup ? setShowGroupProfileModal(true) : (onOpenFullDp && onOpenFullDp(activeChat.avatar, activeChat.displayName, activeChat.username))}
              style={{ width: '40px', height: '40px', borderRadius: isGroup ? '12px' : '50%', cursor: 'pointer', objectFit: 'cover' }}
              title={isGroup ? 'Click for group details & members' : 'Click to view full screen DP'}
            />

            <div
              className="chat-header-title-box"
              onClick={() => isGroup ? setShowGroupProfileModal(true) : setShowUserProfileModal(true)}
              style={{ cursor: 'pointer' }}
              title={isGroup ? 'Click to view group bio, members & edit info' : 'Click to view profile & bio'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{activeChat.displayName}</h3>
                {isGroup && <span className="group-pill-badge"><Users size={12} /> Group</span>}
              </div>
              <p style={{ fontSize: '0.75rem', color: isTyping ? 'var(--accent)' : 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

          <div className="chat-header-actions" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button
              onClick={() => {
                setIsMultiSelectMode(!isMultiSelectMode);
                setSelectedMsgIds([]);
              }}
              className={`icon-btn-ghost ${isMultiSelectMode ? 'active-mic' : ''}`}
              title={isMultiSelectMode ? 'Cancel Select Mode' : 'Select Messages to Delete'}
              style={{ color: isMultiSelectMode ? '#fff' : 'var(--accent)' }}
            >
              <CheckSquare size={18} />
            </button>
            <button
              onClick={handleClearCurrentChat}
              className="icon-btn-ghost"
              title={`Clear Chat for ${activeChat.displayName}`}
              style={{ color: '#ef4444' }}
            >
              <Trash2 size={18} />
            </button>
            <button onClick={() => setShowWhiteboard(true)} className="icon-btn-ghost" title="Shared Whiteboard Canvas"><Paintbrush size={18} /></button>
            <button onClick={() => isGroup ? (onStartGroupCall && onStartGroupCall(activeChat, false)) : onStartCall(false)} className="icon-btn-ghost" title={isGroup ? 'Start Group Voice Call' : 'Voice Call'}><Phone size={18} /></button>
            <button onClick={() => isGroup ? (onStartGroupCall && onStartGroupCall(activeChat, true)) : onStartCall(true)} className="icon-btn-ghost" title={isGroup ? 'Start Group Video Call' : 'Video Call'}><Video size={18} /></button>
          </div>
        </div>

        {/* Conversation Mood Timeline Strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
          <span>Mood Timeline:</span>
          <span style={{ color: moodInfo.color, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            {moodInfo.emoji} {moodInfo.mood}
          </span>
          <div style={{ flex: 1, height: '3px', borderRadius: '2px', background: moodInfo.color, opacity: 0.7 }} />
        </div>
      </div>

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

      {/* Message Stream */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {messages.map((msg) => {
          const senderObj = groupMembersMap[msg.senderId];
          return (
            <MessageItem
              key={msg.id}
              message={msg}
              isMine={msg.senderId === user.id}
              chatId={chatId}
              senderName={senderObj?.displayName || senderObj?.username}
              onDeleteLocal={handleDeleteLocalMessage}
              onDeleteTrigger={handleTriggerUndoToast}
              isMultiSelectMode={isMultiSelectMode}
              isSelected={selectedMsgIds.includes(msg.id)}
              onToggleSelect={handleToggleSelectMsg}
            />
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

      {/* Cooldown Timer Notification Banner */}
      {cooldownSecs > 0 && (
        <div className="cooldown-banner">
          <Clock size={16} color="#f59e0b" />
          <span style={{ fontSize: '0.85rem' }}>
            Emotional text detected. Sending in <strong>{cooldownSecs}s</strong>...
          </span>
          <button className="btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem', color: '#ef4444' }} onClick={cancelCooldown}>
            Cancel Send
          </button>
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

      {/* Input Bar */}
      <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-sidebar)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
        {showEmoji && (
          <EmojiPicker onSelectEmoji={(emoji) => setText(prev => prev + emoji)} onClose={() => setShowEmoji(false)} />
        )}

        <input
          type="file"
          ref={fileInputRef}
          accept="image/*,video/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        <button onClick={() => fileInputRef.current?.click()} className="icon-btn-ghost" title="Send Photo or Video (View Once)"><Paperclip size={20} /></button>
        <button onClick={() => setShowEmoji(!showEmoji)} className="icon-btn-ghost" title="Add Emoji"><Smile size={20} /></button>
        <button onClick={() => setShowCreatePoll(true)} className="icon-btn-ghost" title="Create Poll"><BarChart2 size={20} /></button>
        <button onClick={() => setShowRecorder(!showRecorder)} className={`icon-btn-ghost ${showRecorder ? 'active-mic' : ''}`} title="Voice Note"><Mic size={20} /></button>

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
              style={{ flex: 1, borderRadius: '24px' }}
            />
            <button type="submit" className="btn-primary-round" title="Send Message"><Send size={18} /></button>
          </form>
        )}
      </div>

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
