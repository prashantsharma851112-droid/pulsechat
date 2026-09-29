import React, { useState } from 'react';
import { X, Sparkles, ChevronRight, ChevronLeft, BarChart2, Music, EyeOff, Crown, Zap, Smile, Check, MapPin, Lightbulb, Rocket } from 'lucide-react';

const ONBOARDING_STEPS = [
  {
    step: 1,
    title: 'Welcome to PulseChat ⚡',
    subtitle: 'Fast, Fun & Private Messaging',
    icon: Sparkles,
    iconBg: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    iconColor: '#fff',
    location: '📱 Main Dashboard',
    description: 'Connect instantly with friends, customize your chat space, listen to background music, share 24h vibe stories, and play mini-games.',
    tip: 'Take this quick tour to learn where to find all your favorite features!'
  },
  {
    step: 2,
    title: '4-Dot Creative Drawer 🎛️',
    subtitle: 'All Creation Tools in One Tap',
    icon: Zap,
    iconBg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    iconColor: '#fff',
    location: '📍 Inside Chat > Tap the 4-Dot (::) Button',
    description: 'Open the 4-Dot drawer right next to the typing bar to send 3D animated text, self-destructing Dust Notes, custom polls, emojis, and virtual gifts.',
    tip: 'Want to send a self-destructing message? Send a Dust Note—it disappears when touched!'
  },
  {
    step: 3,
    title: 'Polls & Trivia Quizzes 📊',
    subtitle: 'Engage Your Friends',
    icon: BarChart2,
    iconBg: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
    iconColor: '#fff',
    location: '📍 Chat > 4-Dot Drawer > Create Poll',
    description: 'Ask questions, host group votes, or create fun trivia quizzes. Choose from vibrant card themes and glowing aura effects.',
    tip: 'Quiz mode keeps the correct answer secret until your friends place their vote!'
  },
  {
    step: 4,
    title: 'Background Soundtracks & Wallpapers 🎵',
    subtitle: 'Set the Vibe While You Chat',
    icon: Music,
    iconBg: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
    iconColor: '#fff',
    location: '📍 Active Chat > Top Menu (⋮) > Themes & Music',
    description: 'Play relaxing Lofi beats, Cyberpunk rain, or ambient soundscapes while messaging. Pick dynamic wallpapers like Galaxy, Matrix Rain, or custom photos.',
    tip: 'Easily adjust background music volume from the top bar controls.'
  },
  {
    step: 5,
    title: '24h Vibe Stories ⚡',
    subtitle: 'Share Moments with Songs & 3D Text',
    icon: Sparkles,
    iconBg: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
    iconColor: '#fff',
    location: '📍 Top Tray > Pulse Vibes ⚡',
    description: 'Post 24-hour stories paired with top trending songs, 3D text styling, dynamic backdrops, and interactive Sparks tipping.',
    tip: 'Search millions of global music tracks to add the perfect soundtrack to your Vibe!'
  },
  {
    step: 6,
    title: 'Pulse Zone Games & Leaderboard 🎮',
    subtitle: 'Play Mini-Games & Earn Crowns',
    icon: Rocket,
    iconBg: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
    iconColor: '#fff',
    location: '📍 Sidebar Header > Controller Icon',
    description: 'Play addicting games like Arrow Puzzle and Speed Tapper. Rank at the top of the community leaderboard to earn real crowns on your profile!',
    tip: 'Reaching #1 on the leaderboard unlocks the Golden Crown badge across all your chats!'
  },
  {
    step: 7,
    title: 'Ghost Mode & Privacy Controls 👻',
    subtitle: 'Chat on Your Own Terms',
    icon: EyeOff,
    iconBg: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
    iconColor: '#fff',
    location: '📍 Settings & 4-Dot Drawer',
    description: 'Turn on Ghost Mode to hide your online status and blue read receipts whenever you want total privacy.',
    tip: 'Read incoming messages completely stealthily without triggering read receipts.'
  },
  {
    step: 8,
    title: 'Pulse VIP Perks 👑',
    subtitle: 'Unlock Exclusive Privileges',
    icon: Crown,
    iconBg: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
    iconColor: '#fff',
    location: '📍 Header / Settings > Crown Badge',
    description: 'Enjoy 500 MB file attachments, a Golden VIP profile badge, custom 3D typography, premium wallpapers, and zero ads.',
    tip: 'Tap your Crown badge anytime to manage your VIP perks!'
  }
];

export default function AppOnboardingModal({ onClose, userId }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep = ONBOARDING_STEPS[currentStepIndex];
  const totalSteps = ONBOARDING_STEPS.length;
  const isLastStep = currentStepIndex === totalSteps - 1;

  const handleFinish = () => {
    if (typeof window !== 'undefined') {
      const storageKey = userId ? `pulsechat_onboarding_${userId}` : 'pulsechat_onboarding_completed';
      localStorage.setItem(storageKey, 'true');
      localStorage.setItem('pulsechat_onboarding_completed', 'true');
    }
    onClose();
  };

  const handleNext = () => {
    if (isLastStep) {
      handleFinish();
    } else {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const CurrentIcon = currentStep.icon;

  return (
    <div className="modal-overlay" onClick={handleFinish} style={{ zIndex: 1400 }}>
      <div
        className="modal-card modal-responsive modal-card-animated"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '480px',
          width: '100%',
          maxHeight: '90dvh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '24px',
          background: 'var(--bg-card)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6), 0 0 30px rgba(99, 102, 241, 0.2)'
        }}
      >
        {/* Top Header */}
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.8), rgba(49, 16, 66, 0.8))',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '0.73rem',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              color: '#fff',
              padding: '3px 10px',
              borderRadius: '12px'
            }}>
              Step {currentStep.step} of {totalSteps}
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>App Feature Tour</span>
          </div>

          <button
            onClick={handleFinish}
            className="icon-btn-ghost"
            title="Close / Skip Tour"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body - Current Step Card */}
        <div style={{
          padding: '24px 20px',
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '16px'
        }}>
          {/* Big Visual Icon Ring */}
          <div style={{
            position: 'relative',
            width: '76px',
            height: '76px',
            borderRadius: '24px',
            background: currentStep.iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)',
            marginTop: '8px'
          }}>
            <CurrentIcon size={38} color={currentStep.iconColor} />
          </div>

          {/* Titles */}
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {currentStep.title}
            </h3>
            <span style={{ fontSize: '0.82rem', color: '#a855f7', fontWeight: 600 }}>
              {currentStep.subtitle}
            </span>
          </div>

          {/* Feature Location Pill Badge */}
          <div style={{
            background: 'rgba(99, 102, 241, 0.12)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: '12px',
            padding: '6px 14px',
            fontSize: '0.78rem',
            color: '#a5b4fc',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <MapPin size={14} color="#6366f1" />
            <span>{currentStep.location}</span>
          </div>

          {/* Feature Description */}
          <p style={{
            margin: 0,
            fontSize: '0.88rem',
            color: 'var(--text-main)',
            lineHeight: 1.5,
            opacity: 0.9,
            maxWidth: '380px'
          }}>
            {currentStep.description}
          </p>

          {/* Pro Tip Card */}
          <div style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px dashed rgba(245, 158, 11, 0.3)',
            borderRadius: '14px',
            padding: '10px 14px',
            fontSize: '0.78rem',
            color: '#fbbf24',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            textAlign: 'left',
            width: '100%'
          }}>
            <Lightbulb size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span><strong>Quick Tip:</strong> {currentStep.tip}</span>
          </div>
        </div>

        {/* Step Indicator Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', padding: '8px 0' }}>
          {ONBOARDING_STEPS.map((s, idx) => (
            <button
              key={s.step}
              onClick={() => setCurrentStepIndex(idx)}
              style={{
                width: idx === currentStepIndex ? '20px' : '8px',
                height: '8px',
                borderRadius: '4px',
                background: idx === currentStepIndex ? '#6366f1' : 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              title={`Go to step ${s.step}`}
            />
          ))}
        </div>

        {/* Bottom Actions Bar */}
        <div style={{
          padding: '14px 20px 20px 20px',
          background: 'rgba(0,0,0,0.2)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          flexShrink: 0
        }}>
          {/* Skip Button */}
          <button
            type="button"
            onClick={handleFinish}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: '10px'
            }}
          >
            Skip Tour
          </button>

          {/* Navigation Buttons (Back & Next) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {currentStepIndex > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="btn-secondary"
                style={{
                  padding: '8px 14px',
                  borderRadius: '12px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <ChevronLeft size={16} /> Back
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="btn-primary"
              style={{
                padding: '9px 18px',
                borderRadius: '12px',
                fontSize: '0.86rem',
                fontWeight: 700,
                background: isLastStep
                  ? 'linear-gradient(90deg, #10b981 0%, #6366f1 100%)'
                  : 'linear-gradient(90deg, #6366f1 0%, #a855f7 100%)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
              }}
            >
              {isLastStep ? (
                <>
                  <Rocket size={16} /> Start Chatting!
                </>
              ) : (
                <>
                  Next <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
