import React, { useState, useContext } from 'react';
import { SocketContext } from '../../context/SocketContext';
import { Check, CheckCheck, Play, Pause } from 'lucide-react';

export default function MessageItem({ message, isMine, chatId }) {
  const { socket } = useContext(SocketContext);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioObj, setAudioObj] = useState(null);
  const [showReactionMenu, setShowReactionMenu] = useState(false);

  const toggleAudio = () => {
    if (!message.audioUrl) return;
    if (isPlaying) {
      audioObj.pause();
      setIsPlaying(false);
    } else {
      const audio = new Audio(message.audioUrl);
      audio.play();
      setIsPlaying(true);
      setAudioObj(audio);
      audio.onended = () => setIsPlaying(false);
    }
  };

  const handleReact = (emoji) => {
    socket.emit('add_reaction', { messageId: message.id, chatId, emoji });
    setShowReactionMenu(false);
  };

  const timeStr = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ alignSelf: isMine ? 'flex-end' : 'flex-start', maxWidth: '65%', position: 'relative' }}>
      <div 
        onContextMenu={(e) => { e.preventDefault(); setShowReactionMenu(!showReactionMenu); }}
        style={{
          background: isMine ? 'var(--bubble-sent)' : 'var(--bubble-received)',
          color: 'var(--text-main)',
          padding: '0.75rem 1rem',
          borderRadius: isMine ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
        }}
      >
        {/* Voice Note Message */}
        {message.type === 'voice' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '180px' }}>
            <button onClick={toggleAudio} style={{ background: 'var(--accent)', color: '#fff', border: 'none', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.3)', borderRadius: '2px' }}>
              <div style={{ width: isPlaying ? '100%' : '0%', height: '100%', background: '#fff', transition: 'width 3s linear' }} />
            </div>
            <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>Voice Note</span>
          </div>
        )}

        {/* Text Message */}
        {message.type === 'text' && (
          <p style={{ fontSize: '0.92rem', wordBreak: 'break-word' }}>{message.content}</p>
        )}

        {/* Timestamp & Ticks */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem', marginTop: '0.25rem', fontSize: '0.68rem', opacity: 0.75 }}>
          <span>{timeStr}</span>
          {isMine && (
            <span>
              {message.status === 'read' ? (
                <CheckCheck size={14} color="#60a5fa" />
              ) : message.status === 'delivered' ? (
                <CheckCheck size={14} color="#9ca3af" />
              ) : (
                <Check size={14} color="#9ca3af" />
              )}
            </span>
          )}
        </div>
      </div>

      {/* Quick Reaction Popup */}
      {showReactionMenu && (
        <div style={{ position: 'absolute', top: '-36px', [isMine ? 'right' : 'left']: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '20px', padding: '4px 8px', display: 'flex', gap: '8px', zIndex: 10 }}>
          <span onClick={() => handleReact('👍')} style={{ cursor: 'pointer' }}>👍</span>
          <span onClick={() => handleReact('❤️')} style={{ cursor: 'pointer' }}>❤️</span>
          <span onClick={() => handleReact('😂')} style={{ cursor: 'pointer' }}>😂</span>
          <span onClick={() => handleReact('🔥')} style={{ cursor: 'pointer' }}>🔥</span>
        </div>
      )}
    </div>
  );
}
