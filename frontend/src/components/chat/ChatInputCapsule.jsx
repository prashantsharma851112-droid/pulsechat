import React, { useState, useEffect, useRef, useImperativeHandle } from 'react';
import { Smile, Globe, Mic, Send } from 'lucide-react';
import { executeTranslation } from '../../utils/translator';

/**
 * Ultra-optimized, zero-latency Chat Input Capsule (Standalone Component)
 * Isolates keystroke state to eliminate ChatWindow re-renders and input lag completely.
 * As used by WhatsApp & Instagram architecture: Keystrokes NEVER re-render message stream or modals.
 */
const ChatInputCapsule = React.memo(React.forwardRef(function ChatInputCapsule({
  chatId,
  isGroup,
  user,
  activeChat,
  socket,
  token,
  targetLang,
  replyInputRef,
  onSendText,
  onOpenScheduleModal,
  showEmoji,
  setShowEmoji,
  setShowActionGrid,
  setShowRecorder,
  setActionToast
}, ref) {
  const [text, setText] = useState(() => {
    try {
      return (chatId ? localStorage.getItem(`pulsechat_draft_${chatId}`) : '') || '';
    } catch {
      return '';
    }
  });

  const [isTranslatingDraft, setIsTranslatingDraft] = useState(false);
  const draftSaveTimeoutRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingEmitRef = useRef(0);
  const sendBtnHoldTimerRef = useRef(null);

  // Synchronize draft on chatId change
  useEffect(() => {
    if (!chatId) return;
    try {
      const savedDraft = localStorage.getItem(`pulsechat_draft_${chatId}`) || '';
      setText(savedDraft);
    } catch {}
  }, [chatId]);

  useImperativeHandle(ref, () => ({
    setText: (newText) => {
      setText(newText);
    },
    getText: () => text,
    insertEmoji: (emoji) => {
      setText(prev => (prev || '') + emoji);
    },
    clear: () => {
      setText('');
      try {
        if (chatId) localStorage.removeItem(`pulsechat_draft_${chatId}`);
      } catch {}
    }
  }), [text, chatId]);

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);

    if (draftSaveTimeoutRef.current) clearTimeout(draftSaveTimeoutRef.current);
    draftSaveTimeoutRef.current = setTimeout(() => {
      try {
        if (chatId) {
          if (val) {
            localStorage.setItem(`pulsechat_draft_${chatId}`, val);
          } else {
            localStorage.removeItem(`pulsechat_draft_${chatId}`);
          }
        }
      } catch {}
    }, 300);

    if (!socket) return;
    const receiverId = isGroup ? '' : activeChat?.id;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (!val.trim()) {
      socket.emit('typing_stop', { chatId, userId: user?.id, receiverId });
      lastTypingEmitRef.current = 0;
      return;
    }

    const now = Date.now();
    if (now - lastTypingEmitRef.current > 2000) {
      lastTypingEmitRef.current = now;
      socket.emit('typing_start', {
        chatId,
        userId: user?.id,
        username: user?.displayName || user?.username || 'User',
        receiverId
      });
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing_stop', { chatId, userId: user?.id, receiverId });
      lastTypingEmitRef.current = 0;
    }, 2500);
  };

  const handleTranslateDraft = async () => {
    if (!text || !text.trim() || isTranslatingDraft) return;
    setIsTranslatingDraft(true);
    try {
      const result = await executeTranslation(text.trim(), targetLang, token);
      if (result && result.translatedText) {
        setText(result.translatedText);
        if (setActionToast) {
          setActionToast(`Draft translated to ${targetLang.toUpperCase()} ✨`);
          setTimeout(() => setActionToast(''), 2500);
        }
      }
    } catch (err) {
      console.error('Draft translation error:', err);
    } finally {
      setIsTranslatingDraft(false);
    }
  };

  const handleSendBtnMouseDown = () => {
    sendBtnHoldTimerRef.current = setTimeout(() => {
      if (onOpenScheduleModal) {
        onOpenScheduleModal(text);
      }
    }, 520);
  };

  const handleSendBtnMouseUp = () => {
    if (sendBtnHoldTimerRef.current) {
      clearTimeout(sendBtnHoldTimerRef.current);
      sendBtnHoldTimerRef.current = null;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (sendBtnHoldTimerRef.current) {
      clearTimeout(sendBtnHoldTimerRef.current);
      sendBtnHoldTimerRef.current = null;
    }
    const trimmed = text.trim();
    if (!trimmed) return;

    onSendText(text);
    setText('');

    if (draftSaveTimeoutRef.current) clearTimeout(draftSaveTimeoutRef.current);
    lastTypingEmitRef.current = 0;
    try {
      if (chatId) localStorage.removeItem(`pulsechat_draft_${chatId}`);
    } catch {}

    if (replyInputRef?.current) {
      replyInputRef.current.focus({ preventScroll: true });
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ flex: 1, minWidth: 0, display: 'flex', gap: '6px', alignItems: 'center' }}>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          background: 'var(--bg-card, #202c33)',
          borderRadius: '26px',
          padding: '4px 8px 4px 10px',
          border: '1px solid var(--border)',
          minHeight: '44px',
          gap: '4px',
          boxSizing: 'border-box'
        }}
      >
        <button
          type="button"
          onClick={() => {
            setShowEmoji(prev => !prev);
            setShowActionGrid(false);
          }}
          className="icon-btn-ghost interactive-action"
          title="Emoji Picker"
          style={{
            background: 'transparent',
            border: 'none',
            color: showEmoji ? '#f59e0b' : 'var(--text-muted, #8696a0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px',
            borderRadius: '50%',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.15s ease'
          }}
        >
          <Smile size={22} />
        </button>

        <input
          type="text"
          value={text}
          onChange={handleTextChange}
          placeholder={isGroup ? 'Message group...' : 'Type a message'}
          ref={replyInputRef}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-main, #ffffff)',
            fontSize: '0.94rem',
            padding: '6px 4px'
          }}
        />

        {text.trim().length > 0 && (
          <button
            type="button"
            onClick={handleTranslateDraft}
            disabled={isTranslatingDraft}
            title={`Translate draft to ${targetLang.toUpperCase()} before sending`}
            style={{
              background: 'rgba(6, 182, 212, 0.16)',
              border: '1px solid rgba(6, 182, 212, 0.45)',
              color: '#06b6d4',
              borderRadius: '16px',
              padding: '4px 6px',
              fontSize: '0.7rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              cursor: isTranslatingDraft ? 'wait' : 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease'
            }}
          >
            <Globe size={11} />
            <span>{isTranslatingDraft ? '...' : `➔ ${targetLang.toUpperCase()}`}</span>
          </button>
        )}
      </div>

      {text.trim().length === 0 ? (
        <button
          type="button"
          onClick={() => {
            setShowActionGrid(false);
            setShowEmoji(false);
            setShowRecorder(true);
          }}
          className="interactive-action"
          title="Record Voice Note"
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: 'var(--bg-card, #202c33)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted, #8696a0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <Mic size={20} />
        </button>
      ) : (
        <button
          type="submit"
          tabIndex={-1}
          className="interactive-action"
          title="Send Message (Hold to Schedule ⏰)"
          onMouseDown={(e) => {
            e.preventDefault();
            handleSendBtnMouseDown(e);
          }}
          onMouseUp={handleSendBtnMouseUp}
          onTouchStart={handleSendBtnMouseDown}
          onTouchEnd={() => {
            handleSendBtnMouseUp();
            replyInputRef?.current?.focus({ preventScroll: true });
          }}
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: '#25d366',
            border: 'none',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(37, 211, 102, 0.45)',
            transition: 'transform 0.15s ease, background 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <Send size={18} style={{ marginLeft: '2px' }} />
        </button>
      )}
    </form>
  );
}));

export default ChatInputCapsule;
