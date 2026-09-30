const express = require('express');
const router = express.Router();

const privacyHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy - PulseChat</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #111827;
      --accent: #3b82f6;
      --text: #e2e8f0;
      --muted: #94a3b8;
      --border: rgba(255,255,255,0.1);
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
      margin: 0;
      padding: 24px 16px;
    }
    .container {
      max-width: 820px;
      margin: 0 auto;
      background: var(--card-bg);
      padding: 32px 28px;
      border-radius: 20px;
      border: 1px solid var(--border);
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    }
    h1 { color: #fff; margin-top: 0; font-size: 1.85rem; font-weight: 800; border-bottom: 2px solid var(--accent); padding-bottom: 12px; }
    h2 { color: #60a5fa; margin-top: 28px; font-size: 1.25rem; font-weight: 700; }
    h3 { color: #93c5fd; font-size: 1.05rem; }
    p, li { color: var(--muted); font-size: 0.95rem; }
    ul { padding-left: 20px; }
    li { margin-bottom: 8px; }
    a { color: #38bdf8; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .badge {
      display: inline-block;
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .footer {
      margin-top: 36px;
      padding-top: 20px;
      border-top: 1px solid var(--border);
      font-size: 0.85rem;
      color: #64748b;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">Official Google Play Compliance</div>
    <h1>Privacy Policy for PulseChat</h1>
    <p><strong>Effective Date:</strong> September 30, 2026</p>
    <p>Welcome to <strong>PulseChat</strong> ("we", "our", or "us"). We are committed to protecting your privacy and ensuring you have a positive experience on our mobile application and services. This Privacy Policy describes how we collect, use, and protect your information.</p>

    <h2>1. Information We Collect</h2>
    <ul>
      <li><strong>Account Information:</strong> When you register, we collect your username, display name, email address, password hash, and optional profile picture/avatar.</li>
      <li><strong>Messages and Media:</strong> We process messages, photos, audio clips, and stories ("Vibes") you share. Ephemeral messages ("Dust Text") are designed to automatically expire and be permanently removed from our servers after viewing.</li>
      <li><strong>Game & Activity Data:</strong> Scores, levels, leaderboards, streaks, and rewarded points ("Pulse Sparks") in games like Arrow Puzzle.</li>
      <li><strong>Device Information:</strong> Device model, operating system version, unique device identifiers, and crash logs to improve app stability.</li>
    </ul>

    <h2>2. How We Use Your Information</h2>
    <ul>
      <li>To provide instant real-time messaging, voice, video, and social stories ("Vibes").</li>
      <li>To maintain leaderboard rankings, game levels, and reward distributions.</li>
      <li>To verify accounts, enhance app security, and prevent spam or abusive activity.</li>
      <li>To deliver relevant in-app advertisements and rewarded video rewards.</li>
    </ul>

    <h2>3. Advertising (Google AdMob)</h2>
    <p>PulseChat integrates <strong>Google AdMob</strong> to display rewarded video ads (e.g. to earn revives in Arrow Puzzle) and occasional interstitial ads between stories for non-VIP users.</p>
    <p>Google AdMob may collect and use pseudonymous device identifiers (such as Android Advertising ID), IP addresses, and app interaction data in accordance with Google's Advertising Privacy Policy. You can learn more by visiting <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener">Google Advertising & Privacy</a>.</p>

    <h2>4. In-App Purchases & Subscriptions (Pulse VIP Pro)</h2>
    <p>We offer optional premium subscriptions ("Pulse VIP Pro") for ad-free chatting, premium aura badges, and 4K wallpapers. Payments are processed securely via <strong>Google Play In-App Billing</strong> or authorized payment gateways. PulseChat does not store or process your sensitive credit card or banking details.</p>

    <h2>5. Data Security & Retention</h2>
    <p>We implement industry-standard encryption protocols (TLS/HTTPS) to protect your data in transit and secure database storage with strict access controls. Ephemeral "Dust Text" messages are automatically and permanently purged upon viewing.</p>

    <h2>6. Account Deletion & User Rights</h2>
    <p>You have full control over your data. You may update your profile or delete your account and all associated messages at any time from within the app settings, or by emailing us at <a href="mailto:pulsechat.help@gmail.com">pulsechat.help@gmail.com</a>.</p>

    <h2>7. Children's Privacy</h2>
    <p>PulseChat is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13.</p>

    <h2>8. Changes to This Privacy Policy</h2>
    <p>We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated effective date.</p>

    <h2>9. Contact Us</h2>
    <p>If you have questions or concerns regarding this Privacy Policy, please contact our support team:</p>
    <p><strong>Email:</strong> <a href="mailto:pulsechat.help@gmail.com">pulsechat.help@gmail.com</a><br>
    <strong>Developer:</strong> Prashant Sharma<br>
    <strong>App:</strong> PulseChat (com.pulsechat.app)</p>

    <div class="footer">
      &copy; 2026 PulseChat. All rights reserved.
    </div>
  </div>
</body>
</html>
`;

const termsHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terms of Service - PulseChat</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #111827;
      --accent: #3b82f6;
      --text: #e2e8f0;
      --muted: #94a3b8;
      --border: rgba(255,255,255,0.1);
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
      margin: 0;
      padding: 24px 16px;
    }
    .container {
      max-width: 820px;
      margin: 0 auto;
      background: var(--card-bg);
      padding: 32px 28px;
      border-radius: 20px;
      border: 1px solid var(--border);
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    }
    h1 { color: #fff; margin-top: 0; font-size: 1.85rem; font-weight: 800; border-bottom: 2px solid var(--accent); padding-bottom: 12px; }
    h2 { color: #60a5fa; margin-top: 28px; font-size: 1.25rem; font-weight: 700; }
    p, li { color: var(--muted); font-size: 0.95rem; }
    ul { padding-left: 20px; }
    li { margin-bottom: 8px; }
    a { color: #38bdf8; text-decoration: none; }
    .badge {
      display: inline-block;
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .footer {
      margin-top: 36px;
      padding-top: 20px;
      border-top: 1px solid var(--border);
      font-size: 0.85rem;
      color: #64748b;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">Legal Terms</div>
    <h1>Terms of Service for PulseChat</h1>
    <p><strong>Effective Date:</strong> September 30, 2026</p>
    <p>By downloading, installing, or using <strong>PulseChat</strong>, you agree to be bound by these Terms of Service. If you do not agree, please do not use the application.</p>

    <h2>1. Acceptable Use</h2>
    <p>You agree to use PulseChat for lawful purposes only. You must not:</p>
    <ul>
      <li>Harass, abuse, impersonate, or threaten other users.</li>
      <li>Distribute spam, malicious links, viruses, or unauthorized automated scripts.</li>
      <li>Post illegal, harmful, hateful, or copyrighted content without authorization.</li>
    </ul>

    <h2>2. Pulse VIP Pro Subscriptions</h2>
    <p>Pulse VIP Pro subscriptions unlock premium features including ad-free experience, custom badges, and 4K wallpapers. Subscriptions renew automatically unless cancelled before the end of the current billing cycle through your Google Play Store account.</p>

    <h2>3. Termination</h2>
    <p>We reserve the right to suspend or terminate accounts that violate our community guidelines or engage in fraudulent activities without prior notice.</p>

    <h2>4. Contact Us</h2>
    <p>For inquiries regarding these Terms, contact us at <a href="mailto:pulsechat.help@gmail.com">pulsechat.help@gmail.com</a>.</p>

    <div class="footer">
      &copy; 2026 PulseChat. All rights reserved.
    </div>
  </div>
</body>
</html>
`;

router.get('/privacy', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(privacyHtml);
});

router.get('/terms', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(termsHtml);
});

module.exports = router;
