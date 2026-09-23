const nodemailer = require('nodemailer');
const https = require('https');

/**
 * Perform HTTPS POST request (works across all Node.js versions without extra dependencies)
 */
async function postJson(urlStr, headers, bodyObj) {
  const bodyData = JSON.stringify(bodyObj);

  if (typeof fetch === 'function') {
    try {
      const res = await fetch(urlStr, {
        method: 'POST',
        headers,
        body: bodyData
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
      return { ok: res.ok, status: res.status, data };
    } catch (fetchErr) {
      return { ok: false, status: 0, data: { message: fetchErr.message } };
    }
  }

  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyData)
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        let data;
        try {
          data = JSON.parse(raw);
        } catch {
          data = { raw };
        }
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          data
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('HTTPS request timed out'));
    });

    req.on('error', reject);
    req.write(bodyData);
    req.end();
  });
}

/**
 * Check which email providers are configured in environment
 */
function getMailConfigStatus() {
  const brevoKey = (process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || '').trim();
  const resendKey = (process.env.RESEND_API_KEY || '').trim();
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();

  return {
    brevo: Boolean(brevoKey),
    resend: Boolean(resendKey),
    smtp: Boolean(smtpUser && smtpPass),
    smtpUser: smtpUser ? `${smtpUser.slice(0, 3)}***@${smtpUser.split('@')[1] || ''}` : null
  };
}

/**
 * 1. Brevo REST API (HTTPS Port 443) - 100% Reliable on Render Free Tier
 * Free: 300 emails/day forever. Never blocked by Render or any cloud host.
 */
async function sendViaBrevo(recipientEmail, otpCode, displayName, htmlContent, textContent, subject) {
  const apiKey = (process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || '').trim();
  if (!apiKey) return { success: false, skipped: true, error: 'BREVO_API_KEY not set' };

  const senderEmail = (process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER || 'noreply.pulsechat@gmail.com').trim();
  const senderName = process.env.BREVO_SENDER_NAME || 'PulseChat Security';
  const mailSubject = subject || `${otpCode} is your PulseChat verification code`;

  console.log(`📧 [Brevo] Initiating delivery to ${recipientEmail}...`);

  // 1. First attempt: Brevo REST API (HTTPS Port 443 - Bypasses Render Port Blocks)
  try {
    const res = await postJson(
      'https://api.brevo.com/v3/smtp/email',
      {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      {
        sender: { name: senderName, email: senderEmail },
        to: [{ email: recipientEmail, name: displayName }],
        subject: mailSubject,
        htmlContent,
        textContent
      }
    );

    if (res.ok) {
      console.log(`✅ [Brevo API] OTP email successfully delivered to ${recipientEmail}! Message ID: ${res.data?.messageId}`);
      return { success: true, provider: 'brevo-api', messageId: res.data?.messageId, delivered: true };
    }

    const errDetail = res.data?.message || JSON.stringify(res.data) || `HTTP ${res.status}`;
    console.warn(`⚠️ [Brevo API Warning]: ${errDetail}`);

    // If key starts with xsmtpsib, it's an SMTP key rather than REST API key
    if (apiKey.startsWith('xsmtpsib-')) {
      console.log(`ℹ️ [Brevo Notice]: Provided key starts with 'xsmtpsib-' (SMTP Key). Attempting Brevo SMTP Relay fallback...`);
      
      // Attempt Brevo SMTP Relay
      try {
        const transporter = nodemailer.createTransport({
          host: 'smtp-relay.brevo.com',
          port: 587,
          secure: false,
          auth: {
            user: senderEmail,
            pass: apiKey
          },
          connectionTimeout: 6000,
          socketTimeout: 8000,
          greetingTimeout: 6000
        });

        await transporter.sendMail({
          from: `"${senderName}" <${senderEmail}>`,
          to: recipientEmail,
          subject: `${otpCode} is your PulseChat verification code`,
          text: textContent,
          html: htmlContent
        });

        console.log(`✅ [Brevo SMTP Relay] OTP email successfully sent to ${recipientEmail}!`);
        return { success: true, provider: 'brevo-smtp', delivered: true };
      } catch (smtpErr) {
        console.error(`❌ [Brevo SMTP Relay Error]: ${smtpErr.message}`);
        return {
          success: false,
          error: `Brevo SMTP Relay failed: ${smtpErr.message}. On Render Free Tier, SMTP is blocked! Please generate an API Key (starts with xkeysib-) in Brevo under 'API Keys' tab.`
        };
      }
    }

    return { success: false, error: `Brevo API error: ${errDetail}` };
  } catch (err) {
    console.error(`❌ [Brevo Exception]: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * 2. Resend REST API (HTTPS Port 443)
 */
async function sendViaResend(recipientEmail, otpCode, displayName, htmlContent, textContent, subject) {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) return { success: false, skipped: true, error: 'RESEND_API_KEY not set' };

  const sender = (process.env.RESEND_FROM || 'PulseChat <onboarding@resend.dev>').trim();
  const mailSubject = subject || `${otpCode} is your PulseChat verification code`;
  console.log(`📧 [Resend API] Sending OTP to ${recipientEmail} via HTTPS...`);

  try {
    const res = await postJson(
      'https://api.resend.com/emails',
      {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      {
        from: sender,
        to: recipientEmail,
        subject: mailSubject,
        html: htmlContent,
        text: textContent
      }
    );

    if (!res.ok) {
      const errDetail = res.data?.message || JSON.stringify(res.data) || `HTTP ${res.status}`;
      console.error(`❌ [Resend API Error]: ${errDetail}`);
      return { success: false, error: `Resend API error: ${errDetail}` };
    }

    console.log(`✅ [Resend API] OTP email successfully sent to ${recipientEmail}! ID: ${res.data?.id}`);
    return { success: true, provider: 'resend', id: res.data?.id, delivered: true };
  } catch (err) {
    console.error(`❌ [Resend API Exception]: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * 3. Direct SMTP / Nodemailer
 * Works on localhost & VPS. On Render Free Tier, SMTP ports 25, 465, 587 are blocked.
 */
async function sendViaSmtp(recipientEmail, otpCode, displayName, htmlContent, textContent, subject) {
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
  if (!user || !pass) return { success: false, skipped: true, error: 'SMTP credentials not configured' };

  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const isGmail = host.includes('gmail.com');
  const mailSubject = subject || `${otpCode} is your PulseChat verification code`;

  console.log(`📧 [SMTP] Attempting to send OTP to ${recipientEmail} via ${isGmail ? 'Gmail Service' : host}...`);

  // Try standard service for Gmail first (avoids TLS cipher issues)
  const configs = isGmail
    ? [
        { service: 'gmail', auth: { user, pass }, connectionTimeout: 6000, socketTimeout: 8000, greetingTimeout: 6000 },
        { host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass }, connectionTimeout: 6000, socketTimeout: 8000, greetingTimeout: 6000, tls: { rejectUnauthorized: false } }
      ]
    : [
        {
          host,
          port: Number(process.env.SMTP_PORT || 465),
          secure: Number(process.env.SMTP_PORT || 465) === 465,
          auth: { user, pass },
          connectionTimeout: 6000,
          socketTimeout: 8000,
          greetingTimeout: 6000,
          tls: { rejectUnauthorized: false }
        }
      ];

  let lastErr = null;
  for (const transportConfig of configs) {
    try {
      const transporter = nodemailer.createTransport(transportConfig);
      await transporter.sendMail({
        from: `"PulseChat Security" <${user}>`,
        to: recipientEmail,
        subject: mailSubject,
        text: textContent,
        html: htmlContent
      });

      console.log(`✅ [SMTP] OTP email successfully sent to ${recipientEmail}!`);
      return { success: true, provider: 'smtp', delivered: true };
    } catch (err) {
      console.warn(`⚠️ [SMTP Attempt Failed]: ${err.message}`);
      lastErr = err;
    }
  }

  return { success: false, error: lastErr?.message || 'SMTP delivery failed' };
}

/**
 * Main OTP Sending Function: Multi-Provider with Automatic Fallback
 */
async function sendOtpEmail(recipientEmail, otpCode, displayName = 'PulseChat User', purpose = 'verification') {
  const isReset = purpose === 'reset';
  const subject = isReset
    ? `${otpCode} is your PulseChat password reset code`
    : `${otpCode} is your PulseChat verification code`;
  const actionText = isReset
    ? 'Use the 6-digit verification code below to reset your PulseChat account password:'
    : 'Use the 6-digit verification code below to confirm your email address and activate your account:';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 24px; color: #f8fafc; }
        .card { max-width: 480px; margin: 0 auto; background: #1e293b; border: 1px solid #334155; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .header { background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%); padding: 28px; text-align: center; }
        .header h1 { margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
        .content { padding: 32px 28px; text-align: center; }
        .greeting { font-size: 16px; color: #94a3b8; margin-bottom: 20px; }
        .code-box { background: #0f172a; border: 2px dashed #6366f1; border-radius: 12px; padding: 18px 24px; display: inline-block; margin: 16px 0 24px 0; }
        .code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #818cf8; font-family: monospace; }
        .info { font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 20px; }
        .footer { border-top: 1px solid #334155; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>PulseChat Security</h1>
        </div>
        <div class="content">
          <p class="greeting">Hello ${displayName},</p>
          <p class="info">${actionText}</p>
          <div class="code-box">
            <span class="code">${otpCode}</span>
          </div>
          <p class="info">&#9203; This code will expire in <strong>10 minutes</strong>.<br>If you did not request this verification code, please disregard this email.</p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} PulseChat Inc. &bull; Real-Time Messaging
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `Hello ${displayName},\n\nYour PulseChat verification code is: ${otpCode}\n\n${actionText}\nThis code expires in 10 minutes.\nIf you did not request this, you can safely ignore this message.`;

  const configStatus = getMailConfigStatus();

  // 1. Try Brevo HTTPS REST API first (recommended for Render free tier)
  if (configStatus.brevo) {
    const brevoRes = await sendViaBrevo(recipientEmail, otpCode, displayName, htmlContent, textContent, subject);
    if (brevoRes.success) return brevoRes;
  }

  // 2. Try Resend HTTPS REST API next
  if (configStatus.resend) {
    const resendRes = await sendViaResend(recipientEmail, otpCode, displayName, htmlContent, textContent, subject);
    if (resendRes.success) return resendRes;
  }

  // 3. Try SMTP (Nodemailer)
  if (configStatus.smtp) {
    const smtpRes = await sendViaSmtp(recipientEmail, otpCode, displayName, htmlContent, textContent, subject);
    if (smtpRes.success) return smtpRes;
  }

  // If no providers are configured or all attempts failed:
  let failureReason = 'No email provider is currently configured';
  if (configStatus.brevo || configStatus.resend || configStatus.smtp) {
    failureReason = 'Configured email providers failed to send the email';
  }

  console.error(`\n🚨 ================================================================`);
  console.error(`❌ [PulseChat Mailer] FAILED TO DELIVER OTP TO: ${recipientEmail}`);
  console.error(`👉 REASON: ${failureReason}`);
  console.error(`👉 ACTIVE CONFIG: ${JSON.stringify(configStatus)}`);
  console.error(`🔑 FALLBACK OTP CODE FOR [${recipientEmail}] IS: [ ${otpCode} ]`);
  if (!configStatus.brevo) {
    console.error(`💡 [HOW TO FIX ON RENDER]:`);
    console.error(`   Render Free Tier blocks SMTP ports 25, 465, 587.`);
    console.error(`   To get 100% email delivery, create a free account on https://www.brevo.com`);
    console.error(`   Generate an API key under 'SMTP & API Keys' and add to Render:`);
    console.error(`   BREVO_API_KEY=xkeysib-your-key-here`);
    console.error(`   BREVO_SENDER_EMAIL=your_email@gmail.com`);
  }
  console.error(`================================================================\n`);

  return {
    success: false,
    delivered: false,
    error: failureReason,
    configStatus
  };
}

module.exports = {
  sendOtpEmail,
  getMailConfigStatus
};
