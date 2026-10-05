import React, { useState, useEffect, useContext, useRef } from 'react';
import { SocketContext } from '../../context/SocketContext';
import { AuthContext } from '../../context/AuthContext';
import { BACKEND_URL } from '../../utils/config';
import { Check, CheckCheck, Clock, Play, Pause, BarChart2, CheckCircle2, XCircle, Trash2, GitBranch, Sparkles, Phone, PhoneOff, Video, VideoOff, Eye, CornerUpLeft, Pencil, Download, Maximize2, FileText, X, Star, Plus, SlidersHorizontal, Forward, Edit3 } from 'lucide-react';
import ThreadModal from './ThreadModal';
import ViewOnceModal from './ViewOnceModal';
import FogSnapModal from './FogSnapModal';
import EditPollModal from './EditPollModal';
import { getPollTheme, getPollAura } from './pollThemes';
import PulseVipBadge from '../common/PulseVipBadge';
import Sticker3D from '../common/Sticker3D';
import Animated3DText from '../common/Animated3DText';
import GiftUnboxModal from './GiftUnboxModal';
import { getSavedQuickReactions, recordRecentReaction } from '../../utils/quickReactions';

function StealthDustCard({ message, chatId, isMine, socket }) {
  const [isRevealing, setIsRevealing] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [isDissolving, setIsDissolving] = useState(false);
  const timerRef = useRef(null);
  const isRevealingRef = useRef(false);
  const isDissolvingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startReveal = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (isDissolvingRef.current || isRevealingRef.current) return;
    isRevealingRef.current = true;
    setIsRevealing(true);
    setCountdown(5);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          dissolve();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const dissolve = () => {
    if (isDissolvingRef.current) return;
    isDissolvingRef.current = true;
    setIsDissolving(true);
    if (timerRef.current) clearInterval(timerRef.current);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pulsechat_trigger_emoji_burst', {
        detail: { emoji: '⚡', count: 25 }
      }));
    }

    const payload = {
      chatId,
      messageId: message.id,
      messageMongoId: message._id,
      clientTempId: message.clientTempId
    };

    // Direct local event dispatch for 0ms disappearance
    window.dispatchEvent(new CustomEvent('pulsechat_stealth_dust_dissolved', {
      detail: payload
    }));

    if (socket) {
      socket.emit('dissolve_stealth_dust', payload);
    }

    // Permanent REST endpoint fallback for DB deletion
    try {
      const rawToken = localStorage.getItem('pulsechat_token');
      const targetId = message.id || message._id || message.clientTempId;
      fetch(`${BACKEND_URL}/api/messages/dissolve-dust/${targetId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(rawToken ? { Authorization: `Bearer ${rawToken}` } : {})
        },
        body: JSON.stringify(payload)
      }).catch(() => {});
    } catch (e) {}
  };

  if (isDissolving) {
    return (
      <div style={{ opacity: 0.4, filter: 'blur(8px)', transition: 'all 0.5s ease', padding: '12px 16px', fontStyle: 'italic', fontSize: '0.8rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
        ⚡ Dissolved into digital dust...
      </div>
    );
  }

  return (
    <div
      onClick={!isRevealing ? startReveal : undefined}
      style={{
        background: isRevealing ? 'rgba(15, 23, 42, 0.98)' : 'rgba(15, 23, 42, 0.92)',
        border: isRevealing ? '1px solid rgba(245, 158, 11, 0.8)' : '1px solid rgba(245, 158, 11, 0.4)',
        boxShadow: isRevealing ? '0 0 20px rgba(245, 158, 11, 0.5), inset 0 0 12px rgba(245, 158, 11, 0.1)' : '0 2px 10px rgba(0,0,0,0.3)',
        borderRadius: '14px',
        padding: '12px 14px',
        color: '#fff',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        cursor: isRevealing ? 'default' : 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        minWidth: '220px',
        maxWidth: '320px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '5px', letterSpacing: '0.5px' }}>
          ⚡ DUST TEXT
        </span>
        <span style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          color: isRevealing ? '#ef4444' : '#fbbf24',
          background: isRevealing ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
          border: isRevealing ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
          padding: '2px 8px',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          {isRevealing ? `💥 ${countdown}s` : '🔒 TAP TO REVEAL'}
        </span>
      </div>

      {/* Progress Bar when revealing */}
      {isRevealing && (
        <div style={{ height: '3px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', marginBottom: '8px' }}>
          <div style={{
            height: '100%',
            width: `${(countdown / 5) * 100}%`,
            background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
            transition: 'width 1s linear'
          }} />
        </div>
      )}

      {/* Secret Message Content */}
      <div style={{
        filter: isRevealing ? 'none' : 'blur(7px)',
        transition: 'filter 0.3s ease',
        fontSize: '0.92rem',
        lineHeight: 1.4,
        wordBreak: 'break-word',
        fontFamily: isRevealing ? 'inherit' : 'monospace',
        padding: '2px 0',
        minHeight: '22px'
      }}>
        {message.content}
      </div>

      {/* Bottom Hint */}
      {!isRevealing ? (
        <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '8px', textAlign: 'center', fontStyle: 'italic', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          👁️ Tap to read (Self-destructs in 5s once opened)
        </div>
      ) : (
        <div style={{ fontSize: '0.65rem', color: '#ef4444', marginTop: '6px', textAlign: 'right', fontWeight: 600 }}>
          Self-destructing in {countdown}s...
        </div>
      )}
    </div>
  );
}


function StoryReplyCard({ message, isMine, onOpenStory, onOpenSparksWallet }) {
  const sr = message.storyReply;
  const isReaction = Boolean(sr?.reactionEmoji || (!sr && message.content && message.content.startsWith('Reacted ') && message.content.includes('story')));
  const isSparks = Boolean(sr?.tipSparks || (!sr && message.content && message.content.startsWith('Tipped ') && message.content.includes('story')));

  let reactionEmoji = sr?.reactionEmoji;
  if (!reactionEmoji && message.content) {
    const m = message.content.match(/Reacted\s+([^\s]+)\s+to/);
    if (m) reactionEmoji = m[1];
  }

  let replyText = sr?.replyText;
  if (!replyText && !isReaction && !isSparks && message.content) {
    replyText = message.content.replace(/^(Replied to your story:|You replied:)\s*"?/, '').replace(/"?$/, '').trim();
  }

  let tipSparks = sr?.tipSparks;
  if (!tipSparks && isSparks && message.content) {
    const m = message.content.match(/Tipped\s*(?:⚡)?\s*(\d+)/);
    if (m) tipSparks = m[1];
  }

  const storyAuthorId = sr?.authorId || (isMine ? message.receiverId : message.senderId);
  const storyAuthorName = sr?.authorName || (isMine ? 'User' : (message.senderName || 'User'));
  const isMyStory = !isMine; // If message was received by me, it's a reaction to my story

  const handleCardClick = (e) => {
    e.stopPropagation();
    const storyPayload = sr || {
      storyId: 'story_' + (message.id || Date.now()),
      mediaUrl: null,
      caption: '',
      authorId: storyAuthorId,
      authorName: storyAuthorName
    };
    if (onOpenStory) {
      onOpenStory(storyPayload);
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pulsechat_open_story', { detail: storyPayload }));
    }
  };

  const hasMedia = Boolean(sr?.mediaUrl);
  const isVideo = sr?.mediaType === 'video' || (sr?.mediaUrl && sr.mediaUrl.match(/\.(mp4|webm|mov)$/i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '220px', maxWidth: '280px' }}>
      {/* 1. Instagram-Style Story Thumbnail Preview Box */}
      <div
        onClick={handleCardClick}
        style={{
          position: 'relative',
          borderRadius: '16px',
          overflow: 'hidden',
          cursor: 'pointer',
          border: '1.5px solid rgba(255, 255, 255, 0.18)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          background: sr?.bgGradient || 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)',
          height: hasMedia || sr?.caption ? '150px' : '110px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'transform 0.18s ease, box-shadow 0.18s ease',
          userSelect: 'none'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        title="Tap to view story"
      >
        {/* Media (Image or Video) with Dark Gradient Blend */}
        {hasMedia && (
          <>
            {isVideo ? (
              <video
                src={sr.mediaUrl}
                muted
                playsInline
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            ) : (
              <img
                src={sr.mediaUrl}
                alt="Story preview"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            {/* Blend Gradient Overlay */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.65) 100%)',
              pointerEvents: 'none'
            }} />
          </>
        )}

        {/* Top Header Tag: Story Pill */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          padding: '8px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 800,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            color: '#fff',
            padding: '3px 8px',
            borderRadius: '20px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            letterSpacing: '0.4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
              display: 'inline-block'
            }} />
            {isMyStory ? 'Your Story' : 'Story'}
          </span>

          <span style={{
            fontSize: '0.65rem',
            color: 'rgba(255,255,255,0.9)',
            background: 'rgba(0,0,0,0.5)',
            padding: '2px 7px',
            borderRadius: '10px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '3px'
          }}>
            <Eye size={11} /> View
          </span>
        </div>

        {/* Text Story Caption or Media Caption */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          flex: 1
        }}>
          {sr?.caption ? (
            <p style={{
              margin: 0,
              fontSize: '0.84rem',
              fontWeight: 600,
              color: '#ffffff',
              textShadow: '0 2px 6px rgba(0,0,0,0.9)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.3
            }}>
              {sr.caption}
            </p>
          ) : !hasMedia && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.9)',
              fontSize: '0.85rem',
              fontWeight: 700
            }}>
              ✨ Story
            </div>
          )}
        </div>
      </div>

      {/* 2. Reaction or Reply Bubble Content */}
      {isReaction ? (
        /* Instagram Style Story Reaction */
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '4px 6px',
          background: 'rgba(0,0,0,0.18)',
          borderRadius: '12px'
        }}>
          <span style={{
            fontSize: '2rem',
            lineHeight: 1,
            filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.4))',
            animation: 'pulseModalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            {reactionEmoji || '❤️'}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {isMyStory ? 'Reacted to your story' : 'You reacted to story'}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Quick reaction
            </span>
          </div>
        </div>
      ) : isSparks ? (
        /* Sparks Tip on Story - Interactive tap to open Sparks Wallet & History */
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (onOpenSparksWallet) {
              onOpenSparksWallet();
            } else if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('pulsechat_open_sparks_wallet'));
            }
          }}
          title="Click to view your Sparks Wallet & Balance"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            padding: '8px 12px',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.22), rgba(217, 119, 6, 0.14))',
            border: '1.5px solid rgba(245, 158, 11, 0.45)',
            borderRadius: '14px',
            cursor: 'pointer',
            transition: 'transform 0.15s ease, background 0.15s ease',
            boxShadow: '0 4px 14px rgba(245, 158, 11, 0.15)'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.3rem', filter: 'drop-shadow(0 2px 6px rgba(245, 158, 11, 0.6))' }}>⚡</span>
            <div>
              <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#f59e0b' }}>
                {isMyStory ? `Tipped ⚡ ${tipSparks || 10} Sparks on your story!` : `Tipped ⚡ ${tipSparks || 10} Sparks on story!`}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'rgba(255, 255, 255, 0.75)', fontWeight: 600 }}>
                Tap to view Sparks Wallet & History
              </div>
            </div>
          </div>
          <span style={{
            fontSize: '0.72rem',
            padding: '3px 8px',
            borderRadius: '10px',
            background: 'rgba(245, 158, 11, 0.3)',
            color: '#fff',
            fontWeight: 700,
            whiteSpace: 'nowrap'
          }}>
            Wallet →
          </span>
        </div>
      ) : (
        /* Instagram Style Story Reply Message Text */
        <div style={{
          padding: '2px 4px'
        }}>
          <p style={{
            fontSize: '0.98rem',
            wordBreak: 'break-word',
            margin: 0,
            lineHeight: 1.45,
            fontWeight: 500,
            color: 'var(--text-main)'
          }}>
            {replyText || message.content}
          </p>
        </div>
      )}
    </div>
  );
}

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
  onReply,
  senderIsPro,
  isSelectedForAction,
  onSelectForAction,
  isStarred,
  onOpenUnlimitedEmoji,
  onOpenCustomizeReactions,
  onDismissAction,
  onOpenStory,
  onOpenSparksWallet,
  onEditDrawing
}) {
  const { socket } = useContext(SocketContext);
  const { user: currentUser } = useContext(AuthContext);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioObj, setAudioObj] = useState(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const [showViewOnceModal, setShowViewOnceModal] = useState(false);
  const [showFogSnapModal, setShowFogSnapModal] = useState(false);
  const fogStorageKey = message?.id ? `pulse_fog_burned_${message.id}` : (message?._id ? `pulse_fog_burned_${message._id}` : null);
  const isFogBurnedLocally = (() => {
    if (!fogStorageKey) return false;
    try {
      return localStorage.getItem(fogStorageKey) === 'true';
    } catch {
      return false;
    }
  })();
  const [fogStatus, setFogStatus] = useState(() => {
    if (isFogBurnedLocally || message.fogSnapStatus === 'burned' || message.content === '🌫️ Fog Snap Evaporated' || (message.isFogSnap && !message.mediaUrl)) {
      return 'burned';
    }
    return message.fogSnapStatus || 'unrevealed';
  });
  const [showEditPoll, setShowEditPoll] = useState(false);
  const [viewedByState, setViewedByState] = useState(message.viewedBy || []);
  const [downloadState, setDownloadState] = useState(''); // '' | 'Saving...' | 'Saved!'
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [showGiftUnboxModal, setShowGiftUnboxModal] = useState(false);
  const giftStorageKey = (message.type === 'gift' && message.id) ? `pulse_gift_unboxed_${message.id}` : null;
  const [isGiftUnboxed, setIsGiftUnboxed] = useState(() => {
    if (!giftStorageKey) return false;
    try {
      return localStorage.getItem(giftStorageKey) === 'true';
    } catch {
      return false;
    }
  });

  // Quick Reaction emojis sequence state
  const [quickReactions, setQuickReactions] = useState(() => getSavedQuickReactions());

  useEffect(() => {
    const handleQuickReactionsUpdate = (e) => {
      if (e.detail?.reactions) {
        setQuickReactions(e.detail.reactions);
      }
    };
    window.addEventListener('pulsechat_quick_reactions_updated', handleQuickReactionsUpdate);
    return () => window.removeEventListener('pulsechat_quick_reactions_updated', handleQuickReactionsUpdate);
  }, []);

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
  const longPressTimerRef = useRef(null);
  const isLongPressRef = useRef(false);

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

  useEffect(() => {
    if (!message.isFogSnap) return;
    const handleFogBurned = ({ messageId }) => {
      if (messageId === message.id || messageId === message._id) {
        setFogStatus('burned');
        message.fogSnapStatus = 'burned';
        message.mediaUrl = null;
        message.content = '🌫️ Fog Snap Evaporated';
        try {
          if (message.id) localStorage.setItem(`pulse_fog_burned_${message.id}`, 'true');
          if (message._id) localStorage.setItem(`pulse_fog_burned_${message._id}`, 'true');
        } catch (e) {}
      }
    };
    const handleFogRevealed = ({ messageId }) => {
      if (messageId === message.id || messageId === message._id) {
        setFogStatus('revealed');
      }
    };
    if (socket) {
      socket.on('fog_snap_burned', handleFogBurned);
      socket.on('fog_snap_revealed', handleFogRevealed);
    }
    const handleWindowFogBurned = (e) => {
      if (e.detail?.messageId === message.id || e.detail?.messageId === message._id) {
        handleFogBurned({ messageId: e.detail.messageId });
      }
    };
    window.addEventListener('pulsechat_fog_snap_burned', handleWindowFogBurned);

    return () => {
      if (socket) {
        socket.off('fog_snap_burned', handleFogBurned);
        socket.off('fog_snap_revealed', handleFogRevealed);
      }
      window.removeEventListener('pulsechat_fog_snap_burned', handleWindowFogBurned);
    };
  }, [socket, message.id, message._id, message.isFogSnap]);

  const isFogBurned = Boolean(
    fogStatus === 'burned' ||
    message.fogSnapStatus === 'burned' ||
    message.content === '🌫️ Fog Snap Evaporated' ||
    (message.isFogSnap && !message.mediaUrl) ||
    isFogBurnedLocally
  );

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

  const handleDownloadMedia = async (e, customUrl, customFileName) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const targetUrl = customUrl || message.mediaUrl;
    if (!targetUrl || message.isViewOnce || message.isFogSnap) return;

    setDownloadState('Saving...');

    try {
      let fileName = customFileName || message.fileName;
      if (!fileName) {
        const isDrawing = message.content?.includes('drawing') || (message.type === 'image' && !message.fileName);
        const ext = message.type === 'video' ? 'mp4' : (message.type === 'document' ? 'bin' : 'png');
        fileName = `${isDrawing ? 'pulsechat_drawing' : (message.type === 'video' ? 'pulsechat_video' : 'pulsechat_image')}_${Date.now()}.${ext}`;
      }

      if (targetUrl.startsWith('data:') || targetUrl.startsWith('blob:')) {
        const link = document.createElement('a');
        link.href = targetUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        try {
          const res = await fetch(targetUrl, { mode: 'cors' });
          if (!res.ok) throw new Error('Fetch failed');
          const blob = await res.blob();
          const objectUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = objectUrl;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => window.URL.revokeObjectURL(objectUrl), 2000);
        } catch (fetchErr) {
          const link = document.createElement('a');
          link.href = targetUrl;
          link.download = fileName;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }

      setDownloadState('Saved!');
      setTimeout(() => setDownloadState(''), 2000);
    } catch (err) {
      console.error('Failed to download media:', err);
      setDownloadState('Error');
      setTimeout(() => setDownloadState(''), 2000);
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
    recordRecentReaction(emoji);
    const existingList = message.reactions?.[emoji] || [];
    const isAlreadyReacted = Array.isArray(existingList) && existingList.includes(currentUser?.id);

    if (socket && currentUser?.id) {
      socket.emit('add_reaction', { messageId: message.id, chatId, emoji, userId: currentUser.id });
    }
    if (!isAlreadyReacted && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pulsechat_trigger_emoji_burst', {
        detail: { emoji: emoji || '❤️', mode: 'reaction', duration: 3 }
      }));
    }
    setShowContextMenu(false);
    if (onDismissAction) onDismissAction();
  };

  const handleDoubleTap = () => {
    handleReact('❤️');
    setShowHeartBurst(true);
    setTimeout(() => setShowHeartBurst(false), 750);
  };

  // Touch Long-Press Selection & Swipe-to-Reply Detection
  const handleTouchStart = (e) => {
    if (isMultiSelectMode) return;
    const touch = e.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    isSwipingRef.current = false;
    isLongPressRef.current = false;

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(40);
      }
      if (onSelectForAction) {
        onSelectForAction(message);
      }
    }, 420);
  };

  const handleTouchMove = (e) => {
    if (isMultiSelectMode) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartXRef.current;
    const deltaY = Math.abs(touch.clientY - touchStartYRef.current);

    // Cancel long press if finger moved
    if (Math.abs(deltaX) > 8 || deltaY > 8) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }

    if (isLongPressRef.current) return;

    // Swipe right to reply (WhatsApp style)
    if (deltaX > 8 && deltaX > deltaY) {
      isSwipingRef.current = true;
      setIsDragging(true);
      const swipeDistance = Math.min(deltaX * 0.55, 65);
      setDragX(swipeDistance);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }
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

  if (message.type === 'system') {
    return (
      <div style={{
        alignSelf: 'center',
        margin: '10px auto',
        maxWidth: '85%',
        textAlign: 'center',
        background: 'rgba(99, 102, 241, 0.12)',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        borderRadius: '16px',
        padding: '6px 14px',
        fontSize: '0.78rem',
        color: 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
      }}>
        <span>{message.content}</span>
      </div>
    );
  }

  return (
    <div
      id={`msg-${message.id || message._id || message.clientTempId}`}
      onClick={(e) => {
        if (isMultiSelectMode) {
          if (onToggleSelect) onToggleSelect(message.id);
        } else if (!isSelectedForAction && onDismissAction) {
          onDismissAction();
        }
      }}
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
        touchAction: 'pan-y',
        zIndex: isSelectedForAction ? 999 : (isMultiSelectMode ? 10 : 1)
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '600', color: 'var(--accent)', marginBottom: '3px', marginLeft: '6px' }}>
          <span>{senderName || 'Group Member'}</span>
          {senderIsPro && (
            <PulseVipBadge size={14} showLabel={false} />
          )}
        </div>
      )}

      <div
        onClick={(e) => {
          if (isSelectedForAction) {
            e.stopPropagation();
          }
        }}
        onDoubleClick={!isMultiSelectMode ? handleDoubleTap : undefined}
        onContextMenu={(e) => {
          if (!isMultiSelectMode) {
            e.preventDefault();
            if (onSelectForAction) {
              onSelectForAction(message);
            }
          }
        }}
        style={{
          background: (message.type === 'gift' || message.type === '3d_text')
            ? ((isSelected || isSelectedForAction) ? 'rgba(99, 102, 241, 0.25)' : 'transparent')
            : ((isSelected || isSelectedForAction) ? 'rgba(99, 102, 241, 0.28)' : (isMine ? 'var(--bubble-sent)' : 'var(--bubble-received)')),
          color: isMine ? '#ffffff' : 'var(--text-main)',
          padding: (message.type === 'gift' || message.type === '3d_text') ? '2px 4px' : '0.75rem 1rem',
          borderRadius: isMine ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
          boxShadow: isSelectedForAction
            ? '0 0 22px rgba(99, 102, 241, 0.55), 0 4px 14px rgba(0,0,0,0.3)'
            : ((message.type === 'gift' || message.type === '3d_text') ? 'none' : '0 2px 6px rgba(0,0,0,0.08)'),
          border: isSelectedForAction
            ? '1.5px solid var(--accent)'
            : (isSelected ? '1.5px solid var(--accent)' : ((message.type === 'gift' || message.type === '3d_text') ? 'none' : '1px solid transparent')),
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
        {/* Forwarded Message Header (WhatsApp Style) */}
        {message.isForwarded && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '0.72rem',
            fontStyle: 'italic',
            color: isMine ? 'rgba(255, 255, 255, 0.72)' : 'var(--text-muted)',
            marginBottom: '4px',
            userSelect: 'none'
          }}>
            <Forward size={13} style={{ flexShrink: 0 }} />
            <span>Forwarded</span>
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

        {/* Stealth Dust Note Message */}
        {message.type === 'stealth_dust' && (
          <StealthDustCard message={message} chatId={chatId} isMine={isMine} socket={socket} />
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

        {/* Instagram-Style Story Reply / Reaction Message */}
        {(message.type === 'story_reply' || Boolean(message.storyReply) || (
          message.type === 'text' && message.content && (
            message.content.startsWith('Replied to your story:') ||
            message.content.startsWith('You replied: ') ||
            (message.content.startsWith('Reacted ') && message.content.includes('story')) ||
            (message.content.startsWith('Tipped ') && message.content.includes('story'))
          )
        )) ? (
          <StoryReplyCard
            message={message}
            isMine={isMine}
            onOpenStory={onOpenStory}
            onOpenSparksWallet={onOpenSparksWallet}
          />
        ) : (message.type === 'text' && (
          <p style={{ fontSize: '0.98rem', wordBreak: 'break-word', margin: 0, lineHeight: 1.45 }}>
            {message.content}
          </p>
        ))}

        {/* View Once Media Message */}
        {(message.type === 'image' || message.type === 'video') && message.isViewOnce && !message.isFogSnap && (
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

        {/* Fog Snap (Scratch-to-Reveal) Media Message */}
        {/* Fog Snap (Scratch-to-Reveal) Media Message */}
        {(message.type === 'image' || message.type === 'video') && message.isFogSnap && (
          <div style={{ padding: '4px 0' }}>
            {isFogBurned ? (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 16px',
                borderRadius: '16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px dashed rgba(255, 255, 255, 0.2)',
                color: 'rgba(255, 255, 255, 0.55)',
                fontSize: '0.85rem'
              }}>
                <span style={{ fontSize: '1.25rem' }}>🌫️</span>
                <div>
                  <div style={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.75)' }}>Fog Snap Evaporated</div>
                  <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>Burned into smoke forever</div>
                </div>
              </div>
            ) : isMine ? (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 16px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(236, 72, 153, 0.2) 50%, rgba(56, 189, 248, 0.15) 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  boxShadow: '0 4px 15px rgba(168, 85, 247, 0.15)',
                  backdropFilter: 'blur(10px)',
                  color: '#fff',
                  textAlign: 'left'
                }}
              >
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.3rem',
                  boxShadow: '0 2px 8px rgba(236,72,153,0.3)',
                  flexShrink: 0
                }}>
                  🌫️
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Secret Fog Snap</span>
                    <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '10px', background: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {message.fogSnapDuration || 7}s
                    </span>
                  </div>
                  <div style={{ fontSize: '0.74rem', opacity: 0.82, marginTop: '2px' }}>
                    🔒 Sent • Scratchable by recipient only
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowFogSnapModal(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 16px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(236, 72, 153, 0.25) 50%, rgba(56, 189, 248, 0.2) 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.35)',
                  boxShadow: '0 4px 15px rgba(236, 72, 153, 0.25)',
                  backdropFilter: 'blur(10px)',
                  color: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'transform 0.15s ease'
                }}
              >
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.3rem',
                  boxShadow: '0 2px 8px rgba(236,72,153,0.4)',
                  flexShrink: 0
                }}>
                  🌫️
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Secret Fog Snap</span>
                    <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '10px', background: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {message.fogSnapDuration || 7}s
                    </span>
                  </div>
                  <div style={{ fontSize: '0.74rem', opacity: 0.82, marginTop: '2px' }}>
                    👆 Scratch mist to reveal • Self-destructs
                  </div>
                </div>
              </button>
            )}
          </div>
        )}

        {/* Standard Media / Image / Video Message */}
        {(message.type === 'image' || message.type === 'video') && !message.isViewOnce && !message.isFogSnap && message.mediaUrl && (
          <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', marginBottom: '4px', maxWidth: '100%' }}>
            {message.type === 'video' ? (
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
                <video
                  src={message.mediaUrl}
                  controls
                  playsInline
                  preload="metadata"
                  style={{ maxWidth: '100%', maxHeight: '280px', objectFit: 'contain', borderRadius: '10px', display: 'block', background: '#000' }}
                />
                <button
                  type="button"
                  onClick={(e) => handleDownloadMedia(e, message.mediaUrl, message.fileName || `pulsechat_video_${Date.now()}.mp4`)}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'rgba(15, 23, 42, 0.78)',
                    backdropFilter: 'blur(8px)',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    borderRadius: '20px',
                    padding: '5px 11px',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
                    zIndex: 10,
                    transition: 'all 0.2s ease'
                  }}
                  title="Save video to device"
                >
                  <Download size={13} />
                  <span>{downloadState || 'Save Video'}</span>
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
                <img
                  src={message.mediaUrl}
                  alt={message.fileName || "Attached Media"}
                  onClick={() => setShowImagePreview(true)}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '280px',
                    objectFit: 'cover',
                    borderRadius: '10px',
                    display: 'block',
                    cursor: 'pointer'
                  }}
                />
                {/* Floating Download, Edit & Fullscreen Controls */}
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  zIndex: 10
                }}>
                  {onEditDrawing && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditDrawing(message.mediaUrl, message.whiteboardData);
                      }}
                      style={{
                        background: 'rgba(99, 102, 241, 0.88)',
                        backdropFilter: 'blur(8px)',
                        color: '#fff',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: '20px',
                        padding: '5px 10px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
                        transition: 'all 0.2s ease'
                      }}
                      title="Edit this drawing on Live Drawboard"
                    >
                      <Edit3 size={12} />
                      <span>Edit</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowImagePreview(true);
                    }}
                    style={{
                      background: 'rgba(15, 23, 42, 0.78)',
                      backdropFilter: 'blur(8px)',
                      color: '#fff',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.35)'
                    }}
                    title="View Fullscreen"
                  >
                    <Maximize2 size={13} />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleDownloadMedia(
                      e,
                      message.mediaUrl,
                      message.fileName || (message.content?.includes('drawing') ? `pulsechat_drawing_${Date.now()}.png` : `pulsechat_image_${Date.now()}.jpg`)
                    )}
                    style={{
                      background: 'rgba(15, 23, 42, 0.78)',
                      backdropFilter: 'blur(8px)',
                      color: '#fff',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      borderRadius: '20px',
                      padding: '5px 11px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
                      transition: 'all 0.2s ease'
                    }}
                    title="Save image to device"
                  >
                    <Download size={13} />
                    <span>{downloadState || 'Save'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Document Attachment Message */}
        {message.type === 'document' && message.mediaUrl && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            background: 'rgba(0, 0, 0, 0.22)',
            padding: '10px 14px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            minWidth: '220px',
            maxWidth: '320px',
            marginBottom: '4px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', flex: 1 }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(99, 102, 241, 0.25)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <FileText size={18} />
              </div>
              <div style={{ overflow: 'hidden', textAlign: 'left', flex: 1 }}>
                <div style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: 'var(--text-main)'
                }}>
                  {message.fileName || 'Attached Document'}
                </div>
                {message.fileSize && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {message.fileSize}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => handleDownloadMedia(e, message.mediaUrl, message.fileName || `pulsechat_file_${Date.now()}`)}
              style={{
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 11px',
                fontSize: '0.75rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                flexShrink: 0
              }}
              title="Download Document"
            >
              <Download size={14} />
              <span>{downloadState || 'Save'}</span>
            </button>
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

        {/* Virtual Gift 3D Animated Gift Sticker (100% Clean like Coffee) */}
        {message.type === 'gift' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
            <Sticker3D
              giftId={isGiftUnboxed ? (message.giftData?.giftId || 'coffee') : 'giftbox'}
              sparkAmount={message.giftData?.sparkAmount || 10}
              isMine={isMine}
              timeStr={timeStr}
              status={message.status}
              onClick={() => setShowGiftUnboxModal(true)}
            />

            {showGiftUnboxModal && (
              <GiftUnboxModal
                giftData={message.giftData}
                senderName={message.senderName || senderName || 'Friend'}
                senderAvatar={message.senderAvatar || null}
                isMine={isMine}
                messageId={message.id}
                onClose={() => {
                  setShowGiftUnboxModal(false);
                  if (giftStorageKey && localStorage.getItem(giftStorageKey) === 'true') {
                    setIsGiftUnboxed(true);
                  }
                }}
                onOpenWallet={() => {
                  setShowGiftUnboxModal(false);
                  if (onOpenSparksWallet) {
                    onOpenSparksWallet();
                  } else if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('pulsechat_open_sparks_wallet'));
                  }
                }}
              />
            )}
          </div>
        )}

        {/* 3D Animated Typography Message (VIP Pro Feature) */}
        {message.type === '3d_text' && (
          <Animated3DText
            text={message.content}
            styleType={message.textStyle || 'cyber-neon'}
            isMine={isMine}
            timeStr={timeStr}
            status={message.status}
          />
        )}

        {/* Poll Message */}
        {message.type === 'poll' && pollData && (() => {
          const pollTheme = getPollTheme(pollData.theme || 'purple');
          const pollAura = getPollAura(pollData.aura || 'standard');
          const isQuiz = Boolean(pollData.correctAnswerId);
          const hasCurrentUserVoted = pollData.options.some(opt => opt.votes && opt.votes.includes(currentUser?.id));
          const myVotedOption = pollData.options.find(opt => opt.votes && opt.votes.includes(currentUser?.id));
          const isMyVoteCorrect = isQuiz && hasCurrentUserVoted && myVotedOption?.id === pollData.correctAnswerId;

          return (
            <div className={`poll-aura-card poll-aura-${pollData.aura || 'standard'}`} style={{ minWidth: '230px', maxWidth: '330px', padding: pollData.aura && pollData.aura !== 'standard' ? '10px' : '0' }}>
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

        {/* Timestamp & Ticks (hidden for gift stickers and 3D text as they display it natively) */}
        {message.type !== 'gift' && message.type !== '3d_text' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem', marginTop: '0.35rem', fontSize: '0.68rem', opacity: 0.75 }}>
            {isStarred && (
              <Star size={11} fill="#f59e0b" color="#f59e0b" style={{ marginRight: '1px', flexShrink: 0 }} title="Starred message" />
            )}
            <span>{timeStr}</span>
            {isMine && (
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                {message.status === 'pending' ? (
                  <Clock size={12} color="#9ca3af" title="Waiting for network / Pending" />
                ) : message.status === 'read' ? (
                  <CheckCheck size={14} color="#53bdeb" />
                ) : message.status === 'delivered' ? (
                  <CheckCheck size={14} color="#9ca3af" />
                ) : (
                  <Check size={14} color="#9ca3af" />
                )}
              </span>
            )}
          </div>
        )}
      </div>

      {/* WhatsApp-Style Floating Quick Reaction Bar above message */}
      {isSelectedForAction && (
        <div
          className="floating-reaction-bar"
          style={{
            position: 'absolute',
            top: '-50px',
            [isMine ? 'right' : 'left']: '0px',
            background: '#0f172a',
            border: '1.5px solid rgba(255, 255, 255, 0.22)',
            borderRadius: '30px',
            padding: '5px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            zIndex: 9999,
            boxShadow: '0 12px 36px rgba(0,0,0,0.7)',
            userSelect: 'none',
            pointerEvents: 'auto',
            maxWidth: 'calc(100vw - 20px)',
            boxSizing: 'border-box'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {quickReactions.slice(0, 7).map((em) => (
            <button
              key={em}
              type="button"
              className="reaction-emoji-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleReact(em);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '1.45rem',
                cursor: 'pointer',
                padding: '2px 4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.15s ease',
                lineHeight: 1,
                pointerEvents: 'auto',
                flexShrink: 0
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.35)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              {em}
            </button>
          ))}

          <div className="reaction-divider" style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.22)', margin: '0 2px', flexShrink: 0 }} />

          {/* Plus button for Unlimited Emojis */}
          <button
            type="button"
            className="reaction-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenUnlimitedEmoji) onOpenUnlimitedEmoji(message);
            }}
            title="More reactions (Unlimited emojis)"
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              pointerEvents: 'auto',
              flexShrink: 0
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'}
          >
            <Plus size={16} />
          </button>

          {/* Customize / Set Default Emojis Button */}
          <button
            type="button"
            className="reaction-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenCustomizeReactions) onOpenCustomizeReactions();
            }}
            title="Customize default reaction emojis"
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              pointerEvents: 'auto',
              flexShrink: 0
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#f59e0b'; e.currentTarget.style.background = 'rgba(245, 158, 11, 0.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
          >
            <SlidersHorizontal size={14} />
          </button>
        </div>
      )}

      {/* Fullscreen Image / Drawing Preview Modal */}
      {showImagePreview && message.mediaUrl && !message.isViewOnce && !message.isFogSnap && (
        <div
          onClick={() => setShowImagePreview(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.94)',
            backdropFilter: 'blur(12px)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px',
            boxSizing: 'border-box'
          }}
        >
          {/* Top Bar */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '960px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 18px',
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '0.92rem', fontWeight: 600 }}>
              <span>{message.content?.includes('drawing') ? '🎨 Whiteboard Drawing' : '🖼️ Photo Preview'}</span>
              {message.fileName && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 400 }}>({message.fileName})</span>}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {onEditDrawing && (
                <button
                  type="button"
                  onClick={() => {
                    setShowImagePreview(false);
                    onEditDrawing(message.mediaUrl, message.whiteboardData);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'var(--accent, #6366f1)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '8px 14px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
                  }}
                  title="Open and edit on Live Drawboard"
                >
                  <Edit3 size={15} />
                  <span>Edit Drawing ✏️</span>
                </button>
              )}
              <button
                type="button"
                onClick={(e) => handleDownloadMedia(
                  e,
                  message.mediaUrl,
                  message.fileName || (message.content?.includes('drawing') ? `pulsechat_drawing_${Date.now()}.png` : `pulsechat_image_${Date.now()}.jpg`)
                )}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '8px 16px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
                }}
                title="Download this image to your device"
              >
                <Download size={15} />
                <span>{downloadState === 'Saved!' ? 'Saved to Device!' : (downloadState || 'Save to Device')}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowImagePreview(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                title="Close preview"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Centered Image View */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              maxHeight: 'calc(100vh - 120px)',
              padding: '16px',
              overflow: 'hidden',
              boxSizing: 'border-box'
            }}
          >
            <img
              src={message.mediaUrl}
              alt="Fullscreen Preview"
              style={{
                maxWidth: '92vw',
                maxHeight: '82vh',
                objectFit: 'contain',
                borderRadius: '12px',
                boxShadow: '0 16px 48px rgba(0,0,0,0.7)'
              }}
            />
          </div>
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

      {showFogSnapModal && !isFogBurned && (
        <FogSnapModal
          message={message}
          chatId={chatId}
          currentUserId={currentUser?.id}
          currentUserName={currentUser?.name || currentUser?.username}
          onRevealed={() => setFogStatus('revealed')}
          onBurned={() => {
            setFogStatus('burned');
            setShowFogSnapModal(false);
          }}
          onClose={() => setShowFogSnapModal(false)}
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
