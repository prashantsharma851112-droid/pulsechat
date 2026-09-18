import React, { useState, useEffect, useContext, useRef } from 'react';
import { SocketContext } from '../../context/SocketContext';
import { AuthContext } from '../../context/AuthContext';
import { Check, CheckCheck, Play, Pause, BarChart2, CheckCircle2, XCircle, Trash2, GitBranch, Sparkles, Phone, PhoneOff, Video, VideoOff, Eye, CornerUpLeft, Pencil } from 'lucide-react';
import ThreadModal from './ThreadModal';
import ViewOnceModal from './ViewOnceModal';
import EditPollModal from './EditPollModal';
import { getPollTheme } from './pollThemes';

export default function MessageItem({
  message,
  isMine,
  chatId,
  senderName,
  onDeleteLocal,
  onDeleteTrigger,
  isMultiSelectMode,
  isSelected,
  onToggleSelect,
  onJoinGroupCall,
  onReply
}) {
  const { socket } = useContext(SocketContext);
  const { user: currentUser } = useContext(AuthContext);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioObj, setAudioObj] = useState(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const [showViewOnceModal, setShowViewOnceModal] = useState(false);
  const [showEditPoll, setShowEditPoll] = useState(false);
  const [viewedByState, setViewedByState] = useState(message.viewedBy || []);

  // Swipe-to-reply & Double-tap states
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);

  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const isSwipingRef = useRef(false);
  const lastTapRef = useRef(0);
  const isMouseDownRef = useRef(false);
  const mouseStartXRef = useRef(0);

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

  const handleDoubleTap = () => {
    handleReact('❤️');
    setShowHeartBurst(true);
    setTimeout(() => setShowHeartBurst(false), 750);
  };

  // Touch Swipe-to-Reply & Double-Tap Detection
  const handleTouchStart = (e) => {
    if (isMultiSelectMode) return;
    const touch = e.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    isSwipingRef.current = false;
  };

  const handleTouchMove = (e) => {
    if (isMultiSelectMode) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartXRef.current;
    const deltaY = Math.abs(touch.clientY - touchStartYRef.current);

    // Swipe right to reply (WhatsApp style)
    if (deltaX > 8 && deltaX > deltaY) {
      isSwipingRef.current = true;
      setIsDragging(true);
      const swipeDistance = Math.min(deltaX * 0.55, 65);
      setDragX(swipeDistance);
    }
  };

  const handleTouchEnd = () => {
    if (isMultiSelectMode) return;
    if (isSwipingRef.current) {
      if (dragX >= 35 && onReply) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(35);
        }
        onReply(message);
      }
    } else {
      // Check double tap
      const now = Date.now();
      if (now - lastTapRef.current < 320) {
        handleDoubleTap();
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    }

    isSwipingRef.current = false;
    setIsDragging(false);
    setDragX(0);
  };

  // Desktop Mouse Drag to Swipe
  const handleMouseDown = (e) => {
    if (isMultiSelectMode || e.button !== 0) return;
    isMouseDownRef.current = true;
    mouseStartXRef.current = e.clientX;
  };

  const handleMouseMove = (e) => {
    if (!isMouseDownRef.current || isMultiSelectMode) return;
    const deltaX = e.clientX - mouseStartXRef.current;
    if (deltaX > 6) {
      setIsDragging(true);
      const swipeDistance = Math.min(deltaX * 0.55, 65);
      setDragX(swipeDistance);
    }
  };

  const handleMouseUp = () => {
    if (isMouseDownRef.current) {
      if (dragX >= 35 && onReply) {
        onReply(message);
      }
      isMouseDownRef.current = false;
      setIsDragging(false);
      setDragX(0);
    }
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

  const handleEditPoll = (updatedPollData) => {
    if (socket) {
      socket.emit('edit_poll', {
        messageId: message.id,
        chatId,
        pollData: updatedPollData
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
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        alignSelf: isMine ? 'flex-end' : 'flex-start',
        maxWidth: '78%',
        minWidth: '160px',
        position: 'relative',
        cursor: isMultiSelectMode ? 'pointer' : 'default',
        touchAction: 'pan-y'
      }}
    >
      {/* Swipe to Reply Indicator */}
      {dragX > 6 && (
        <div
          className="swipe-reply-indicator"
          style={{
            opacity: Math.min(dragX / 35, 1),
            transform: `translateY(-50%) scale(${Math.min(0.5 + (dragX / 70), 1)})`
          }}
        >
          <CornerUpLeft size={16} />
        </div>
      )}

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
        onDoubleClick={!isMultiSelectMode ? handleDoubleTap : undefined}
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
          transform: `translateX(${dragX}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1), background 0.15s ease',
          userSelect: isDragging ? 'none' : 'auto',
          position: 'relative'
        }}
      >
        {/* Double-Tap Heart Burst Animation */}
        {showHeartBurst && (
          <div className="heart-burst-overlay">
            <span style={{ fontSize: '2.8rem', filter: 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.4))' }}>
              ❤️
            </span>
          </div>
        )}
        {/* Quoted Reply Preview (WhatsApp Style) */}
        {message.replyTo && (
          <div style={{
            background: 'rgba(0,0,0,0.18)',
            borderLeft: '3px solid var(--accent)',
            borderRadius: '8px',
            padding: '6px 10px',
            marginBottom: '8px',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            maxWidth: '100%',
            overflow: 'hidden'
          }}>
            <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: '2px', fontSize: '0.75rem' }}>
              {message.replyTo.senderName || 'Someone'}
            </div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.9 }}>
              {message.replyTo.type === 'text'
                ? (message.replyTo.content || '')
                : message.replyTo.type === 'voice'
                  ? '🎤 Voice note'
                  : message.replyTo.type === 'image'
                    ? '🖼️ Photo'
                    : message.replyTo.type === 'video'
                      ? '🎥 Video'
                      : `${message.replyTo.type || 'Message'}`}
            </div>
          </div>
        )}

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
          <p style={{ fontSize: '0.98rem', wordBreak: 'break-word', margin: 0, lineHeight: 1.45 }}>{message.content}</p>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '200px', padding: '2px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: message.callData?.status === 'completed' ? 'rgba(16, 185, 129, 0.2)' : (message.callData?.status === 'ongoing' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(239, 68, 68, 0.2)'),
                color: message.callData?.status === 'completed' ? '#10b981' : (message.callData?.status === 'ongoing' ? 'var(--accent)' : '#ef4444'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {message.callData?.isVideo ? (
                  (message.callData?.status === 'completed' || message.callData?.status === 'ongoing') ? <Video size={18} /> : <VideoOff size={18} />
                ) : (
                  (message.callData?.status === 'completed' || message.callData?.status === 'ongoing') ? <Phone size={18} /> : <PhoneOff size={18} />
                )}
              </div>

              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  {message.isGroup ? (message.callData?.isVideo ? 'Group Video Call' : 'Group Voice Call') : (message.callData?.isVideo ? 'Video Call' : 'Voice Call')}
                </h4>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {message.callData?.status === 'ongoing'
                    ? 'Group Call Active'
                    : (message.callData?.status === 'completed'
                        ? (message.callData?.duration ? `Duration: ${Math.floor(message.callData.duration / 60)}m ${message.callData.duration % 60}s` : 'Call Ended')
                        : (message.callData?.status === 'declined' ? 'Call Declined' : 'Missed Call'))}
                </p>
              </div>
            </div>

            {message.isGroup && message.callData?.status === 'ongoing' && onJoinGroupCall && (
              <button
                className="btn-primary"
                onClick={() => onJoinGroupCall(message.callData?.isVideo)}
                style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '10px', marginTop: '2px', background: '#10b981', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
              >
                <Phone size={14} /> Join Group Call
              </button>
            )}
          </div>
        )}

        {/* Poll Message */}
        {message.type === 'poll' && pollData && (() => {
          const pollTheme = getPollTheme(pollData.theme || 'purple');
          const isQuiz = Boolean(pollData.correctAnswerId);
          const hasCurrentUserVoted = pollData.options.some(opt => opt.votes && opt.votes.includes(currentUser?.id));
          const myVotedOption = pollData.options.find(opt => opt.votes && opt.votes.includes(currentUser?.id));
          const isMyVoteCorrect = isQuiz && hasCurrentUserVoted && myVotedOption?.id === pollData.correctAnswerId;

          return (
            <div style={{ minWidth: '230px', maxWidth: '330px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px',
                borderBottom: `1.5px solid ${pollTheme.border}`,
                paddingBottom: '8px',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1, minWidth: 0 }}>
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    background: pollTheme.gradient,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                    boxShadow: `0 2px 8px ${pollTheme.glow}`
                  }}>
                    <BarChart2 size={16} color="#fff" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isQuiz && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: hasCurrentUserVoted ? (isMyVoteCorrect ? '#10b981' : '#ef4444') : pollTheme.color,
                        background: hasCurrentUserVoted
                          ? (isMyVoteCorrect ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)')
                          : pollTheme.bgLight,
                        padding: '1px 7px',
                        borderRadius: '6px',
                        marginBottom: '3px'
                      }}>
                        {hasCurrentUserVoted
                          ? (isMyVoteCorrect ? '🎯 Quiz: Correct! 🎉' : '🎯 Quiz: Wrong answer ❌')
                          : '🎯 Quiz Question'}
                      </div>
                    )}
                    <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '600', lineHeight: 1.35, wordBreak: 'break-word' }}>
                      {pollData.question}
                    </h4>
                  </div>
                </div>

                {/* Edit button — sirf creator ke liye */}
                {isMine && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowEditPoll(true); }}
                    title="Edit Poll & Theme"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: pollTheme.gradient,
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '4px 10px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      flexShrink: 0,
                      boxShadow: `0 2px 8px ${pollTheme.glow}`,
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    <Pencil size={11} />
                    Edit
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {pollData.options.map((opt) => {
                  const votesCount = opt.votes ? opt.votes.length : 0;
                  const pct = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
                  const hasVotedThis = Boolean(opt.votes && opt.votes.includes(currentUser?.id));
                  const isThisCorrect = isQuiz && pollData.correctAnswerId === opt.id;

                  // Quiz styling logic
                  let borderColor = 'rgba(255,255,255,0.18)';
                  let bgColor = 'rgba(0,0,0,0.18)';
                  let barColor = pollTheme.barBg;
                  let showBar = hasCurrentUserVoted || !isQuiz;
                  let statusBadge = null;
                  let leadIcon = null;

                  if (isQuiz) {
                    if (hasCurrentUserVoted) {
                      // Result is revealed!
                      if (hasVotedThis) {
                        if (isThisCorrect) {
                          borderColor = '#10b981';
                          bgColor = 'rgba(16, 185, 129, 0.15)';
                          barColor = 'rgba(16, 185, 129, 0.35)';
                          leadIcon = <CheckCircle2 size={16} color="#10b981" />;
                          statusBadge = (
                            <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, background: 'rgba(16,185,129,0.2)', padding: '2px 7px', borderRadius: '6px' }}>
                              ✓ Correct!
                            </span>
                          );
                        } else {
                          borderColor = '#ef4444';
                          bgColor = 'rgba(239, 68, 68, 0.14)';
                          barColor = 'rgba(239, 68, 68, 0.3)';
                          leadIcon = <XCircle size={16} color="#ef4444" />;
                          statusBadge = (
                            <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 700, background: 'rgba(239,68,68,0.2)', padding: '2px 7px', borderRadius: '6px' }}>
                              ✗ Wrong
                            </span>
                          );
                        }
                      } else if (isThisCorrect) {
                        // User picked wrong or didn't pick this, reveal the true correct answer!
                        borderColor = 'rgba(16, 185, 129, 0.7)';
                        bgColor = 'rgba(16, 185, 129, 0.08)';
                        barColor = 'rgba(16, 185, 129, 0.22)';
                        leadIcon = <CheckCircle2 size={16} color="#10b981" />;
                        statusBadge = (
                          <span style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 600, background: 'rgba(16,185,129,0.15)', padding: '2px 6px', borderRadius: '6px' }}>
                            ✓ Right Answer
                          </span>
                        );
                      }
                    } else {
                      // Quiz: current user hasn't voted yet!
                      // Answer is completely HIDDEN!
                      borderColor = 'rgba(255,255,255,0.18)';
                      bgColor = 'rgba(0,0,0,0.15)';
                      showBar = false; // Don't leak answer through popularity before vote!
                    }
                  } else {
                    // Standard opinion poll
                    if (hasVotedThis) {
                      borderColor = pollTheme.primary;
                      bgColor = pollTheme.bgLight;
                      leadIcon = <CheckCircle2 size={16} color={pollTheme.primary} />;
                    }
                  }

                  return (
                    <div
                      key={opt.id}
                      onClick={() => handleVotePoll(opt.id)}
                      style={{
                        position: 'relative',
                        padding: '9px 12px',
                        borderRadius: '10px',
                        border: `1.5px solid ${borderColor}`,
                        background: bgColor,
                        cursor: 'pointer',
                        overflow: 'hidden',
                        transition: 'all 0.2s ease',
                        boxShadow: (hasVotedThis && isQuiz && isThisCorrect) ? '0 0 12px rgba(16,185,129,0.25)' : undefined
                      }}
                    >
                      {/* Animated Progress bar */}
                      {showBar && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            bottom: 0,
                            width: `${pct}%`,
                            background: barColor,
                            transition: 'width 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
                            pointerEvents: 'none'
                          }}
                        />
                      )}

                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1, gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', flex: 1, minWidth: 0 }}>
                          {leadIcon}
                          <span style={{
                            color: (isQuiz && hasCurrentUserVoted && isThisCorrect) ? '#10b981' : ((isQuiz && hasCurrentUserVoted && hasVotedThis && !isThisCorrect) ? '#fca5a5' : 'var(--text-main)'),
                            fontWeight: hasVotedThis ? 600 : 400,
                            wordBreak: 'break-word'
                          }}>
                            {opt.text}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          {statusBadge}
                          {showBar ? (
                            <span style={{ fontSize: '0.78rem', fontWeight: '600', opacity: 0.9 }}>
                              {pct}% {totalVotes > 0 && `(${votesCount})`}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: pollTheme.color, opacity: 0.85, fontWeight: 500 }}>
                              Tap to answer
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer Info */}
              <div style={{ fontSize: '0.72rem', opacity: 0.75, marginTop: '9px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>
                  {isQuiz
                    ? (hasCurrentUserVoted
                        ? (isMyVoteCorrect ? '🎉 Correct answer submitted!' : '❌ Incorrect answer chosen')
                        : '🔒 Answer reveals after you vote')
                    : (pollData.isMultipleChoice ? 'Multiple choice' : 'Single choice')}
                </span>
                <span>
                  {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
                </span>
              </div>
            </div>
          );
        })()}


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

          {/* Reply Button */}
          <button
            onClick={() => {
              if (onReply) onReply(message);
              setShowContextMenu(false);
            }}
            className="icon-btn-ghost"
            title="Reply to message"
            style={{ padding: '2px', color: 'var(--accent)' }}
          >
            <CornerUpLeft size={16} />
          </button>

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

      {showEditPoll && pollData && (
        <EditPollModal
          pollData={pollData}
          onClose={() => setShowEditPoll(false)}
          onSave={handleEditPoll}
        />
      )}
    </div>
  );
}
