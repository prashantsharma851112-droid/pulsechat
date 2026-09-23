import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { X, Sparkles, Check, Crown, Zap, ShieldCheck, Flame, Coffee, Heart, Rocket, Diamond, Award, ArrowRight, Loader2 } from 'lucide-react';
import PulseVipBadge from '../common/PulseVipBadge';
import { BACKEND_URL } from '../../utils/config';

export default function PulseProModal({ onClose, initialTab = 'pro' }) {
  const { user, token, updateUserProfile } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState(initialTab === 'coins' ? 'sparks' : initialTab); // 'pro' | 'sparks'
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'yearly'
  const [selectedSparksPack, setSelectedSparksPack] = useState('sparks_300');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [razorpayConfig, setRazorpayConfig] = useState({ keyId: '', isLive: false });

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
      await executeDemoActivation(planId);
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
      if (!razorpayConfig.isLive) {
        setStatusMsg({
          type: 'error',
          text: 'Annual VIP (₹499/year) ke liye online payment gateway integrate ho raha hai. Abhi ke liye aap Monthly VIP 100% FREE le sakte hain!'
        });
        return;
      }
      await initiateRazorpay(planId);
      return;
    }

    // Sparks Pack
    if (razorpayConfig.isLive) {
      await initiateRazorpay(planId);
    } else {
      await executeDemoActivation(planId);
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
          overflow: 'hidden'
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
            textAlign: 'center'
          }}>
            {statusMsg.text}
          </div>
        )}

        {/* Body Content */}
        <div style={{ padding: '20px', maxHeight: '68vh', overflowY: 'auto' }}>
          {activeTab === 'pro' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Feature Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{
                  padding: '12px',
                  background: 'var(--hover-bg)',
                  borderRadius: '14px',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  gap: '10px'
                }}>
                  <div style={{ color: '#f59e0b', flexShrink: 0 }}><Crown size={20} /></div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--text-main)' }}>Pulse VIP Crest</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Signature glowing VIP crest badge across all chats & profile.</div>
                  </div>
                </div>

                <div style={{
                  padding: '12px',
                  background: 'var(--hover-bg)',
                  borderRadius: '14px',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  gap: '10px'
                }}>
                  <div style={{ color: '#0ea5e9', flexShrink: 0 }}><Rocket size={20} /></div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--text-main)' }}>500 MB Files</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Upload massive video & files (Free is 25 MB).</div>
                  </div>
                </div>

                <div style={{
                  padding: '12px',
                  background: 'var(--hover-bg)',
                  borderRadius: '14px',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  gap: '10px'
                }}>
                  <div style={{ color: '#a855f7', flexShrink: 0 }}><Sparkles size={20} /></div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--text-main)' }}>Exclusive Themes</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Unlock Royal Gold, Cosmic Nebula & Cyber Pulse.</div>
                  </div>
                </div>

                <div style={{
                  padding: '12px',
                  background: 'var(--hover-bg)',
                  borderRadius: '14px',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  gap: '10px'
                }}>
                  <div style={{ color: '#10b981', flexShrink: 0 }}><ShieldCheck size={20} /></div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--text-main)' }}>100% Ad-Free</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Zero ads, zero interruptions, pure high speed.</div>
                  </div>
                </div>
              </div>

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
                    background: activeTier === 'monthly' ? '#3b82f6' : '#10b981',
                    color: '#fff',
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    padding: '1px 8px',
                    borderRadius: '10px'
                  }}>
                    {activeTier === 'monthly' ? '✓ ACTIVE' : '100% FREE'}
                  </span>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Monthly VIP</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '4px 0' }}>
                    <span style={{ fontSize: '1.15rem', textDecoration: 'line-through', opacity: 0.5, color: 'var(--text-muted)' }}>₹49</span>
                    <span style={{ fontSize: '1.45rem', fontWeight: 900, color: '#10b981' }}>FREE</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: activeTier === 'monthly' ? 'var(--text-main)' : '#10b981', fontWeight: 600 }}>
                    {activeTier === 'monthly' ? `Expires ${expiryDateFormatted}` : 'Free Beta Access (₹0)'}
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', margin: '4px 0' }}>
                    <span style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-main)' }}>₹499</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>/ year</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: activeTier === 'yearly' ? '#10b981' : 'var(--text-muted)', fontWeight: 600 }}>
                    {activeTier === 'yearly' ? `Expires ${expiryDateFormatted}` : '12 Months Full VIP Access'}
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
                ) : (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleCheckout(billingCycle === 'monthly' ? 'pro_monthly' : 'pro_yearly')}
                    className="btn-primary"
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '16px',
                      fontWeight: 800,
                      fontSize: '0.96rem',
                      background: billingCycle === 'monthly'
                        ? 'linear-gradient(90deg, #10b981 0%, #6366f1 100%)'
                        : 'linear-gradient(90deg, #f59e0b 0%, #ef4444 100%)',
                      boxShadow: billingCycle === 'monthly'
                        ? '0 4px 18px rgba(16, 185, 129, 0.35)'
                        : '0 4px 18px rgba(245, 158, 11, 0.35)',
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
                    ) : billingCycle === 'monthly' ? (
                      <Zap size={18} fill="#fff" />
                    ) : (
                      <Crown size={18} fill="#fff" />
                    )}
                    {billingCycle === 'monthly'
                      ? '⚡ Activate Monthly VIP — 100% FREE'
                      : '👑 Get Annual VIP — ₹499/year'}
                  </button>
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
                  { id: 'sparks_100', amount: 100, price: 19, tag: 'Starter' },
                  { id: 'sparks_300', amount: 300, price: 49, tag: 'Most Popular', highlight: true },
                  { id: 'sparks_1000', amount: 1000, price: 149, tag: 'Best Value' }
                ].map((pack) => {
                  const isSelected = selectedSparksPack === pack.id;
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
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: 'rgba(245, 158, 11, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#f59e0b'
                        }}>
                          <Zap size={18} fill="#f59e0b" />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                            {pack.amount} Pulse Sparks
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            {pack.tag}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                          <span style={{ fontSize: '0.88rem', textDecoration: 'line-through', opacity: 0.5, color: 'var(--text-muted)' }}>₹{pack.price}</span>
                          <span style={{ fontWeight: 900, fontSize: '1.05rem', color: '#10b981' }}>FREE</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleCheckout(selectedSparksPack)}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '16px',
                  fontWeight: 800,
                  fontSize: '0.96rem',
                  background: 'linear-gradient(90deg, #10b981 0%, #f59e0b 100%)',
                  boxShadow: '0 4px 18px rgba(16, 185, 129, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? <Loader2 size={18} className="spin" /> : <Zap size={18} fill="#fff" />}
                ⚡ Claim Sparks Pack — 100% FREE
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
