import React, { useState, useContext } from 'react';
import { SocketContext } from '../../context/SocketContext';
import { AuthContext } from '../../context/AuthContext';
import { Check, CheckCheck, Play, Pause, BarChart2, CheckCircle2 } from 'lucide-react';

export default function MessageItem({ message, isMine, chatId, senderName, senderAvatar }) {
  const { socket } = useContext(SocketContext);
  const { user: currentUser } = useContext(AuthContext);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioObj, setAudioObj] = useState(null);
  const [showReactionMenu, setShowReactionMenu] = useState(false);

  const toggleAudio = () => {
    if (!message.audioUrl) return;
    if (isPlaying) {
      if (audioObj) audioObj.pause();
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
    if (socket) {
      socket.emit('add_reaction', { messageId: message.id, chatId, emoji, userId: currentUser.id });
    }
    setShowReactionMenu(false);
  };

  const handleVotePoll = (optionId) => {
    if (socket && message.pollData) {
      socket.emit('vote_poll', {
        messageId: message.id,
        optionId,
        userId: currentUser.id,
        chatId
      });
    }
  };

  const timeStr = new Date(message.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Calculate total votes for poll
  const pollData = message.pollData;
  const totalVotes = pollData
    ? pollData.options.reduce((acc, opt) => acc + (opt.votes?.length || 0), 0)
    : 0;

  return (
    <div style={{ alignSelf: isMine ? 'flex-end' : 'flex-start', maxWidth: '78%', minWidth: '160px', position: 'relative' }}>
      {/* Group Chat Sender Name */}
      {!isMine && message.isGroup && (
        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--accent)', marginBottom: '3px', marginLeft: '6px' }}>
          {senderName || 'Group Member'}
        </div>
      )}

      <div
        onContextMenu={(e) => { e.preventDefault(); setShowReactionMenu(!showReactionMenu); }}
        style={{
          background: isMine ? 'var(--bubble-sent)' : 'var(--bubble-received)',
          color: 'var(--text-main)',
          padding: '0.75rem 1rem',
          borderRadius: isMine ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
        }}
      >
        {/* Voice Note Message */}
        {message.type === 'voice' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '180px' }}>
            <button onClick={toggleAudio} style={{ background: 'var(--accent)', color: '#fff', border: 'none', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.3)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: isPlaying ? '100%' : '0%', height: '100%', background: '#fff', transition: 'width 3s linear' }} />
            </div>
            <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>Voice</span>
          </div>
        )}

        {/* Text Message */}
        {message.type === 'text' && (
          <p style={{ fontSize: '0.92rem', wordBreak: 'break-word', margin: 0, lineHeight: 1.4 }}>{message.content}</p>
        )}

        {/* Media / Image Message */}
        {message.type === 'image' && message.mediaUrl && (
          <div style={{ borderRadius: '8px', overflow: 'hidden', marginBottom: '4px' }}>
            <img src={message.mediaUrl} alt="Attached Media" style={{ maxWidth: '100%', maxHeight: '240px', objectFit: 'cover' }} />
          </div>
        )}

        {/* Poll Message */}
        {message.type === 'poll' && pollData && (
          <div style={{ minWidth: '220px', maxWidth: '320px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '6px' }}>
              <BarChart2 size={18} color="var(--accent)" />
              <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '600' }}>{pollData.question}</h4>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pollData.options.map((opt) => {
                const votesCount = opt.votes ? opt.votes.length : 0;
                const pct = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
                const hasVoted = opt.votes && opt.votes.includes(currentUser?.id);

                return (
                  <div
                    key={opt.id}
                    onClick={() => handleVotePoll(opt.id)}
                    style={{
                      position: 'relative',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: hasVoted ? '1.5px solid var(--accent)' : '1px solid rgba(255,255,255,0.2)',
                      background: 'rgba(0,0,0,0.15)',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Background Progress Fill */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        bottom: 0,
                        width: `${pct}%`,
                        background: 'rgba(99, 102, 241, 0.25)',
                        transition: 'width 0.4s ease',
                        pointerEvents: 'none'
                      }}
                    />

                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem' }}>
                        {hasVoted && <CheckCircle2 size={16} color="var(--accent)" />}
                        <span>{opt.text}</span>
                      </div>
                      <span style={{ fontSize: '0.78rem', fontWeight: '600', opacity: 0.9 }}>
                        {pct}% ({votesCount})
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ fontSize: '0.72rem', opacity: 0.7, marginTop: '8px', textAlign: 'right' }}>
              {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'} total • {pollData.isMultipleChoice ? 'Multiple choice' : 'Single choice'}
            </div>
          </div>
        )}

        {/* Timestamp & Ticks */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem', marginTop: '0.35rem', fontSize: '0.68rem', opacity: 0.75 }}>
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
