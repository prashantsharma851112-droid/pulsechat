import React from 'react';
import { Paperclip, Crown, Zap, CloudRain, BarChart2, Clock, Globe } from 'lucide-react';

/**
 * 1. Atomic Button: Media & Files Action
 */
export const ChatMediaActionButton = React.memo(function ChatMediaActionButton({ onClose, fileInputRef }) {
  return (
    <button
      type="button"
      onClick={() => {
        onClose?.();
        fileInputRef?.current?.click();
      }}
      className="action-grid-item"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '8px 4px',
        borderRadius: '12px',
        willChange: 'transform',
        transform: 'translateZ(0)',
        transition: 'transform 0.08s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div style={{
        width: '46px',
        height: '46px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.35)',
        willChange: 'transform',
        transform: 'translateZ(0)'
      }}>
        <Paperclip size={20} />
      </div>
      <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-main)' }}>Files & Media</span>
    </button>
  );
});

/**
 * 2. Atomic Button: 3D Typography (VIP Pro)
 */
export const Chat3DTextActionButton = React.memo(function Chat3DTextActionButton({ onClose, onOpen3DText }) {
  return (
    <button
      type="button"
      onClick={() => {
        onClose?.();
        onOpen3DText?.();
      }}
      className="action-grid-item"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '8px 4px',
        borderRadius: '12px',
        willChange: 'transform',
        transform: 'translateZ(0)',
        transition: 'transform 0.08s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div style={{
        width: '46px',
        height: '46px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, #06b6d4, #a855f7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 900,
        fontSize: '0.92rem',
        boxShadow: '0 4px 14px rgba(6, 182, 212, 0.4)',
        willChange: 'transform',
        transform: 'translateZ(0)'
      }}>
        3D
      </div>
      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '3px' }}>
        <span>3D Text</span>
        <Crown size={12} color="#06b6d4" />
      </span>
    </button>
  );
});

/**
 * 3. Atomic Button: Virtual Gift
 */
export const ChatGiftActionButton = React.memo(function ChatGiftActionButton({ onClose, onOpenGiftPicker }) {
  return (
    <button
      type="button"
      onClick={() => {
        onClose?.();
        onOpenGiftPicker?.();
      }}
      className="action-grid-item"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '8px 4px',
        borderRadius: '12px',
        willChange: 'transform',
        transform: 'translateZ(0)',
        transition: 'transform 0.08s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div style={{
        width: '46px',
        height: '46px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, #ec4899, #f43f5e)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        boxShadow: '0 4px 12px rgba(236, 72, 153, 0.35)',
        fontSize: '1.25rem',
        willChange: 'transform',
        transform: 'translateZ(0)'
      }}>
        🎁
      </div>
      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#ec4899' }}>
        Send Gift
      </span>
    </button>
  );
});

/**
 * 4. Atomic Button: Stealth Dust Note
 */
export const ChatDustNoteActionButton = React.memo(function ChatDustNoteActionButton({ onClose, onSendStealthDust }) {
  return (
    <button
      type="button"
      onClick={() => {
        onClose?.();
        onSendStealthDust?.();
      }}
      className="action-grid-item"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '8px 4px',
        borderRadius: '12px',
        willChange: 'transform',
        transform: 'translateZ(0)',
        transition: 'transform 0.08s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div style={{
        width: '46px',
        height: '46px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
        willChange: 'transform',
        transform: 'translateZ(0)'
      }}>
        <Zap size={20} />
      </div>
      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '3px' }}>
        <span>Dust text</span>
        <Crown size={12} color="#f59e0b" />
      </span>
    </button>
  );
});

/**
 * 5. Atomic Button: Smooth Scratch Dust Image
 */
export const ChatDustImageActionButton = React.memo(function ChatDustImageActionButton({ onClose, dustImageInputRef }) {
  return (
    <button
      type="button"
      onClick={() => {
        onClose?.();
        dustImageInputRef?.current?.click();
      }}
      className="action-grid-item"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '8px 4px',
        borderRadius: '12px',
        willChange: 'transform',
        transform: 'translateZ(0)',
        transition: 'transform 0.08s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div style={{
        width: '46px',
        height: '46px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
        fontSize: '1.25rem',
        willChange: 'transform',
        transform: 'translateZ(0)'
      }}>
        🌫️
      </div>
      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '3px' }}>
        <span>Dust Image</span>
      </span>
    </button>
  );
});

/**
 * 6. Atomic Button: Emoji Particle Rain
 */
export const ChatEmojiRainActionButton = React.memo(function ChatEmojiRainActionButton({ onClose, onOpenEmojiBurst }) {
  return (
    <button
      type="button"
      onClick={() => {
        onClose?.();
        onOpenEmojiBurst?.();
      }}
      className="action-grid-item"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '8px 4px',
        borderRadius: '12px',
        willChange: 'transform',
        transform: 'translateZ(0)',
        transition: 'transform 0.08s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div style={{
        width: '46px',
        height: '46px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, #0284c7, #0369a1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)',
        willChange: 'transform',
        transform: 'translateZ(0)'
      }}>
        <CloudRain size={20} />
      </div>
      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '3px' }}>
        <span>Emoji Rain</span>
        <Crown size={12} color="#38bdf8" />
      </span>
    </button>
  );
});

/**
 * 7. Atomic Button: Create Poll
 */
export const ChatPollActionButton = React.memo(function ChatPollActionButton({ onClose, onOpenCreatePoll }) {
  return (
    <button
      type="button"
      onClick={() => {
        onClose?.();
        onOpenCreatePoll?.();
      }}
      className="action-grid-item"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '8px 4px',
        borderRadius: '12px',
        willChange: 'transform',
        transform: 'translateZ(0)',
        transition: 'transform 0.08s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div style={{
        width: '46px',
        height: '46px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        boxShadow: '0 4px 12px rgba(139, 92, 246, 0.35)',
        willChange: 'transform',
        transform: 'translateZ(0)'
      }}>
        <BarChart2 size={20} />
      </div>
      <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-main)' }}>Create Poll</span>
    </button>
  );
});

/**
 * 8. Atomic Button: Schedule Message
 */
export const ChatScheduleActionButton = React.memo(function ChatScheduleActionButton({ onClose, onOpenScheduleModal }) {
  return (
    <button
      type="button"
      onClick={() => {
        onClose?.();
        onOpenScheduleModal?.();
      }}
      className="action-grid-item"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '8px 4px',
        borderRadius: '12px',
        willChange: 'transform',
        transform: 'translateZ(0)',
        transition: 'transform 0.08s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div style={{
        width: '46px',
        height: '46px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
        willChange: 'transform',
        transform: 'translateZ(0)'
      }}>
        <Clock size={20} />
      </div>
      <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#f59e0b' }}>Schedule ⏰</span>
    </button>
  );
});

/**
 * 9. Atomic Button: Live Translation Toggle
 */
export const ChatTranslateActionButton = React.memo(function ChatTranslateActionButton({
  onClose,
  onToggleTranslateBar,
  isAutoTranslateActive
}) {
  return (
    <button
      type="button"
      onClick={() => {
        onClose?.();
        onToggleTranslateBar?.();
      }}
      className="action-grid-item"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '8px 4px',
        borderRadius: '12px',
        willChange: 'transform',
        transform: 'translateZ(0)',
        transition: 'transform 0.08s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div style={{
        width: '46px',
        height: '46px',
        borderRadius: '14px',
        background: isAutoTranslateActive
          ? 'linear-gradient(135deg, #06b6d4, #3b82f6)'
          : 'linear-gradient(135deg, #0ea5e9, #0284c7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        boxShadow: '0 4px 12px rgba(14, 165, 233, 0.4)',
        position: 'relative',
        willChange: 'transform',
        transform: 'translateZ(0)'
      }}>
        <Globe size={20} />
        {isAutoTranslateActive && (
          <span style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#22c55e',
            boxShadow: '0 0 6px #22c55e'
          }} />
        )}
      </div>
      <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#0ea5e9' }}>
        Translate 🌐
      </span>
    </button>
  );
});

/**
 * ChatActionGridDrawer - Isolated Container composed of Atomic Memoized Buttons
 */
const ChatActionGridDrawer = React.memo(React.forwardRef(function ChatActionGridDrawer({
  isOpen,
  onClose,
  fileInputRef,
  dustImageInputRef,
  onOpen3DText,
  onOpenGiftPicker,
  onSendStealthDust,
  onOpenEmojiBurst,
  onOpenCreatePoll,
  onOpenScheduleModal,
  onToggleTranslateBar,
  isAutoTranslateActive
}, ref) {
  if (!isOpen) return null;

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 10px)',
        left: '12px',
        background: 'color-mix(in srgb, var(--accent) 26%, transparent)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1.5px solid var(--accent)',
        borderRadius: '20px',
        padding: '14px',
        boxShadow: '0 0 22px color-mix(in srgb, var(--accent) 55%, transparent), 0 4px 14px rgba(0,0,0,0.3)',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        zIndex: 1100,
        width: 'min(330px, 92vw)',
        maxHeight: 'min(440px, 80vh)',
        overflowY: 'auto',
        animation: 'pulseModalPop 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <ChatMediaActionButton onClose={onClose} fileInputRef={fileInputRef} />
      <Chat3DTextActionButton onClose={onClose} onOpen3DText={onOpen3DText} />
      <ChatGiftActionButton onClose={onClose} onOpenGiftPicker={onOpenGiftPicker} />
      <ChatDustNoteActionButton onClose={onClose} onSendStealthDust={onSendStealthDust} />
      <ChatDustImageActionButton onClose={onClose} dustImageInputRef={dustImageInputRef} />
      <ChatEmojiRainActionButton onClose={onClose} onOpenEmojiBurst={onOpenEmojiBurst} />
      <ChatPollActionButton onClose={onClose} onOpenCreatePoll={onOpenCreatePoll} />
      <ChatScheduleActionButton onClose={onClose} onOpenScheduleModal={onOpenScheduleModal} />
      <ChatTranslateActionButton
        onClose={onClose}
        onToggleTranslateBar={onToggleTranslateBar}
        isAutoTranslateActive={isAutoTranslateActive}
      />
    </div>
  );
}));

export default ChatActionGridDrawer;
