import React, { useState } from 'react';
import { X, Sparkles, ChevronRight, ChevronLeft, BarChart2, Music, EyeOff, Crown, Zap, Smile, Check, MapPin, Lightbulb, Rocket } from 'lucide-react';

const ONBOARDING_STEPS = [
  {
    step: 1,
    title: 'Welcome to PulseChat ⚡',
    subtitle: 'Next-Gen Instant Messaging & Real-Time App',
    icon: Sparkles,
    iconBg: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    iconColor: '#fff',
    location: '📱 App Home Dashboard',
    description: 'PulseChat is designed for ultra-fast 0ms messaging with end-to-end privacy, custom live wallpapers, interactive polls, background soundscapes, and VIP perks.',
    tip: 'Take this quick 30-second tour to discover all features and where to find them!'
  },
  {
    step: 2,
    title: '4-Dot Action Drawer 🎛️',
    subtitle: 'All Creation Tools in One Tap',
    icon: Zap,
    iconBg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    iconColor: '#fff',
    location: '📍 Chat Window > Tap (::) 4-Dot Button beside typing box',
    description: 'Tap the 4-Dot button to access Animated 3D Text, Stealth Dust Notes, 3D Floating Emoji Bursts, Poll Creator, Emojis & Virtual Gifts.',
    tip: 'Clicking 3D Text or Dust text lets you send instant self-destructing or animated messages!'
  },
  {
    step: 3,
    title: 'Interactive Polls & Quiz Cards 📊',
    subtitle: 'Polls & Animated Card Auras',
    icon: BarChart2,
    iconBg: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
    iconColor: '#fff',
    location: '📍 Chat Window > 4-Dot Drawer > Create Poll',
    description: 'Create opinion polls or secret quiz questions with correct answer reveal! Select from 6 Color Themes and 5 Animated Card Auras (Gold Stardust, Cyber Matrix, Inferno Blaze).',
    tip: 'Quiz questions hide the correct answer until users vote in the chat!'
  },
  {
    step: 4,
    title: 'Aura Soundscapes & Live Wallpapers 🎵',
    subtitle: 'Lofi Beats & 4K Dynamic Backgrounds',
    icon: Music,
    iconBg: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
    iconColor: '#fff',
    location: '📍 Active Chat > Top 3-Dot Menu (⋮) > Themes & Music',
    description: 'Play relaxing Lofi Beats, Cyberpunk Rain or Space Nebula music in the background while chatting! Choose Matrix Rain, Starry Galaxy, Fireflies or custom image wallpapers.',
    tip: 'You can adjust background music volume anytime using the music widget header.'
  },
  {
    step: 5,
    title: 'Pulse 24h Vibe Stories ⚡',
    subtitle: 'Share 24h Stories with Music & 3D Text',
    icon: Sparkles,
    iconBg: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
    iconColor: '#fff',
    location: '📍 Sidebar Top Tray > Pulse Vibes ⚡ (24h Stories)',
    description: 'Post 24h Vibe stories with Lofi Beats, Cyberpunk Rain or Space Nebula soundtracks! Custom 3D Animated typography text, Live Matrix/Galaxy canvas wallpapers & Sparks tipping.',
    tip: 'Viewed stories automatically change to subtle gray rings just like IG & WhatsApp!'
  },
  {
    step: 6,
    title: 'Pulse Zone Mini-Games & Leaderboard 🎮',
    subtitle: 'Hot Arrow Puzzle & Speed Tapper',
    icon: Rocket,
    iconBg: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
    iconColor: '#fff',
    location: '📍 Sidebar Header > Game Controller Icon (Pulse Zone)',
    description: 'Play hot Arrow Puzzle & Speed Tapper games 100% offline! Win Sparks rewards and climb the real-time community leaderboard.',
    tip: 'Game scores update in 0ms using local storage sync!'
  },
  {
    step: 7,
    title: 'Ghost Mode & Privacy 👻',
    subtitle: 'Maximum Privacy Controls',
    icon: EyeOff,
    iconBg: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
    iconColor: '#fff',
    location: '📍 Settings Modal & 4-Dot Action Drawer',
    description: 'Enable Incognito Ghost Mode to hide online presence and read receipts (blue ticks) independently. Send Stealth Dust Notes that shatter into digital dust upon touch!',
    tip: 'Ghost mode gives you complete stealth while reading messages.'
  },
  {
    step: 8,
    title: 'Pulse VIP Pro Perks 👑',
    subtitle: 'Unlock 500MB Uploads & Pro Features',
    icon: Crown,
    iconBg: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
    iconColor: '#fff',
    location: '📍 Top Bar / Settings > VIP Pro Badge',
    description: 'Get 500 MB file upload limit, Golden VIP Crest, 3D text effects, Live story wallpapers, Pro poll auras & 100% ad-free experience. Monthly VIP is 100% FREE!',
    tip: 'Tap the Crown badge anytime in header to manage your VIP perks.'
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
