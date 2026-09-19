const tls = require('tls');
const net = require('net');

/**
 * Send an email via SMTP (supports SSL port 465 and STARTTLS port 587)
 * using Node.js standard library (no external npm dependencies required).
 */
function sendSmtpEmail({ host, port, user, pass, to, subject, html, text }) {
  return new Promise((resolve, reject) => {
    const isDirectSsl = Number(port) === 465;
    let socket;
    let buffer = '';
    let step = 0;

    const cleanup = () => {
      if (socket && !socket.destroyed) {
        socket.end();
      }
    };

    const onData = (data) => {
      buffer += data.toString();
      const lines = buffer.split('\r\n');
      buffer = lines.pop(); // keep last incomplete line

      for (const line of lines) {
        if (!line) continue;
        const code = parseInt(line.substring(0, 3), 10);
        // Multiline responses have '-' after the code (e.g., 250-8BITMIME)
        const isLastLine = line.charAt(3) === ' ';

        if (!isLastLine && !isNaN(code)) continue;

        handleSmtpStep(code, line);
      }
    };

    const sendCmd = (cmd) => {
      if (socket && !socket.destroyed) {
        socket.write(cmd + '\r\n');
      }
    };

    const handleSmtpStep = (code, line) => {
      if (code >= 400) {
        cleanup();
        return reject(new Error(`SMTP Error [${code}]: ${line}`));
      }

      switch (step) {
        case 0: // Server greeting (220)
          step = 1;
          sendCmd(`EHLO ${host || 'localhost'}`);
          break;

        case 1: // Response to EHLO (250)
          if (isDirectSsl || socket instanceof tls.TLSSocket) {
            // Already secure, proceed to AUTH LOGIN
            step = 3;
            sendCmd('AUTH LOGIN');
          } else {
            // Upgrade via STARTTLS
            step = 2;
            sendCmd('STARTTLS');
          }
          break;

        case 2: // Response to STARTTLS (220)
          // Upgrade plain socket to TLS
          socket.removeAllListeners('data');
          socket = tls.connect({ socket, host, rejectUnauthorized: false }, () => {
            socket.on('data', onData);
            step = 1; // Resend EHLO inside TLS
            sendCmd(`EHLO ${host || 'localhost'}`);
          });
          socket.on('error', (err) => {
            cleanup();
            reject(err);
          });
          break;

        case 3: // Response to AUTH LOGIN (334) -> send Base64 username
          step = 4;
          sendCmd(Buffer.from(user).toString('base64'));
          break;

        case 4: // Response to username (334) -> send Base64 password
          step = 5;
          sendCmd(Buffer.from(pass).toString('base64'));
          break;

        case 5: // Response to password (235 Authentication succeeded)
          step = 6;
          sendCmd(`MAIL FROM:<${user}>`);
          break;

        case 6: // Response to MAIL FROM (250)
          step = 7;
          sendCmd(`RCPT TO:<${to}>`);
          break;

        case 7: // Response to RCPT TO (250)
          step = 8;
          sendCmd('DATA');
          break;

        case 8: // Response to DATA (354) -> send message content
          step = 9;
          const mimeBoundary = '====PulseChatBoundary_' + Date.now();
          const emailData = [
            `From: "PulseChat Security" <${user}>`,
            `To: <${to}>`,
            `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
            `MIME-Version: 1.0`,
            `Content-Type: multipart/alternative; boundary="${mimeBoundary}"`,
            '',
            `--${mimeBoundary}`,
            `Content-Type: text/plain; charset=utf-8`,
            '',
            text || 'Your PulseChat verification code is inside this email.',
            '',
            `--${mimeBoundary}`,
            `Content-Type: text/html; charset=utf-8`,
            '',
            html,
            '',
            `--${mimeBoundary}--`,
            '.',
            ''
          ].join('\r\n');

          sendCmd(emailData);
          break;

        case 9: // Response to message data (250 OK)
          step = 10;
          sendCmd('QUIT');
          cleanup();
          resolve({ success: true, message: 'Email sent successfully via SMTP' });
          break;
      }
    };

    try {
      if (isDirectSsl) {
        socket = tls.connect(
          { host, port: Number(port), rejectUnauthorized: false },
          () => {
            socket.on('data', onData);
          }
        );
      } else {
        socket = net.connect(
          { host, port: Number(port || 587) },
          () => {
            socket.on('data', onData);
          }
        );
      }

      socket.setTimeout(25000, () => {
        cleanup();
        reject(new Error('SMTP Connection Timed Out after 25s'));
      });

      socket.on('error', (err) => {
        cleanup();
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Send OTP Verification Email
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
          <h1>⚡ PulseChat Security</h1>
        </div>
        <div class="content">
          <p class="greeting">Hello ${displayName},</p>
          <p class="info">Use the 6-digit verification code below to confirm your email address and activate your account:</p>
          <div class="code-box">
            <span class="code">${otpCode}</span>
          </div>
          <p class="info">⏱️ This code will expire in <strong>10 minutes</strong>.<br>If you didn't request this verification code, please disregard this email.</p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} PulseChat Inc. • End-to-End Encrypted Real-Time Messaging
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `Hello ${displayName},\n\nYour PulseChat verification code is: ${otpCode}\n\nThis code expires in 10 minutes.\nIf you did not request this, you can safely ignore this message.`;

  // If SMTP credentials are configured, send real email!
  if (user && pass) {
    try {
      console.log(`📧 [PulseChat Mailer] Sending real OTP email to: ${recipientEmail} via ${host}:${port}...`);
      await sendSmtpEmail({
        host,
        port,
        user,
        pass,
        to: recipientEmail,
        subject: `${otpCode} is your PulseChat verification code`,
        html: htmlContent,
        text: textContent
      });
      console.log(`✅ [PulseChat Mailer] Real OTP email successfully delivered to: ${recipientEmail}`);
      return { success: true, delivered: true };
    } catch (err) {
      console.error(`❌ [PulseChat Mailer] Port ${port} failed (${err.message}). Retrying via fallback port...`);
      const fallbackPort = port === 465 ? 587 : 465;
      try {
        await sendSmtpEmail({
          host,
          port: fallbackPort,
          user,
          pass,
          to: recipientEmail,
          subject: `${otpCode} is your PulseChat verification code`,
          html: htmlContent,
          text: textContent
        });
        console.log(`✅ [PulseChat Mailer] Real OTP email successfully delivered via fallback port ${fallbackPort} to: ${recipientEmail}`);
        return { success: true, delivered: true };
      } catch (fallbackErr) {
        console.error(`❌ [PulseChat Mailer] SMTP delivery failed on both ports. Error:`, fallbackErr.message);
        return { success: false, error: fallbackErr.message, delivered: false };
      }
    }
  } else {
    // If SMTP credentials are not set in .env yet, log clear instructions in console
    console.warn(`⚠️ [PulseChat Mailer] SMTP_USER and SMTP_PASS not set in backend/.env!`);
    console.log(`👉 [DEVELOPER NOTICE] To send real emails, add to backend/.env:\nSMTP_USER=your-email@gmail.com\nSMTP_PASS=your-16-char-app-password\n`);
    return { success: false, error: 'SMTP credentials not configured in backend/.env', delivered: false };
  }
}

module.exports = {
  sendSmtpEmail,
  sendOtpEmail
};
