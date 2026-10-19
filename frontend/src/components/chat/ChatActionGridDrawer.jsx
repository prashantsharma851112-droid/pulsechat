import React from 'react';
import { Paperclip, Crown, Zap, CloudRain, BarChart2, Clock, Globe } from 'lucide-react';

/**
 * ChatActionGridDrawer - Isolated 0ms 4-Dot Quick Action Drawer
 * Isolates the 9 action grid items to prevent re-renders of the main message stream.
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
      {/* 1. Media & Files */}
      <button
        type="button"
        onClick={() => {
          onClose();
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
          transition: 'transform 0.15s ease'
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
          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.35)'
        }}>
          <Paperclip size={20} />
        </div>
        <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-main)' }}>Files & Media</span>
      </button>

      {/* 2. 3D Typography (VIP Pro) */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onOpen3DText();
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
          transition: 'transform 0.15s ease'
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
          boxShadow: '0 4px 14px rgba(6, 182, 212, 0.4)'
        }}>
          3D
        </div>
        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '3px' }}>
          <span>3D Text</span>
          <Crown size={12} color="#06b6d4" />
        </span>
      </button>

      {/* 3. Virtual Gift */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onOpenGiftPicker();
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
          transition: 'transform 0.15s ease'
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
          fontSize: '1.25rem'
        }}>
          🎁
        </div>
        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#ec4899' }}>
          Send Gift
        </span>
      </button>

      {/* 4. Stealth Dust Note (Touch to Reveal Self-Destruct) */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onSendStealthDust();
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
          transition: 'transform 0.15s ease'
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
          boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)'
        }}>
          <Zap size={20} />
        </div>
        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '3px' }}>
          <span>Dust text</span>
          <Crown size={12} color="#f59e0b" />
        </span>
      </button>

      {/* 5. Smooth Scratch Dust Image */}
      <button
        type="button"
        onClick={() => {
          onClose();
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
          transition: 'transform 0.15s ease'
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
          fontSize: '1.25rem'
        }}>
          🌫️
        </div>
        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '3px' }}>
          <span>Dust Image</span>
        </span>
      </button>

      {/* 6. Emoji Rain */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onOpenEmojiBurst();
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
          transition: 'transform 0.15s ease'
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
          boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)'
        }}>
          <CloudRain size={20} />
        </div>
        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '3px' }}>
          <span>Emoji Rain</span>
          <Crown size={12} color="#38bdf8" />
        </span>
      </button>

      {/* 7. Create Poll */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onOpenCreatePoll();
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
          transition: 'transform 0.15s ease'
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
          boxShadow: '0 4px 12px rgba(139, 92, 246, 0.35)'
        }}>
          <BarChart2 size={20} />
        </div>
        <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-main)' }}>Create Poll</span>
      </button>

      {/* 8. Schedule Message (Send Later / Birthday Wish) */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onOpenScheduleModal();
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
          transition: 'transform 0.15s ease'
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
          boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)'
        }}>
          <Clock size={20} />
        </div>
        <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#f59e0b' }}>Schedule ⏰</span>
      </button>

      {/* 9. Live Translation 🌐 */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onToggleTranslateBar();
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
          transition: 'transform 0.15s ease'
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
          position: 'relative'
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
    </div>
  );
}));

export default ChatActionGridDrawer;
