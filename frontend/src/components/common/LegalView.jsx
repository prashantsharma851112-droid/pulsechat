import React, { useState, useEffect } from 'react';
import { Shield, FileText, RefreshCw, Mail, DollarSign, ArrowLeft, CheckCircle, ExternalLink } from 'lucide-react';

export const LEGAL_TABS = [
  { id: 'privacy', label: 'Privacy Policy', icon: Shield },
  { id: 'terms', label: 'Terms of Service', icon: FileText },
  { id: 'refund', label: 'Refund & Cancellation', icon: RefreshCw },
  { id: 'pricing', label: 'Pricing & Plans', icon: DollarSign },
  { id: 'contact', label: 'Contact Us', icon: Mail }
];

export default function LegalView({ initialTab = 'privacy', onClose, isStandalone = false }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      backgroundColor: '#0a0d14',
      color: '#f1f5f9',
      fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header Bar */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        maxWidth: '1100px',
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {onClose ? (
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#fff',
                borderRadius: '10px',
                padding: '6px 12px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.82rem',
                fontWeight: 600
              }}
            >
              <ArrowLeft size={16} /> Back
            </button>
          ) : (
            <a
              href="/"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#fff',
                borderRadius: '10px',
                padding: '6px 12px',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.82rem',
                fontWeight: 600
              }}
            >
              <ArrowLeft size={16} /> Home
            </a>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '1.15rem' }}>⚡</span>
            <span style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #6366f1, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              PulseChat
            </span>
            <span style={{ fontSize: '0.72rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '2px 7px', borderRadius: '10px', fontWeight: 600 }}>
              Legal
            </span>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              borderRadius: '8px',
              padding: '5px 12px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.8rem',
              fontWeight: 600
            }}
          >
            ✕ Close
          </button>
        )}
      </header>

      {/* Main Content Area */}
      <main style={{
        maxWidth: '1100px',
        width: '100%',
        margin: '0 auto',
        padding: '16px 12px 60px 12px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        flex: 1
      }}>
        {/* Navigation Tabs */}
        <div style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '8px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none'
        }}>
          {LEGAL_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (isStandalone) {
                    window.history.pushState(null, '', `/${tab.id}`);
                  }
                }}
                style={{
                  background: isActive ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(236, 72, 153, 0.2))' : 'rgba(255, 255, 255, 0.04)',
                  border: isActive ? '1px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.08)',
                  color: isActive ? '#fff' : '#94a3b8',
                  padding: '8px 14px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.84rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                  flexShrink: 0
                }}
              >
                <Icon size={15} color={isActive ? '#818cf8' : '#94a3b8'} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Card */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '20px 16px',
          lineHeight: '1.7',
          color: '#cbd5e1',
          boxSizing: 'border-box'
        }}>
          {activeTab === 'privacy' && <PrivacyContent />}
          {activeTab === 'terms' && <TermsContent />}
          {activeTab === 'refund' && <RefundContent />}
          {activeTab === 'pricing' && <PricingContent />}
          {activeTab === 'contact' && <ContactContent />}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '24px 20px',
        textAlign: 'center',
        fontSize: '0.8rem',
        color: '#64748b',
        backgroundColor: '#07090e'
      }}>
        <div style={{ marginBottom: '8px' }}>
          © {new Date().getFullYear()} PulseChat. All rights reserved. Owned and operated by Prashant Kumar.
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button onClick={() => setActiveTab('privacy')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.78rem' }}>Privacy Policy</button>
          <span>•</span>
          <button onClick={() => setActiveTab('terms')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.78rem' }}>Terms of Service</button>
          <span>•</span>
          <button onClick={() => setActiveTab('refund')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.78rem' }}>Refund & Cancellation</button>
          <span>•</span>
          <button onClick={() => setActiveTab('pricing')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.78rem' }}>Pricing & Plans</button>
          <span>•</span>
          <button onClick={() => setActiveTab('contact')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.78rem' }}>Contact Support</button>
        </div>
      </footer>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 style={{
      fontSize: '1.35rem',
      fontWeight: 700,
      color: '#f8fafc',
      marginTop: '28px',
      marginBottom: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }}>
      {children}
    </h2>
  );
}

function PrivacyContent() {
  return (
    <div>
      <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
        Privacy Policy
      </h1>
      <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '24px' }}>
        Effective Date: October 1, 2026 • Platform: PulseChat (Web & Mobile Application)
      </p>

      <p>
        Welcome to <strong>PulseChat</strong> ("we", "our", or "us"), owned and operated by <strong>Prashant Kumar</strong>. We value your privacy and are committed to protecting your personal information. This Privacy Policy outlines how we collect, use, disclose, and safeguard your data when you visit our website at <code>https://pulsechat-ten-theta.vercel.app/</code> or use the PulseChat mobile application.
      </p>

      <SectionTitle>1. Information We Collect</SectionTitle>
      <ul style={{ paddingLeft: '20px' }}>
        <li><strong>Account Information:</strong> When you register, we collect your display name, username, email address, password (stored via secure cryptographic one-way hashing), and optional profile avatar.</li>
        <li><strong>Communications:</strong> Messages, voice messages, images, and attachments sent through private 1-to-1 chats or group chats are transmitted over encrypted protocols (WSS/TLS).</li>
        <li><strong>Transaction Information:</strong> When purchasing VIP subscriptions or Pulse Sparks, payments are securely processed by authorized payment providers (e.g., Razorpay, Cashfree, Google Play Billing). PulseChat does not store or process your complete credit/debit card numbers or bank account credentials.</li>
        <li><strong>Device & Usage Data:</strong> Device model, operating system version, browser type, and anonymous crash telemetry to enhance platform stability.</li>
      </ul>

      <SectionTitle>2. How We Use Your Information</SectionTitle>
      <ul style={{ paddingLeft: '20px' }}>
        <li>To provide, operate, and maintain real-time chat, voice/video calls, and social interactions.</li>
        <li>To authenticate your identity and prevent fraudulent activities or unauthorized account access.</li>
        <li>To deliver VIP perks, custom badges, theme preferences, and in-game Pulse Sparks balances.</li>
        <li>To communicate critical service updates, OTP security codes, and customer support responses.</li>
      </ul>

      <SectionTitle>3. Third-Party Integrations & Advertising</SectionTitle>
      <p>
        PulseChat partners with trusted third-party providers:
      </p>
      <ul style={{ paddingLeft: '20px' }}>
        <li><strong>Google AdMob & AdSense:</strong> Serves non-intrusive rewarded and interstitial ads to non-VIP users. Google's advertising policies and cookie usage apply.</li>
        <li><strong>Google OAuth:</strong> Allows one-click authentication through Google Sign-In.</li>
        <li><strong>Payment Processors:</strong> Process payments under strict PCI-DSS and RBI compliance standards.</li>
      </ul>

      <SectionTitle>4. Data Security & Storage</SectionTitle>
      <p>
        We employ industry-standard administrative, technical, and physical security measures including SSL/TLS 256-bit encryption in transit, strict database access controls, and rate-limiting to prevent brute-force attacks.
      </p>

      <SectionTitle>5. User Rights & Account Deletion</SectionTitle>
      <p>
        You retain full rights to inspect, update, or permanently delete your account data. You can initiate instant chat cleanup or permanent account closure directly from the <strong>Settings</strong> menu in the application, or by emailing our Data Protection Officer at <code>prashantsharma851112@gmail.com</code>.
      </p>
    </div>
  );
}

function TermsContent() {
  return (
    <div>
      <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
        Terms and Conditions
      </h1>
      <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '24px' }}>
        Effective Date: October 1, 2026 • Platform: PulseChat
      </p>

      <p>
        By accessing or using the PulseChat application, website, or associated services, you agree to be bound by these Terms and Conditions. If you disagree with any part of these terms, you must discontinue using our services immediately.
      </p>

      <SectionTitle>1. Eligibility & Account Responsibilities</SectionTitle>
      <p>
        You must be at least 13 years of age (or the minimum legal age in your jurisdiction) to create an account on PulseChat. You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account.
      </p>

      <SectionTitle>2. Acceptable Use Policy</SectionTitle>
      <p>You agree not to engage in any of the following prohibited behaviors:</p>
      <ul style={{ paddingLeft: '20px' }}>
        <li>Distributing illegal, harassing, defamatory, abusive, threatening, or sexually explicit content.</li>
        <li>Sending unsolicited bulk advertising, phishing links, or spam.</li>
        <li>Attempting to bypass security mechanisms, reverse engineer source code, or exploit API endpoints.</li>
        <li>Impersonating another person, brand, or entity.</li>
      </ul>
      <p>
        Violations may result in immediate suspension or permanent termination of your account without notice.
      </p>

      <SectionTitle>3. Digital Goods, VIP & Sparks</SectionTitle>
      <ul style={{ paddingLeft: '20px' }}>
        <li><strong>VIP Subscriptions:</strong> Provide access to premium cosmetics, custom badges, chat music player, and an ad-free experience for a specified duration (Monthly or Annual).</li>
        <li><strong>Pulse Sparks:</strong> Virtual in-app points used for game revives and interactive animations. Sparks have no cash value outside the application and cannot be exchanged for fiat currency.</li>
        <li>All virtual goods are delivered digitally and immediately upon payment confirmation.</li>
      </ul>

      <SectionTitle>4. Intellectual Property</SectionTitle>
      <p>
        All rights, title, and interest in PulseChat, including graphics, code, branding, audio assets, and UI design, remain the exclusive property of Prashant Kumar and respective licensors.
      </p>

      <SectionTitle>5. Limitation of Liability & Governing Law</SectionTitle>
      <p>
        PulseChat is provided on an "AS IS" and "AS AVAILABLE" basis. To the maximum extent permitted by applicable law, we disclaim all warranties. These Terms shall be governed by and construed in accordance with the laws of India, subject to the exclusive jurisdiction of the competent courts in India.
      </p>
    </div>
  );
}

function RefundContent() {
  return (
    <div>
      <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
        Cancellation & Refund Policy
      </h1>
      <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '24px' }}>
        Clear, Fair & Transparent Digital Purchase Terms
      </p>

      <p>
        At PulseChat, we strive to ensure a seamless experience with our digital services. Because VIP memberships and Pulse Sparks are digital goods delivered instantly to your account, the following policy applies to all purchases:
      </p>

      <SectionTitle>1. Digital Delivery & Instant Access</SectionTitle>
      <p>
        Upon successful payment verification, your VIP status or purchased Sparks are credited to your account instantly (typically within 0 to 60 seconds).
      </p>

      <SectionTitle>2. Refund Eligibility</SectionTitle>
      <p>We provide full refunds under the following specific circumstances:</p>
      <ul style={{ paddingLeft: '20px' }}>
        <li>
          <strong>Technical Failure / Non-Delivery:</strong> If money was debited from your bank account or card, but your VIP status or Sparks were not credited within 2 hours of payment completion.
        </li>
        <li>
          <strong>Duplicate Charges:</strong> If you were accidentally charged more than once for the same transaction due to a network glitch.
        </li>
      </ul>

      <SectionTitle>3. Non-Refundable Scenarios</SectionTitle>
      <ul style={{ paddingLeft: '20px' }}>
        <li>Partially consumed VIP subscription periods.</li>
        <li>Sparks that have already been spent in games or features.</li>
        <li>Accounts terminated due to violations of our Acceptable Use Policy (e.g. harassment or spam).</li>
      </ul>

      <SectionTitle>4. How to Request a Refund</SectionTitle>
      <p>
        To request a refund, please contact our support team within <strong>48 hours</strong> of the transaction with:
      </p>
      <ul style={{ paddingLeft: '20px' }}>
        <li>Your Registered Email / Username</li>
        <li>Payment Transaction ID / Order ID (e.g., from Razorpay, Cashfree, or Google Play)</li>
        <li>Screenshot of the payment receipt</li>
      </ul>
      <p>
        Send your request to: <strong>prashantsharma851112@gmail.com</strong>. Eligible refunds will be processed within <strong>5 to 7 business days</strong> to the original payment method.
      </p>

      <SectionTitle>5. Subscription Cancellation</SectionTitle>
      <p>
        Our VIP plans are offered as one-time fixed-duration purchases (e.g. 30 Days or 365 Days) without unauthorized auto-debit. Your VIP privileges will simply expire at the end of the paid period unless you manually renew.
      </p>
    </div>
  );
}

function PricingContent() {
  return (
    <div>
      <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
        Pricing & Plans
      </h1>
      <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '24px' }}>
        Simple, Transparent & Honest Pricing • All prices in Indian Rupee (INR ₹)
      </p>

      {/* Pricing Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        {/* Free Plan */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: '#fff' }}>Standard Free</h3>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981', marginBottom: '14px' }}>
            ₹0 <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 400 }}>/ forever</span>
          </div>
          <ul style={{ paddingLeft: '18px', fontSize: '0.88rem', color: '#94a3b8', flex: 1, margin: 0 }}>
            <li>Unlimited 1-on-1 & Group Chats</li>
            <li>Voice & Video Calling</li>
            <li>100 Free Sparks (Daily Claim)</li>
            <li>Offline message queuing</li>
          </ul>
        </div>

        {/* VIP Monthly */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(236, 72, 153, 0.15))',
          border: '1px solid rgba(99, 102, 241, 0.4)',
          borderRadius: '16px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            top: '-10px',
            right: '18px',
            background: 'linear-gradient(135deg, #6366f1, #ec4899)',
            color: '#fff',
            fontSize: '0.7rem',
            fontWeight: 800,
            padding: '3px 10px',
            borderRadius: '12px'
          }}>
            POPULAR
          </div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: '#fff' }}>VIP Monthly</h3>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: '14px' }}>
            ₹99 <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 400 }}>/ 30 days</span>
          </div>
          <ul style={{ paddingLeft: '18px', fontSize: '0.85rem', color: '#cbd5e1', flex: 1, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <li>3-Day Free Trial included</li>
            <li>👑 Exclusive Glowing VIP Crown Badge</li>
            <li>✨ 3D Text & Dust-Dissolving Text Effects</li>
            <li>💥 3D Emoji Particle Bursts & Reactions</li>
            <li>🌌 All Live Animated Chat Wallpapers</li>
            <li>🎨 All 12 AMOLED Premium App Themes</li>
            <li>🎵 Chat Background Music Player</li>
            <li>🕵️ Offline Stealth Mode (Hide Online Indicator)</li>
            <li>🚀 500 MB High-Capacity Media Uploads</li>
            <li>🛡️ 100% Ad-Free Priority Experience</li>
            <li>⚡ 100 Free Daily Sparks Refill</li>
          </ul>
        </div>

        {/* VIP Annual */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: '#fff' }}>VIP Annual</h3>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f59e0b', marginBottom: '14px' }}>
            ₹999 <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 400 }}>/ 365 days</span>
          </div>
          <ul style={{ paddingLeft: '18px', fontSize: '0.85rem', color: '#cbd5e1', flex: 1, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <li>Save over ₹189 compared to monthly</li>
            <li>All VIP Monthly features included for 365 Days</li>
            <li>Priority Customer Support (VIP SLA)</li>
            <li>Early access to future VIP beta features</li>
          </ul>
        </div>
      </div>

      <SectionTitle>Sparks Packages (In-Game Virtual Points)</SectionTitle>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <th style={{ padding: '12px 14px' }}>Item</th>
              <th style={{ padding: '12px 14px' }}>Sparks Amount</th>
              <th style={{ padding: '12px 14px' }}>Price (INR)</th>
              <th style={{ padding: '12px 14px' }}>Billing Type</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <td style={{ padding: '12px 14px' }}>Daily Sparks Refill</td>
              <td style={{ padding: '12px 14px' }}>100 Sparks</td>
              <td style={{ padding: '12px 14px', color: '#10b981', fontWeight: 700 }}>₹0 (Free)</td>
              <td style={{ padding: '12px 14px' }}>Every 24 Hours</td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <td style={{ padding: '12px 14px' }}>Sparks Starter Pack</td>
              <td style={{ padding: '12px 14px' }}>300 Sparks</td>
              <td style={{ padding: '12px 14px', color: '#fff', fontWeight: 700 }}>₹49</td>
              <td style={{ padding: '12px 14px' }}>One-Time Purchase</td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <td style={{ padding: '12px 14px' }}>Sparks Mega Pack</td>
              <td style={{ padding: '12px 14px' }}>1000 Sparks</td>
              <td style={{ padding: '12px 14px', color: '#fff', fontWeight: 700 }}>₹149</td>
              <td style={{ padding: '12px 14px' }}>One-Time Purchase</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ContactContent() {
  return (
    <div>
      <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
        Contact Us
      </h1>
      <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '24px' }}>
        We are here to help. Reach out with questions, feedback, or support inquiries.
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
        marginBottom: '28px'
      }}>
        {/* Support Card */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '24px'
        }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', color: '#fff' }}>Customer Support</h3>
          <p style={{ fontSize: '0.88rem', color: '#94a3b8', margin: '0 0 12px 0' }}>
            For payment inquiries, VIP activation help, refund requests, or technical bug reports:
          </p>
          <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '10px 14px', borderRadius: '10px', color: '#818cf8', fontWeight: 700, fontSize: '0.92rem' }}>
            prashantsharma851112@gmail.com
          </div>
        </div>

        {/* Operating Details */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '24px'
        }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', color: '#fff' }}>Business Details</h3>
          <p style={{ fontSize: '0.88rem', color: '#cbd5e1', margin: '0 0 6px 0' }}>
            <strong>Platform:</strong> PulseChat
          </p>
          <p style={{ fontSize: '0.88rem', color: '#cbd5e1', margin: '0 0 6px 0' }}>
            <strong>Owner / Operator:</strong> Prashant Kumar
          </p>
          <p style={{ fontSize: '0.88rem', color: '#cbd5e1', margin: '0 0 6px 0' }}>
            <strong>Operating Location:</strong> India
          </p>
          <p style={{ fontSize: '0.88rem', color: '#cbd5e1', margin: '0' }}>
            <strong>Working Hours:</strong> Mon - Sat: 10:00 AM - 7:00 PM IST
          </p>
        </div>
      </div>

      <div style={{
        background: 'rgba(16, 185, 129, 0.08)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        borderRadius: '14px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <CheckCircle size={22} color="#10b981" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '0.88rem', color: '#d1fae5' }}>
          Typical email response time is under <strong>24 hours</strong>. For payment issues, please include your Order ID or UPI UTR reference number for accelerated resolution.
        </span>
      </div>
    </div>
  );
}
