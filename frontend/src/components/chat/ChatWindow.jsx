import React, { useState, useEffect, useRef, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { Send, Mic, Phone, Video, Smile, BarChart2, ArrowLeft, Users, Paintbrush, Clock, Sparkles, Image as ImageIcon, Paperclip } from 'lucide-react';
import MessageItem from './MessageItem';
import VoiceRecorder from './VoiceRecorder';
import EmojiPicker from './EmojiPicker';
import CreatePollModal from './CreatePollModal';
import WhiteboardModal from './WhiteboardModal';
import MediaUploadModal from './MediaUploadModal';
import { playSound } from '../../utils/audio';
import { BACKEND_URL } from '../../utils/config';

export default function ChatWindow({ activeChat, onBack, onStartCall }) {
  const { user, token } = useContext(AuthContext);
  const { socket, onlineUsers, typingMap } = useContext(SocketContext);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [showRecorder, setShowRecorder] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [pendingMedia, setPendingMedia] = useState(null);
  const [groupMembersMap, setGroupMembersMap] = useState({});
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

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

    socket.on('new_message', handleNewMessage);
    socket.on('poll_updated', handlePollUpdate);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('message_read_update', handleReadUpdate);
    socket.on('reaction_updated', handleReactionUpdated);
    socket.on('message_restored', handleMessageRestored);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('poll_updated', handlePollUpdate);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('message_read_update', handleReadUpdate);
      socket.off('reaction_updated', handleReactionUpdated);
      socket.off('message_restored', handleMessageRestored);
    };
  }, [socket, chatId, user.id]);

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

  // Cooldown Send Timer
  useEffect(() => {
    let timer;
    if (cooldownSecs > 0) {
      timer = setInterval(() => {
        setCooldownSecs(prev => {
          if (prev <= 1) {
            dispatchMessage(cooldownMsg);
            setCooldownMsg(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldownSecs, cooldownMsg]);

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
              <button className="mobile-back-btn icon-btn-ghost" onClick={onBack} title="Back to Chats">
                <ArrowLeft size={20} />
              </button>
            )}

            <img
              src={activeChat.avatar}
              alt="Avatar"
              style={{ width: '40px', height: '40px', borderRadius: isGroup ? '12px' : '50%' }}
            />

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{activeChat.displayName}</h3>
                {isGroup && <span className="group-pill-badge"><Users size={12} /> Group</span>}
              </div>
              <p style={{ fontSize: '0.75rem', color: isTyping ? 'var(--accent)' : 'var(--text-muted)', margin: 0 }}>
                {isGroup
                  ? `${activeChat.members?.length || 0} members`
                  : isTyping
                    ? 'typing...'
                    : isOnline
                      ? 'Online'
                      : 'Offline'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button onClick={() => setShowWhiteboard(true)} className="icon-btn-ghost" title="Shared Whiteboard Canvas"><Paintbrush size={18} /></button>
            {!isGroup && (
              <>
                <button onClick={() => onStartCall(false)} className="icon-btn-ghost" title="Voice Call"><Phone size={18} /></button>
                <button onClick={() => onStartCall(true)} className="icon-btn-ghost" title="Video Call"><Video size={18} /></button>
              </>
            )}
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
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Undo Delete Banner */}
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
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
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
    </div>
  );
}
