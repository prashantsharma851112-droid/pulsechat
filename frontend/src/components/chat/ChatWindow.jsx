import React, { useState, useEffect, useRef, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { Send, Mic, Phone, Video, Smile } from 'lucide-react';
import MessageItem from './MessageItem';
import VoiceRecorder from './VoiceRecorder';
import EmojiPicker from './EmojiPicker';
import { playSound } from '../../utils/audio';

export default function ChatWindow({ activeChat, onStartCall }) {
  const { user, token } = useContext(AuthContext);
  const { socket, onlineUsers, typingMap } = useContext(SocketContext);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [showRecorder, setShowRecorder] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const messagesEndRef = useRef(null);

  const chatId = [user.id, activeChat.id].sort().join('_');
  const isOnline = onlineUsers.includes(activeChat.id);
  const isTyping = typingMap[chatId] === activeChat.username;

  // Load message history
  useEffect(() => {
    if (activeChat) {
      fetch(`/api/messages/${chatId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => setMessages(data));

      if (socket) {
        socket.emit('join_chat', chatId);
      }
    }
  }, [activeChat, chatId, token, socket]);

  // Listen to incoming messages
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

    const handleReadUpdate = ({ messageId, status }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status } : m));
    };

    socket.on('new_message', handleNewMessage);
    socket.on('message_read_update', handleReadUpdate);

    return () => {
      socket.off('new_message', handleNewMessage);
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
      receiverId: activeChat.id,
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
      receiverId: activeChat.id,
      audioUrl,
      type: 'voice'
    });
    playSound('sent');
    setShowRecorder(false);
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
      <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-sidebar)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img src={activeChat.avatar} alt="Avatar" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{activeChat.displayName}</h3>
            <p style={{ fontSize: '0.75rem', color: isTyping ? 'var(--accent)' : 'var(--text-muted)' }}>
              {isTyping ? 'typing...' : isOnline ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => onStartCall(false)} style={{ background: 'var(--bg-card)', padding: '8px', borderRadius: '50%', color: 'var(--text-main)' }} title="Voice Call"><Phone size={18} /></button>
          <button onClick={() => onStartCall(true)} style={{ background: 'var(--bg-card)', padding: '8px', borderRadius: '50%', color: 'var(--text-main)' }} title="Video Call"><Video size={18} /></button>
        </div>
      </div>

      {/* Message Stream */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {messages.map((msg) => (
          <MessageItem key={msg.id} message={msg} isMine={msg.senderId === user.id} chatId={chatId} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div style={{ padding: '0.85rem 1rem', background: 'var(--bg-sidebar)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative' }}>
        {showEmoji && (
          <EmojiPicker onSelectEmoji={(emoji) => setText(prev => prev + emoji)} onClose={() => setShowEmoji(false)} />
        )}

        <button onClick={() => setShowEmoji(!showEmoji)} style={{ background: 'transparent', color: 'var(--text-muted)' }}><Smile size={22} /></button>
        <button onClick={() => setShowRecorder(!showRecorder)} style={{ background: showRecorder ? 'var(--accent)' : 'transparent', color: showRecorder ? '#fff' : 'var(--text-muted)', padding: '6px', borderRadius: '50%' }} title="Voice Note"><Mic size={22} /></button>

        {showRecorder ? (
          <VoiceRecorder onSendVoice={handleSendVoice} onCancel={() => setShowRecorder(false)} />
        ) : (
          <form onSubmit={handleSendText} style={{ flex: 1, display: 'flex', gap: '0.5rem' }}>
            <input type="text" value={text} onChange={handleTextChange} placeholder="Type a message..." style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '24px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.9rem' }} />
            <button type="submit" style={{ background: 'var(--accent)', color: '#fff', padding: '0.75rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Send size={18} /></button>
          </form>
        )}
      </div>
    </div>
  );
}
