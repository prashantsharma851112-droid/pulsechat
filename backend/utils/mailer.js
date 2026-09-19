const nodemailer = require('nodemailer');

/**
 * Send OTP Verification Email using nodemailer (reliable, production-ready)
 */
async function sendOtpEmail(recipientEmail, otpCode, displayName = 'PulseChat User') {
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = Number(process.env.SMTP_PORT || 465);
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>PulseChat Verification Code</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 24px; color: #f8fafc; }
        .card { max-width: 480px; margin: 0 auto; background: #1e293b; border: 1px solid #334155; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .header { background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%); padding: 28px; text-align: center; }
        .header h1 { margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
        .content { padding: 32px 28px; text-align: center; }
        .greeting { font-size: 16px; color: #94a3b8; margin-bottom: 20px; }
        .code-box { background: #0f172a; border: 2px dashed #6366f1; border-radius: 12px; padding: 18px 24px; display: inline-block; margin: 16px 0 24px 0; }
        .code { font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #818cf8; font-family: monospace; }
        .info { font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 20px; }
        .footer { border-top: 1px solid #334155; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>&#9889; PulseChat Security</h1>
        </div>
        <div class="content">
          <p class="greeting">Hello ${displayName},</p>
          <p class="info">Use the 6-digit verification code below to confirm your email address and activate your account:</p>
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

  const textContent = `Hello ${displayName},\n\nYour PulseChat verification code is: ${otpCode}\n\nThis code expires in 10 minutes.\nIf you did not request this, you can safely ignore this message.`;

  if (!user || !pass) {
    console.warn('⚠️ [PulseChat Mailer] SMTP_USER and SMTP_PASS not set in .env! Emails cannot be sent.');
    console.log(`👉 [DEV NOTICE] Add to backend/.env:\nSMTP_HOST=smtp.gmail.com\nSMTP_PORT=465\nSMTP_USER=your_email@gmail.com\nSMTP_PASS=your_16_char_app_password`);
    return { success: false, error: 'SMTP credentials not configured', delivered: false };
  }

  console.log(`📧 [PulseChat Mailer] Sending OTP to: ${recipientEmail} via ${host}:${port}...`);

  // Try configured port first, then fallback
  const portConfigs = [
    { port, secure: port === 465 },
    { port: port === 465 ? 587 : 465, secure: port !== 465 }
  ];

  let lastErr = null;
  for (const config of portConfigs) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port: config.port,
        secure: config.secure, // true for 465, false for 587 (STARTTLS)
        auth: { user, pass },
        connectionTimeout: 20000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
        tls: { rejectUnauthorized: false }
      });

      await transporter.sendMail({
        from: `"PulseChat Security" <${user}>`,
        to: recipientEmail,
        subject: `${otpCode} is your PulseChat verification code`,
        text: textContent,
        html: htmlContent
      });

      console.log(`✅ [PulseChat Mailer] Email delivered to: ${recipientEmail} via port ${config.port}`);
      return { success: true, delivered: true };
    } catch (err) {
      console.error(`❌ [PulseChat Mailer] Port ${config.port} failed: ${err.message}`);
      lastErr = err;
    }
  }

  return { success: false, error: lastErr?.message || 'Email delivery failed', delivered: false };
}

module.exports = { sendOtpEmail };
