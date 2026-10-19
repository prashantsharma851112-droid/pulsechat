import React, { useMemo, useRef, useEffect } from 'react';
import { calculateConversationMoodTimeline } from '../../utils/sentiment';

/**
 * ChatMoodTimeline - Isolated 0ms Latency Mood Indicator Component
 * Isolates sentiment calculation and horizontal scroll updates from ChatWindow.
 */
const ChatMoodTimeline = React.memo(function ChatMoodTimeline({
  messages,
  cooldownMsg,
  isBlockedByMe,
  isBlockedByThem,
  chatId
}) {
  const moodTimeline = useMemo(() => {
    return calculateConversationMoodTimeline(messages, cooldownMsg);
  }, [messages, cooldownMsg]);

  const moodInfo = moodTimeline.currentMood;
  const moodSteps = moodTimeline.timelineSteps;

  const moodTimelineRef = useRef(null);
  useEffect(() => {
    if (moodTimelineRef.current) {
      moodTimelineRef.current.scrollLeft = moodTimelineRef.current.scrollWidth;
    }
  }, [chatId, moodSteps]);

  if (isBlockedByMe || isBlockedByThem) {
    return null;
  }

  return (
    <div
      ref={moodTimelineRef}
      style={{
        padding: '2px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: 'transparent',
        position: 'relative',
        zIndex: 1,
        overflowX: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        lineHeight: 1
      }}
    >
      {/* Left Pencil Line */}
      <div style={{
        width: '20px',
        flexShrink: 0,
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.45))'
      }} />

      {/* Micro Mood Pill */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '12px',
          border: '1px solid rgba(168, 85, 247, 0.35)',
          background: 'rgba(168, 85, 247, 0.08)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          whiteSpace: 'nowrap',
          flexShrink: 0
        }}
        title="Conversation Mood Sentiment"
      >
        <span style={{ fontSize: '0.74rem', lineHeight: 1 }}>{moodInfo?.emoji || '💬'}</span>
        <span style={{
          color: '#c084fc',
          fontWeight: 700,
          fontSize: '0.67rem',
          letterSpacing: '0.01em'
        }}>
          Mood: {moodInfo?.mood || 'Casual'}
        </span>

        {moodSteps && moodSteps.length > 0 && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '3px' }}>
            <span style={{ color: 'var(--text-muted)', opacity: 0.35, fontSize: '0.55rem' }}>|</span>
            {moodSteps.map((step, idx) => (
              <React.Fragment key={step.id || idx}>
                <span
                  style={{
                    color: step.color,
                    fontWeight: 600,
                    fontSize: '0.62rem',
                    background: step.bg,
                    padding: '1px 5px',
                    borderRadius: '6px',
                    border: `0.5px solid ${step.border}`,
                    whiteSpace: 'nowrap',
                    opacity: step.isPending ? 0.6 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                  title={step.preview}
                >
                  <span>{step.emoji}</span>
                  <span>{step.mood}</span>
                </span>
                {idx < moodSteps.length - 1 && (
                  <span style={{ color: 'var(--text-muted)', opacity: 0.35, fontSize: '0.55rem' }}>→</span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Right Pencil Line stretching across */}
      <div style={{
        flex: 1,
        height: '1px',
        background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.45), transparent)'
      }} />
    </div>
  );
});

export default ChatMoodTimeline;
