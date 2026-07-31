import React, { useState, useEffect, useRef, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { Send, Mic, Phone, Video, Smile, BarChart2, ArrowLeft, Users } from 'lucide-react';
import MessageItem from './MessageItem';
import VoiceRecorder from './VoiceRecorder';
import EmojiPicker from './EmojiPicker';
import CreatePollModal from './CreatePollModal';
import { playSound } from '../../utils/audio';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : window.location.origin);

export default function ChatWindow({ activeChat, onBack, onStartCall }) {
  const { user, token } = useContext(AuthContext);
  const { socket, onlineUsers, typingMap } = useContext(SocketContext);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [showRecorder, setShowRecorder] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [groupMembersMap, setGroupMembersMap] = useState({});
  const messagesEndRef = useRef(null);

  const isGroup = !!activeChat.isGroup;
  const chatId = isGroup ? activeChat.id : [user.id, activeChat.id].sort().join('_');
  const isOnline = !isGroup && onlineUsers.includes(activeChat.id);
  const isTyping = typingMap[chatId] === activeChat.username;

  // Load message history & group details if applicable
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
      }
    }
  }, [activeChat, chatId, isGroup, token, socket]);

  // Listen to incoming messages & poll updates
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

    const handleReadUpdate = ({ messageId, status }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status } : m));
    };

    socket.on('new_message', handleNewMessage);
    socket.on('poll_updated', handlePollUpdate);
    socket.on('message_read_update', handleReadUpdate);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('poll_updated', handlePollUpdate);
      socket.off('message_read_update', handleReadUpdate);
    };
  }, [socket, chatId, user.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendText = (e) => {
    e?.preventDefault();
    if (!text.trim()) return;

    socket.emit('send_message', {
      chatId,
      senderId: user.id,
      receiverId: isGroup ? '' : activeChat.id,
      isGroup,
      content: text,
      type: 'text'
    });

    playSound('sent');
    setText('');
    socket.emit('typing_stop', { chatId, userId: user.id });
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

  const handleTextChange = (e) => {
    setText(e.target.value);
    if (socket) {
      socket.emit('typing_start', { chatId, userId: user.id, username: user.username });
      setTimeout(() => {
        socket.emit('typing_stop', { chatId, userId: user.id });
      }, 2000);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-chat)' }}>
      {/* Header Bar */}
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-sidebar)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Mobile Back Button */}
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

        {!isGroup && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => onStartCall(false)} className="icon-btn-ghost" title="Voice Call"><Phone size={18} /></button>
            <button onClick={() => onStartCall(true)} className="icon-btn-ghost" title="Video Call"><Video size={18} /></button>
          </div>
        )}
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
              senderAvatar={senderObj?.avatar}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-sidebar)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
        {showEmoji && (
          <EmojiPicker onSelectEmoji={(emoji) => setText(prev => prev + emoji)} onClose={() => setShowEmoji(false)} />
        )}

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

      {showCreatePoll && (
        <CreatePollModal
          onClose={() => setShowCreatePoll(false)}
          onCreatePoll={handleCreatePoll}
        />
      )}
    </div>
  );
}
