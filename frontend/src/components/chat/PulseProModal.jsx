import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { X, Sparkles, Check, Crown, Zap, ShieldCheck, Flame, Coffee, Heart, Rocket, Diamond, Award, ArrowRight, Loader2, Clock, Music, EyeOff, Palette, BarChart2, Type, Gamepad2 } from 'lucide-react';
import PulseVipBadge from '../common/PulseVipBadge';
import UpiCheckoutModal from './UpiCheckoutModal';
import { BACKEND_URL } from '../../utils/config';

export default function PulseProModal({ onClose, initialTab = 'pro' }) {
  const { user, token, updateUserProfile } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState(initialTab === 'coins' ? 'sparks' : initialTab); // 'pro' | 'sparks'
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'yearly'
  const [selectedSparksPack, setSelectedSparksPack] = useState('sparks_300');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [razorpayConfig, setRazorpayConfig] = useState({ keyId: '', isLive: false });
  const [upiCheckoutPlan, setUpiCheckoutPlan] = useState(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab === 'coins' ? 'sparks' : initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    // Fetch Razorpay config
    fetch(`${BACKEND_URL}/api/payments/config`)
      .then(res => res.json())
      .then(data => {
        if (data) {
          setRazorpayConfig({
            keyId: data.razorpayKeyId,
            isLive: data.isLiveConfigured
          });
        }
      })
      .catch(() => {});
  }, []);

  // Helper to dynamically load Razorpay script
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const now = new Date();
  const isUserPro = Boolean(user?.isPro && user?.proExpiresAt && new Date(user.proExpiresAt) > now);
  const activeTier = isUserPro ? user?.proTier : null;
  const expiryDateFormatted = user?.proExpiresAt
    ? new Date(user.proExpiresAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    : null;

  // 24-hour single-claim cooldown calculation per sparks bundle
  const getPackCooldownInfo = (packId) => {
    const lastClaimed = user?.claimedFreeSparks?.[packId];
    if (!lastClaimed) return null;
    const lastTime = new Date(lastClaimed).getTime();
    if (isNaN(lastTime)) return null;
    const diffMs = Date.now() - lastTime;
    const cooldownMs = 24 * 60 * 60 * 1000;
    if (diffMs >= cooldownMs) return null; // 24 hours passed, reset!
    const remMs = cooldownMs - diffMs;
    const remHours = Math.floor(remMs / (1000 * 60 * 60));
    const remMins = Math.floor((remMs % (1000 * 60 * 60)) / (1000 * 60));
    return {
      isCoolingDown: true,
      remHours,
      remMins,
      text: `${remHours}h ${remMins}m`
    };
  };

  const initiateRazorpay = async (planId) => {
    setLoading(true);
    setStatusMsg({ type: '', text: '' });
    try {
      const res = await fetch(`${BACKEND_URL}/api/payments/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ planId })
      });
      const orderData = await res.json();
      if (!res.ok || orderData.error) {
        throw new Error(orderData.error || 'Failed to create payment order');
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Payment gateway load nahi ho paya. Kripya apna internet connection check karein.');
      }

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'PulseChat',
        description: planId === 'pro_yearly' ? 'Annual VIP Membership (1 Year)' : 'Pulse Sparks Pack',
        order_id: orderData.orderId,
        handler: async (response) => {
          await verifyPayment(response, planId, orderData.isSandbox);
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || ''
        },
        theme: {
          color: '#10b981'
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response) => {
        setStatusMsg({ type: 'error', text: response.error?.description || 'Payment cancelled or failed' });
        setLoading(false);
      });
      rzp.open();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
      setLoading(false);
    }
  };

  const handleClaimTrial = async () => {
    setLoading(true);
    setStatusMsg({ type: '', text: '' });
    try {
      const res = await fetch(`${BACKEND_URL}/api/payments/claim-vip-trial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to claim 3-day free trial');
      }
      if (data.user && updateUserProfile) {
        updateUserProfile(data.user);
        window.dispatchEvent(new CustomEvent('pulsechat_user_profile_updated', {
          detail: {
            targetUserId: data.user.id,
            updates: {
              isPro: data.user.isPro,
              proTier: data.user.proTier,
              customBadge: data.user.customBadge
            }
          }
        }));
      }
      setStatusMsg({
        type: 'success',
        text: data.message || '🎉 3-Day VIP Free Trial Activated!'
      });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (planId) => {
    if (planId === 'pro_monthly') {
      if (isUserPro && activeTier === 'monthly') {
        setStatusMsg({
          type: 'error',
          text: `Aapka Monthly VIP plan pehle se active hai (${expiryDateFormatted} tak). Expire hone se pehle dubara nahi liya ja sakta.`
        });
        return;
      }
      if (isUserPro && activeTier === 'yearly') {
        setStatusMsg({
          type: 'error',
          text: `Aapka Annual VIP plan pehle se active hai (${expiryDateFormatted} tak).`
        });
        return;
      }
      setUpiCheckoutPlan({
        id: 'pro_monthly',
        name: 'Pulse VIP (Monthly)',
        amount: 99,
        type: 'pro',
        description: '30 Days VIP Perks'
      });
      return;
    }

    if (planId === 'pro_yearly') {
      if (isUserPro && activeTier === 'yearly') {
        setStatusMsg({
          type: 'error',
          text: `Aapka Annual VIP plan pehle se active hai (${expiryDateFormatted} tak). Expire hone se pehle dubara nahi liya ja sakta.`
        });
        return;
      }
      setUpiCheckoutPlan({
        id: 'pro_yearly',
        name: 'Pulse VIP (Annual)',
        amount: 999,
        type: 'pro',
        description: '365 Days VIP Perks'
      });
      return;
    }

    // Sparks Pack
    if (planId === 'sparks_100') {
      const cooldown = getPackCooldownInfo('sparks_100');
      if (cooldown) {
        setStatusMsg({
          type: 'error',
          text: `Aapne 100 Free Sparks aaj claim kar liya hai. 24 ghante baad (${cooldown.text} baki) dubara free claim kar sakte hain.`
        });
        return;
      }
      await executeDemoActivation('sparks_100');
      return;
    }

    if (planId === 'sparks_300') {
      setUpiCheckoutPlan({
        id: 'sparks_300',
        name: '300 Pulse Sparks',
        amount: 49,
        type: 'sparks',
        description: '300 Sparks for game revives & animations'
      });
      return;
    }

    if (planId === 'sparks_1000') {
      setUpiCheckoutPlan({
        id: 'sparks_1000',
        name: '1000 Pulse Sparks',
        amount: 149,
        type: 'sparks',
        description: '1000 Sparks for game revives & animations'
      });
      return;
    }
  };

  const verifyPayment = async (razorpayResponse, planId, isSandbox) => {
    try {
      const vRes = await fetch(`${BACKEND_URL}/api/payments/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...razorpayResponse,
          planId,
          isSandbox
        })
      });

      const vData = await vRes.json();
      if (vData.success && vData.user) {
        updateUserProfile(vData.user);
        window.dispatchEvent(new CustomEvent('pulsechat_user_profile_updated', {
          detail: {
            targetUserId: vData.user.id,
            updates: {
              isPro: vData.user.isPro,
              proTier: vData.user.proTier,
              customBadge: vData.user.customBadge,
              pulseSparks: vData.user.pulseSparks,
              claimedFreeSparks: vData.user.claimedFreeSparks
            }
          }
        }));
        setStatusMsg({ type: 'success', text: vData.message || 'Payment successful!' });
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        throw new Error(vData.error || 'Verification failed');
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Payment verification failed' });
    } finally {
      setLoading(false);
    }
  };

  const executeGooglePlayPayment = async (planId) => {
    setStatusMsg({
      type: 'error',
      text: 'Google Play Billing Coming Soon! Kripya UPI / Razorpay se pay karein ya Monthly VIP free lein.'
    });
  };

  const executeDemoActivation = async (planId) => {
    setLoading(true);
    setStatusMsg({ type: '', text: '' });
    try {
      const res = await fetch(`${BACKEND_URL}/api/payments/demo-activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ planId })
      });
      const data = await res.json();
      if (data.success && data.user) {
        updateUserProfile(data.user);
        window.dispatchEvent(new CustomEvent('pulsechat_user_profile_updated', {
          detail: {
            targetUserId: data.user.id,
            updates: {
              isPro: data.user.isPro,
              proTier: data.user.proTier,
              customBadge: data.user.customBadge,
              pulseSparks: data.user.pulseSparks,
              claimedFreeSparks: data.user.claimedFreeSparks
            }
          }
        }));
        setStatusMsg({
          type: 'success',
          text: planId.startsWith('pro') ? '🎉 Monthly VIP Activated for 100% FREE! Enjoy VIP perks!' : '⚡ Pulse Sparks Credited for FREE!'
        });
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        throw new Error(data.error || 'Activation failed');
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const currentSparks = user?.pulseSparks ?? 50;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1300 }}>
      <div
        className="modal-card modal-responsive modal-card-animated"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '520px',
          width: '100%',
          maxHeight: '90dvh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '24px',
          background: 'var(--bg-card)',
          border: '1px solid rgba(255, 215, 0, 0.3)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(255, 215, 0, 0.15)'
        }}
      >
        {/* Hero Header Banner */}
        <div style={{
          position: 'relative',
          padding: '24px 20px 20px 20px',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 50%, #451a03 100%)',
          borderBottom: '1px solid rgba(255, 215, 0, 0.2)',
          color: '#fff',
          overflow: 'hidden',
          flexShrink: 0
        }}>
          {/* Subtle background glow */}
          <div style={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: '160px',
            height: '160px',
            background: 'radial-gradient(circle, rgba(255, 215, 0, 0.3) 0%, transparent 70%)',
            borderRadius: '50%',
            pointerEvents: 'none'
          }} />

          <button
            onClick={onClose}
            className="icon-btn-ghost"
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              color: '#fff',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '50%'
            }}
          >
            <X size={18} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(245, 158, 11, 0.5)'
            }}>
              <Crown size={24} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 900, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  PulseChat <span style={{ color: '#fbbf24' }}>VIP</span>
                </h2>
                {isUserPro && (
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    background: 'linear-gradient(90deg, #f59e0b, #ec4899)',
                    color: '#fff',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Zap size={11} fill="#fff" /> {user?.proTier === 'yearly' ? 'ANNUAL VIP' : 'MONTHLY VIP'}
                  </span>
                )}
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.78)' }}>
                High-capacity 500MB media, custom pulse themes & exclusive frequency perks
              </p>
              {isUserPro && (
                <div style={{
                  marginTop: '10px',
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  borderRadius: '12px',
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.78rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <PulseVipBadge size={14} showLabel={false} />
                    <span>Plan: <strong style={{ color: '#fbbf24' }}>{user?.proTier === 'yearly' ? 'Annual VIP' : 'Monthly VIP'}</strong></span>
                  </div>
                  <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.72rem' }}>
                    {user?.proExpiresAt ? `Valid till ${new Date(user.proExpiresAt).toLocaleDateString()}` : 'Active'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginTop: '16px',
            background: 'rgba(0, 0, 0, 0.35)',
            padding: '4px',
            borderRadius: '14px'
          }}>
            <button
              onClick={() => setActiveTab('pro')}
              style={{
                flex: 1,
                padding: '7px 12px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'pro' ? 'linear-gradient(90deg, #6366f1, #a855f7)' : 'transparent',
                color: activeTab === 'pro' ? '#fff' : 'rgba(255,255,255,0.7)',
                fontWeight: 700,
                fontSize: '0.84rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <Crown size={15} /> Pulse VIP Perks
            </button>
            <button
              onClick={() => setActiveTab('sparks')}
              style={{
                flex: 1,
                padding: '7px 12px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'sparks' ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : 'transparent',
                color: activeTab === 'sparks' ? '#fff' : 'rgba(255,255,255,0.7)',
                fontWeight: 700,
                fontSize: '0.84rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <Zap size={15} /> ⚡ Sparks Store ({currentSparks})
            </button>
          </div>
        </div>

        {/* Status notification banner if any */}
        {statusMsg.text && (
          <div style={{
            padding: '10px 16px',
            background: statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            borderBottom: `1px solid ${statusMsg.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: statusMsg.type === 'success' ? '#10b981' : '#ef4444',
            fontSize: '0.85rem',
            fontWeight: 600,
            textAlign: 'center',
            flexShrink: 0
          }}>
            {statusMsg.text}
          </div>
        )}

        {/* Body Content */}
        <div style={{
          padding: '18px 18px 48px 18px',
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}>
          {activeTab === 'pro' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Feature Grid - 12 Complete VIP Perks */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                <div style={{
                  padding: '12px',
                  background: 'var(--hover-bg)',
                  borderRadius: '14px',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  gap: '10px',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ color: '#f59e0b', flexShrink: 0 }}><Crown size={20} /></div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--text-main)' }}>Glowing VIP Crown</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Exclusive golden VIP badge on your avatar, profile & chats.</div>
                  </div>
                </div>

                <div style={{
                  padding: '12px',
                  background: 'var(--hover-bg)',
                  borderRadius: '14px',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  gap: '10px',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ color: '#06b6d4', flexShrink: 0 }}><Type size={20} /></div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--text-main)' }}>3D & Dust Text Effects</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Send glowing 3D embossed messages & dust-dissolving text.</div>
                  </div>
                </div>

                <div style={{
                  padding: '12px',
                  background: 'var(--hover-bg)',
                  borderRadius: '14px',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  gap: '10px',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ color: '#f43f5e', flexShrink: 0 }}><Zap size={20} /></div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--text-main)' }}>3D Burst Emoji Reactions</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Floating 3D emoji particle bursts & interactive reactions.</div>
                  </div>
                </div>

                <div style={{
                  padding: '12px',
                  background: 'var(--hover-bg)',
                  borderRadius: '14px',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  gap: '10px',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ color: '#ec4899', flexShrink: 0 }}><Sparkles size={20} /></div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--text-main)' }}>Live Animated Themes</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Matrix Rain, Starry Galaxy, Floating Hearts & Fireflies.</div>
                  </div>
                </div>

                <div style={{
                  padding: '12px',
                  background: 'var(--hover-bg)',
                  borderRadius: '14px',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  gap: '10px',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ color: '#a855f7', flexShrink: 0 }}><Palette size={20} /></div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--text-main)' }}>All 12 AMOLED Themes</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Royal Gold Aura, Cosmic Nebula, Cyber Pulse & Tokyo Synth.</div>
                  </div>
                </div>

                <div style={{
                  padding: '12px',
                  background: 'var(--hover-bg)',
                  borderRadius: '14px',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  gap: '10px',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ color: '#ec4899', flexShrink: 0 }}><Music size={20} /></div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--text-main)' }}>Chat Background Music</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>In-chat lo-fi beats, ambient soundscapes & music player.</div>
                  </div>
                </div>

                <div style={{
                  padding: '12px',
                  background: 'var(--hover-bg)',
                  borderRadius: '14px',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  gap: '10px',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ color: '#6366f1', flexShrink: 0 }}><EyeOff size={20} /></div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--text-main)' }}>Offline Stealth Indicator</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Hide your online green dot & active indicator completely.</div>
                  </div>
                </div>

                <div style={{
                  padding: '12px',
                  background: 'var(--hover-bg)',
                  borderRadius: '14px',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  gap: '10px',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ color: '#0ea5e9', flexShrink: 0 }}><Rocket size={20} /></div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--text-main)' }}>500 MB File Limits</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Upload massive 4K videos & large zip archives (Free: 25 MB).</div>
                  </div>
                </div>

                <div style={{
                  padding: '12px',
                  background: 'var(--hover-bg)',
                  borderRadius: '14px',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  gap: '10px',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ color: '#10b981', flexShrink: 0 }}><ShieldCheck size={20} /></div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--text-main)' }}>100% Ad-Free Priority</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Zero ads, zero interruptions, priority high-speed connection.</div>
                  </div>
                </div>

                <div style={{
                  padding: '12px',
                  background: 'var(--hover-bg)',
                  borderRadius: '14px',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  gap: '10px',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ color: '#fbbf24', flexShrink: 0 }}><Diamond size={20} /></div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--text-main)' }}>Daily Sparks Refill</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>100 free sparks refill every 24 hours for games & animations.</div>
                  </div>
                </div>
              </div>

              {/* 3-Day VIP Free Trial Banner */}
              {!isUserPro && !user?.hasUsedVipTrial && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.16), rgba(99, 102, 241, 0.16))',
                  border: '1.5px solid #10b981',
                  borderRadius: '16px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: 'rgba(16, 185, 129, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#10b981',
                      flexShrink: 0
                    }}>
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        🎁 3-Day VIP Free Trial
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Zero cost • Unlock all VIP features for 3 days
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleClaimTrial}
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '8px 14px',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 2px 10px rgba(16, 185, 129, 0.4)'
                    }}
                  >
                    {loading ? <Loader2 size={14} className="spin" /> : 'Claim Free'}
                  </button>
                </div>
              )}

              {/* Pricing Cards Selector */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <div
                  onClick={() => setBillingCycle('monthly')}
                  style={{
                    flex: 1,
                    padding: '14px',
                    borderRadius: '16px',
                    border: billingCycle === 'monthly' ? '2px solid #10b981' : '1px solid var(--border)',
                    background: billingCycle === 'monthly' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-card)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    position: 'relative',
                    transition: 'all 0.2s'
                  }}
                >
                  <span style={{
                    position: 'absolute',
                    top: '-9px',
                    right: '12px',
                    background: activeTier === 'monthly' ? '#10b981' : '#3b82f6',
                    color: '#fff',
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    padding: '1px 8px',
                    borderRadius: '10px'
                  }}>
                    {activeTier === 'monthly' ? '✓ ACTIVE' : 'POPULAR'}
                  </span>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Monthly VIP</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', margin: '4px 0' }}>
                    <span style={{ fontSize: '1.05rem', textDecoration: 'line-through', opacity: 0.5, color: 'var(--text-muted)' }}>₹149</span>
                    <span style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-main)' }}>₹99</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>/ mo</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: activeTier === 'monthly' ? '#10b981' : 'var(--text-muted)', fontWeight: 600 }}>
                    {activeTier === 'monthly' ? `Expires ${expiryDateFormatted}` : '30 Days Full VIP Access'}
                  </div>
                </div>

                <div
                  onClick={() => setBillingCycle('yearly')}
                  style={{
                    flex: 1,
                    padding: '14px',
                    borderRadius: '16px',
                    border: billingCycle === 'yearly' ? '2px solid #f59e0b' : '1px solid var(--border)',
                    background: billingCycle === 'yearly' ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-card)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    position: 'relative',
                    transition: 'all 0.2s'
                  }}
                >
                  <span style={{
                    position: 'absolute',
                    top: '-9px',
                    right: '12px',
                    background: activeTier === 'yearly' ? '#10b981' : '#f59e0b',
                    color: activeTier === 'yearly' ? '#fff' : '#000',
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    padding: '1px 8px',
                    borderRadius: '10px'
                  }}>
                    {activeTier === 'yearly' ? '✓ ACTIVE' : 'SAVE 16%'}
                  </span>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Annual VIP</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', margin: '4px 0' }}>
                    <span style={{ fontSize: '1.05rem', textDecoration: 'line-through', opacity: 0.5, color: 'var(--text-muted)' }}>₹1188</span>
                    <span style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-main)' }}>₹999</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>/ yr</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: activeTier === 'yearly' ? '#10b981' : 'var(--text-muted)', fontWeight: 600 }}>
                    {activeTier === 'yearly' ? `Expires ${expiryDateFormatted}` : '12 Months Full VIP Access'}
                  </div>
                </div>
              </div>

              {/* VIP Included Perks Checklist Card */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  color: '#f59e0b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Crown size={15} color="#f59e0b" /> Included in VIP {billingCycle === 'yearly' ? 'Annual' : 'Monthly'}:
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                  gap: '8px',
                  fontSize: '0.8rem',
                  color: 'var(--text-main)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={14} color="#10b981" style={{ flexShrink: 0 }} />
                    <span>👑 Exclusive Glowing VIP Badge</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={14} color="#10b981" style={{ flexShrink: 0 }} />
                    <span>✨ 3D Text & Dust Text Effects</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={14} color="#10b981" style={{ flexShrink: 0 }} />
                    <span>💥 3D Emoji Particle Bursts</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={14} color="#10b981" style={{ flexShrink: 0 }} />
                    <span>🌌 Live Animated Chat Wallpapers</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={14} color="#10b981" style={{ flexShrink: 0 }} />
                    <span>🎨 All 12 AMOLED App Themes</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={14} color="#10b981" style={{ flexShrink: 0 }} />
                    <span>🎵 Chat Background Music Player</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={14} color="#10b981" style={{ flexShrink: 0 }} />
                    <span>🕵️ Offline / Online Stealth Indicator</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={14} color="#10b981" style={{ flexShrink: 0 }} />
                    <span>🚀 500 MB High-Capacity Media</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={14} color="#10b981" style={{ flexShrink: 0 }} />
                    <span>🛡️ 100% Ad-Free Priority Experience</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={14} color="#10b981" style={{ flexShrink: 0 }} />
                    <span>⚡ 100 Free Daily Sparks Refill</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {billingCycle === 'monthly' && activeTier === 'monthly' ? (
                  <button
                    type="button"
                    disabled={true}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '16px',
                      fontWeight: 800,
                      fontSize: '0.92rem',
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: '#10b981',
                      cursor: 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <Check size={18} />
                    Monthly VIP Already Active (Expires {expiryDateFormatted})
                  </button>
                ) : billingCycle === 'monthly' && activeTier === 'yearly' ? (
                  <button
                    type="button"
                    disabled={true}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '16px',
                      fontWeight: 800,
                      fontSize: '0.92rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: 'var(--text-muted)',
                      cursor: 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <Check size={18} color="#10b981" />
                    Higher Tier (Annual VIP) Active (Expires {expiryDateFormatted})
                  </button>
                ) : billingCycle === 'yearly' && activeTier === 'yearly' ? (
                  <button
                    type="button"
                    disabled={true}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '16px',
                      fontWeight: 800,
                      fontSize: '0.92rem',
                      background: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      color: '#f59e0b',
                      cursor: 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <Check size={18} />
                    Annual VIP Already Active (Expires {expiryDateFormatted})
                  </button>
                ) : billingCycle === 'monthly' ? (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleCheckout('pro_monthly')}
                    className="btn-primary"
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '16px',
                      fontWeight: 800,
                      fontSize: '0.96rem',
                      background: 'linear-gradient(90deg, #10b981 0%, #6366f1 100%)',
                      boxShadow: '0 4px 18px rgba(16, 185, 129, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      border: 'none',
                      cursor: loading ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {loading ? (
                      <Loader2 size={18} className="spin" />
                    ) : (
                      <Crown size={18} fill="#fff" />
                    )}
                    <span>⚡ Pay ₹99 / month via Instant UPI (GPay/PhonePe/QR)</span>
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Google Play Billing Option (Locked / Coming Soon) */}
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => executeGooglePlayPayment('pro_yearly')}
                      style={{
                        width: '100%',
                        padding: '13px',
                        borderRadius: '16px',
                        fontWeight: 800,
                        fontSize: '0.94rem',
                        background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.35), rgba(37, 99, 235, 0.35))',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        color: 'rgba(255, 255, 255, 0.85)',
                        cursor: 'pointer'
                      }}
                    >
                      <Crown size={18} fill="#38bdf8" color="#38bdf8" />
                      <span>Google Play Purchase — ₹999/year (Coming Soon)</span>
                    </button>

                    {/* Razorpay UPI / Cards Option */}
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleCheckout('pro_yearly')}
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '16px',
                        fontWeight: 800,
                        fontSize: '0.92rem',
                        background: 'linear-gradient(90deg, #f59e0b 0%, #ec4899 100%)',
                        boxShadow: '0 4px 18px rgba(245, 158, 11, 0.35)',
                        border: 'none',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        cursor: loading ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <span>⚡ Pay ₹999 / year via Instant UPI (Save ₹189)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Sparks Store Tab */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(239, 68, 68, 0.08))',
                padding: '14px',
                borderRadius: '16px',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Your Sparks Balance</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Zap size={22} fill="#f59e0b" /> {currentSparks} <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>Sparks</span>
                  </div>
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', maxWidth: '180px', textAlign: 'right' }}>
                  Use sparks to beam animated gifts and appreciations in any chat!
                </div>
              </div>

              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Select a Sparks Bundle:
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { id: 'sparks_100', amount: 100, price: 19, isFree: true, tag: 'Starter • 1x / 24h Free' },
                  { id: 'sparks_300', amount: 300, price: 49, originalPrice: 69, isFree: false, tag: 'Most Popular • Instant Boost', highlight: true },
                  { id: 'sparks_1000', amount: 1000, price: 149, originalPrice: 199, isFree: false, tag: 'Best Value • Mega Spark Pack' }
                ].map((pack) => {
                  const isSelected = selectedSparksPack === pack.id;
                  const cooldown = pack.isFree ? getPackCooldownInfo(pack.id) : null;
                  return (
                    <div
                      key={pack.id}
                      onClick={() => setSelectedSparksPack(pack.id)}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '14px',
                        border: isSelected ? '2px solid #f59e0b' : '1px solid var(--border)',
                        background: isSelected ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-card)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s',
                        opacity: (pack.isFree && cooldown) ? 0.75 : 1
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: (pack.isFree && cooldown) ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#f59e0b'
                        }}>
                          {(pack.isFree && cooldown) ? <Clock size={18} /> : <Zap size={18} fill="#f59e0b" />}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>{pack.amount} Pulse Sparks</span>
                            {pack.isFree ? (
                              cooldown ? (
                                <span style={{
                                  fontSize: '0.66rem',
                                  fontWeight: 800,
                                  padding: '2px 8px',
                                  borderRadius: '8px',
                                  background: 'rgba(245, 158, 11, 0.18)',
                                  color: '#f59e0b',
                                  border: '1px solid rgba(245, 158, 11, 0.3)'
                                }}>
                                  ⏳ Resets in {cooldown.text}
                                </span>
                              ) : (
                                <span style={{
                                  fontSize: '0.66rem',
                                  fontWeight: 800,
                                  padding: '2px 8px',
                                  borderRadius: '8px',
                                  background: 'rgba(16, 185, 129, 0.18)',
                                  color: '#10b981',
                                  border: '1px solid rgba(16, 185, 129, 0.3)'
                                }}>
                                  ✓ 1x / 24h Free
                                </span>
                              )
                            ) : (
                              <span style={{
                                fontSize: '0.66rem',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '8px',
                                background: pack.highlight ? 'rgba(245, 158, 11, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                                color: pack.highlight ? '#f59e0b' : '#818cf8',
                                border: '1px solid rgba(245, 158, 11, 0.3)'
                              }}>
                                {pack.highlight ? 'HOT DEAL' : 'BEST VALUE'}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            {pack.isFree ? (cooldown ? 'Aapne aaj claim kar liya hai. 24h baad reset ho jayega.' : pack.tag) : pack.tag}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                          {pack.isFree ? (
                            <>
                              <span style={{ fontSize: '0.88rem', textDecoration: 'line-through', opacity: 0.5, color: 'var(--text-muted)' }}>₹{pack.price}</span>
                              <span style={{ fontWeight: 900, fontSize: '1.05rem', color: cooldown ? 'var(--text-muted)' : '#10b981' }}>
                                {cooldown ? 'CLAIMED' : 'FREE'}
                              </span>
                            </>
                          ) : (
                            <>
                              <span style={{ fontSize: '0.88rem', textDecoration: 'line-through', opacity: 0.5, color: 'var(--text-muted)' }}>₹{pack.originalPrice}</span>
                              <span style={{ fontWeight: 900, fontSize: '1.05rem', color: '#f59e0b' }}>
                                ₹{pack.price}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {(() => {
                const selectedPackData = [
                  { id: 'sparks_100', amount: 100, price: 19, isFree: true },
                  { id: 'sparks_300', amount: 300, price: 49, isFree: false },
                  { id: 'sparks_1000', amount: 1000, price: 149, isFree: false }
                ].find(p => p.id === selectedSparksPack);
                const selectedCooldown = selectedPackData?.isFree ? getPackCooldownInfo('sparks_100') : null;

                return (
                  <button
                    type="button"
                    disabled={loading || (selectedPackData?.isFree && !!selectedCooldown)}
                    onClick={() => handleCheckout(selectedSparksPack)}
                    className="btn-primary"
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '16px',
                      fontWeight: 800,
                      fontSize: '0.96rem',
                      background: (selectedPackData?.isFree && selectedCooldown)
                        ? 'rgba(255, 255, 255, 0.08)'
                        : selectedPackData?.isFree
                        ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                        : 'linear-gradient(90deg, #f59e0b 0%, #ec4899 100%)',
                      boxShadow: (selectedPackData?.isFree && selectedCooldown)
                        ? 'none'
                        : '0 4px 18px rgba(245, 158, 11, 0.35)',
                      color: (selectedPackData?.isFree && selectedCooldown) ? 'var(--text-muted)' : '#fff',
                      border: (selectedPackData?.isFree && selectedCooldown) ? '1px solid rgba(255, 255, 255, 0.15)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: (loading || (selectedPackData?.isFree && !!selectedCooldown)) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {loading ? (
                      <Loader2 size={18} className="spin" />
                    ) : (selectedPackData?.isFree && selectedCooldown) ? (
                      <>
                        <Clock size={18} />
                        Claimed (Resets in {selectedCooldown.text})
                      </>
                    ) : selectedPackData?.isFree ? (
                      <>
                        <Zap size={18} fill="#fff" />
                        ⚡ Claim 100 Sparks — 100% FREE
                      </>
                    ) : (
                      <>
                        <Zap size={18} fill="#fff" />
                        ⚡ Buy {selectedPackData?.amount} Sparks — ₹{selectedPackData?.price} via Instant UPI
                      </>
                    )}
                  </button>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Instant UPI Checkout Modal */}
      {upiCheckoutPlan && (
        <UpiCheckoutModal
          plan={upiCheckoutPlan}
          onClose={() => setUpiCheckoutPlan(null)}
          onSuccess={() => {
            setUpiCheckoutPlan(null);
            onClose();
          }}
        />
      )}
    </div>
  );
}
