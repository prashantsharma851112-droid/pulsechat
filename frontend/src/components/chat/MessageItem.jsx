import React, { useState, useEffect, useContext } from 'react';
import { SocketContext } from '../../context/SocketContext';
import { AuthContext } from '../../context/AuthContext';
import { Check, CheckCheck, Play, Pause, BarChart2, CheckCircle2, Trash2, GitBranch, Sparkles, Phone, PhoneOff, Video, VideoOff, Eye } from 'lucide-react';
import ThreadModal from './ThreadModal';
import ViewOnceModal from './ViewOnceModal';

export default function MessageItem({
  message,
  isMine,
  chatId,
  senderName,
  onDeleteLocal,
  onDeleteTrigger,
  isMultiSelectMode,
  isSelected,
  onToggleSelect
}) {
  const { socket } = useContext(SocketContext);
  const { user: currentUser } = useContext(AuthContext);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioObj, setAudioObj] = useState(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const [showViewOnceModal, setShowViewOnceModal] = useState(false);
  const [viewedByState, setViewedByState] = useState(message.viewedBy || []);

  useEffect(() => {
    if (!socket) return;
    const handleViewOnceUpdate = ({ messageId, viewedBy }) => {
      if (messageId === message.id) {
        setViewedByState(viewedBy);
      }
    };
    socket.on('view_once_updated', handleViewOnceUpdate);
    return () => socket.off('view_once_updated', handleViewOnceUpdate);
  }, [socket, message.id]);

  const hasRecipientOpened = message.isViewOnce && viewedByState.length > 0;
  const isConsumedByMe = !isMine && (viewedByState.includes(currentUser?.id) || message.isViewed);
  const isAlreadyViewed = isMine ? hasRecipientOpened : isConsumedByMe;

  const handleOpenViewOnce = () => {
    if (isConsumedByMe) return;
    setShowViewOnceModal(true);
  };

  const handleMarkViewed = () => {
    if (socket && currentUser?.id) {
      socket.emit('view_once_opened', { messageId: message.id, userId: currentUser.id, chatId });
    }
  };

  const toggleAudio = () => {
    if (!message.audioUrl) return;
    if (isPlaying && audioObj) {
      audioObj.pause();
      setIsPlaying(false);
    } else {
      const audio = audioObj || new Audio(message.audioUrl);
      if (!audioObj) setAudioObj(audio);

      audio.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error("Audio playback error:", err);
        setIsPlaying(false);
      });

      audio.onended = () => setIsPlaying(false);
      audio.onpause = () => setIsPlaying(false);
    }
  };

  const handleReact = (emoji) => {
    if (socket && currentUser?.id) {
      socket.emit('add_reaction', { messageId: message.id, chatId, emoji, userId: currentUser.id });
    }
    setShowContextMenu(false);
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

  const handleUnsendForEveryone = () => {
    if (socket) {
      socket.emit('delete_message', { messageId: message.id, chatId });
    }
    if (onDeleteTrigger) onDeleteTrigger(message.id);
    setShowContextMenu(false);
  };

  const handleDeleteForMe = () => {
    if (onDeleteLocal) onDeleteLocal(message.id);
    if (onDeleteTrigger) onDeleteTrigger(message.id);
    setShowContextMenu(false);
  };

  const timeStr = new Date(message.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Calculate total votes for poll
  const pollData = message.pollData;
  const totalVotes = pollData
    ? pollData.options.reduce((acc, opt) => acc + (opt.votes?.length || 0), 0)
    : 0;

  // Emotion Tag helper for Voice Notes
  const getEmotionTag = (msgId) => {
    const emotions = [
      { label: 'Calm', emoji: '😌', color: '#10b981' },
      { label: 'Excited', emoji: '🔥', color: '#f59e0b' },
      { label: 'Casual', emoji: '💬', color: '#6366f1' }
    ];
    const index = Math.abs(msgId.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % emotions.length;
    return emotions[index];
  };

  if (message.type === 'deleted') {
    return (
      <div style={{ alignSelf: isMine ? 'flex-end' : 'flex-start', maxWidth: '78%', opacity: 0.65, fontStyle: 'italic', fontSize: '0.82rem', padding: '6px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', color: 'var(--text-muted)' }}>
        🚫 This message was deleted
      </div>
    );
  }

  return (
    <div
      onClick={isMultiSelectMode ? () => onToggleSelect && onToggleSelect(message.id) : undefined}
      style={{
        alignSelf: isMine ? 'flex-end' : 'flex-start',
        maxWidth: '78%',
        minWidth: '160px',
        position: 'relative',
        cursor: isMultiSelectMode ? 'pointer' : 'default'
      }}
    >
      {/* Selection Checkbox indicator when in Multi-Select Mode */}
      {isMultiSelectMode && (
        <div style={{
          position: 'absolute',
          top: '50%',
          transform: 'translateY(-50%)',
          [isMine ? 'left' : 'right']: '-34px',
          width: '22px',
          height: '22px',
          borderRadius: '6px',
          border: isSelected ? 'none' : '2px solid var(--text-muted)',
          background: isSelected ? 'var(--accent)' : 'rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease',
          zIndex: 10
        }}>
          {isSelected && <Check size={14} color="#fff" className="check-pop-icon" />}
        </div>
      )}

      {/* Group Chat Sender Name */}
      {!isMine && message.isGroup && (
        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--accent)', marginBottom: '3px', marginLeft: '6px' }}>
          {senderName || 'Group Member'}
        </div>
      )}

      <div
        onContextMenu={(e) => {
          if (!isMultiSelectMode) {
            e.preventDefault();
            setShowContextMenu(!showContextMenu);
          }
        }}
        style={{
          background: isSelected ? 'rgba(99, 102, 241, 0.25)' : (isMine ? 'var(--bubble-sent)' : 'var(--bubble-received)'),
          color: 'var(--text-main)',
          padding: '0.75rem 1rem',
          borderRadius: isMine ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
          border: isSelected ? '1.5px solid var(--accent)' : '1px solid transparent',
          transition: 'all 0.15s ease'
        }}
      >
        {/* Voice Note Message */}
        {message.type === 'voice' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button onClick={toggleAudio} style={{ background: 'var(--accent)', color: '#fff', border: 'none', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.3)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: isPlaying ? '100%' : '0%', height: '100%', background: '#fff', transition: 'width 3s linear' }} />
              </div>
            </div>

            {/* AI Voice Emotion Tag */}
            {(() => {
              const emotion = getEmotionTag(message.id);
              return (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', background: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: '10px', width: 'fit-content', color: emotion.color }}>
                  <Sparkles size={11} /> Tone: {emotion.emoji} {emotion.label}
                </div>
              );
            })()}
          </div>
        )}

        {/* Text Message */}
        {message.type === 'text' && (
          <p style={{ fontSize: '0.92rem', wordBreak: 'break-word', margin: 0, lineHeight: 1.4 }}>{message.content}</p>
        )}

        {/* View Once Media Message */}
        {(message.type === 'image' || message.type === 'video') && message.isViewOnce && (
          <div style={{ padding: '2px 0' }}>
            {isAlreadyViewed ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '20px', background: 'rgba(0,0,0,0.25)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 700 }}>1️⃣</span>
                <span>Opened</span>
              </div>
            ) : (
              <button
                onClick={handleOpenViewOnce}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  background: 'rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.3)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  transition: 'transform 0.15s ease'
                }}
              >
                <span style={{ fontWeight: 700 }}>1️⃣</span>
                <Eye size={16} />
                <span>{message.type === 'video' ? 'View Once Video' : 'View Once Photo'}</span>
              </button>
            )}
          </div>
        )}

        {/* Standard Media / Image / Video Message */}
        {(message.type === 'image' || message.type === 'video') && !message.isViewOnce && message.mediaUrl && (
          <div style={{ borderRadius: '8px', overflow: 'hidden', marginBottom: '4px' }}>
            {message.type === 'video' ? (
              <video src={message.mediaUrl} controls style={{ maxWidth: '100%', maxHeight: '240px', objectFit: 'cover' }} />
            ) : (
              <img src={message.mediaUrl} alt="Attached Media" style={{ maxWidth: '100%', maxHeight: '240px', objectFit: 'cover' }} />
            )}
          </div>
        )}

        {/* Call Log Message */}
        {message.type === 'call' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '200px', padding: '2px 0' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: message.callData?.status === 'completed' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              color: message.callData?.status === 'completed' ? '#10b981' : '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {message.callData?.isVideo ? (
                message.callData?.status === 'completed' ? <Video size={18} /> : <VideoOff size={18} />
              ) : (
                message.callData?.status === 'completed' ? <Phone size={18} /> : <PhoneOff size={18} />
              )}
            </div>

            <div style={{ flex: 1 }}>
              <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {message.callData?.isVideo ? 'Video Call' : 'Voice Call'}
              </h4>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {message.callData?.status === 'completed'
                  ? `Duration: ${Math.floor((message.callData?.duration || 0) / 60)}m ${((message.callData?.duration || 0) % 60)}s`
                  : (message.callData?.status === 'declined' ? 'Call Declined' : 'Missed Call')}
              </p>
            </div>
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

        {/* Emoji Reactions display bar */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
            {Object.entries(message.reactions).map(([emoji, userIds]) => {
              if (!Array.isArray(userIds) || userIds.length === 0) return null;
              const hasReacted = userIds.includes(currentUser?.id);
              return (
                <button
                  key={emoji}
                  onClick={(e) => { e.stopPropagation(); handleReact(emoji); }}
                  style={{
                    background: hasReacted ? 'var(--accent)' : 'rgba(0,0,0,0.25)',
                    color: '#fff',
                    border: hasReacted ? '1px solid #fff' : '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '12px',
                    padding: '2px 8px',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title={hasReacted ? 'Click to remove reaction' : 'Click to add reaction'}
                >
                  <span>{emoji}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.7rem' }}>{userIds.length}</span>
                </button>
              );
            })}
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

      {/* Action Context Menu (Reactions, Thread Reply & Delete/Unsend) */}
      {showContextMenu && (
        <div style={{ position: 'absolute', top: '-44px', [isMine ? 'right' : 'left']: 0, background: 'var(--bg-sidebar)', border: '1px solid var(--border)', borderRadius: '14px', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '10px', zIndex: 30, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
          <span onClick={() => handleReact('👍')} style={{ cursor: 'pointer' }}>👍</span>
          <span onClick={() => handleReact('❤️')} style={{ cursor: 'pointer' }}>❤️</span>
          <span onClick={() => handleReact('🔥')} style={{ cursor: 'pointer' }}>🔥</span>

          <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} />

          <button onClick={() => { setShowThread(true); setShowContextMenu(false); }} className="icon-btn-ghost" title="Reply in sub-thread" style={{ padding: '2px' }}>
            <GitBranch size={16} />
          </button>

          {isMine && (
            <button onClick={handleUnsendForEveryone} className="icon-btn-ghost" title="Unsend for Everyone" style={{ color: '#ef4444', padding: '2px' }}>
              <Trash2 size={16} />
            </button>
          )}

          <button onClick={handleDeleteForMe} className="icon-btn-ghost" title="Delete for Me" style={{ color: 'var(--text-muted)', padding: '2px' }}>
            Delete
          </button>
        </div>
      )}

      {showThread && (
        <ThreadModal message={message} onClose={() => setShowThread(false)} currentUser={currentUser} />
      )}

      {showViewOnceModal && (
        <ViewOnceModal
          message={message}
          onMarkViewed={handleMarkViewed}
          onClose={() => setShowViewOnceModal(false)}
        />
      )}
    </div>
  );
}
