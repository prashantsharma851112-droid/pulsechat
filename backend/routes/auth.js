const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const db = require('../database/db');
const authMiddleware = require('../middleware/authMiddleware');
const mailer = require('../utils/mailer');

// Helper to verify Google ID Token with Google OAuth2 API
async function verifyGoogleIdToken(idToken) {
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
  if (typeof fetch === 'function') {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Invalid Google token');
    return await res.json();
  }
  return new Promise((resolve, reject) => {
    const https = require('https');
    https.get(url, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          if (data.error || data.error_description) {
            reject(new Error(data.error_description || data.error));
          } else {
            resolve(data);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Live Username Availability Check
router.get('/check-username/:username', async (req, res) => {
  const username = req.params.username.toLowerCase().trim();
  const users = await db.getUsers();
  const exists = users.some(u => u.username.toLowerCase() === username);
  res.json({ available: !exists });
});

// Get Public Google Client ID
router.get('/google-client-id', (req, res) => {
  res.json({ clientId: process.env.GOOGLE_CLIENT_ID || '' });
});

// Register with Email, Password & Unique @username
router.post('/register', async (req, res) => {
  try {
    const { email, password, username, displayName } = req.body;

    if (!email || !password || !username || !displayName) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters.' });
    }

    const users = await db.getUsers();
    if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      return res.status(400).json({ error: 'Email already registered.' });
    }
    if (users.some(u => u.username.toLowerCase() === cleanUsername)) {
      return res.status(400).json({ error: 'Username is already taken.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate secure 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const newUser = {
      id: 'user_' + Date.now(),
      email: cleanEmail,
      username: cleanUsername,
      passwordHash,
      displayName: displayName.trim(),
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanUsername}`,
      status: 'Hey there! I am using PulseChat.',
      isEmailVerified: false,
      otpCode: otp,
      otpExpires,
      createdAt: new Date().toISOString()
    };

    await db.saveUser(newUser);

    // Send real OTP email to user's actual email address
    mailer.sendOtpEmail(cleanEmail, otp, displayName.trim()).catch(err => {
      console.error('[Registration Mail Error]', err);
    });

    // SECURITY: Do NOT return the OTP code or JWT token in response.
    // User must verify email code first to get authenticated!
    res.status(201).json({
      success: true,
      requiresVerification: true,
      message: 'Verification code sent to your email address.',
      email: cleanEmail,
      userId: newUser.id
    });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// Login via Email OR Username + Password
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Please enter Email/Username and Password.' });
    }

    const users = await db.getUsers();
    const cleanId = identifier.toLowerCase().trim().replace(/^@/, '');
    const user = users.find(u => u.email.toLowerCase() === cleanId || u.username.toLowerCase() === cleanId);

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials.' });
    }

    // STRICT SECURITY: If email is NOT verified, refuse login and require OTP verification!
    if (!user.isEmailVerified) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

      await db.updateUser(user.id, {
        otpCode: otp,
        otpExpires
      });

      mailer.sendOtpEmail(user.email, otp, user.displayName).catch(err => {
        console.error('[Login Unverified Mail Error]', err);
      });

      return res.status(403).json({
        requiresVerification: true,
        email: user.email,
        userId: user.id,
        error: 'Please verify your email address to continue. A 6-digit OTP code has been sent to your email.'
      });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      config.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { passwordHash: _, otpCode: __, ...userWithoutPass } = user;
    res.json({ token, user: userWithoutPass });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// Resend OTP Code for Email Verification
router.post('/resend-otp', async (req, res) => {
  try {
    const { email, userId } = req.body;
    if (!email && !userId) {
      return res.status(400).json({ error: 'Email or User ID is required.' });
    }

    const users = await db.getUsers();
    const cleanEmail = (email || '').toLowerCase().trim();
    const user = users.find(u => (userId && u.id === userId) || u.email.toLowerCase() === cleanEmail);

    if (!user) {
      return res.status(404).json({ error: 'Account not found with this email.' });
    }

    // Generate fresh OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await db.updateUser(user.id, {
      otpCode: otp,
      otpExpires
    });

    // Send real email
    mailer.sendOtpEmail(user.email, otp, user.displayName).catch(err => {
      console.error('[Resend OTP Mail Error]', err);
    });

    res.json({
      success: true,
      message: 'A fresh 6-digit verification code has been sent to your email.'
    });
  } catch (err) {
    console.error('Resend OTP Error:', err);
    res.status(500).json({ error: 'Failed to resend OTP code.' });
  }
});

// Request OTP for Email Verification (Alias / Compatibility)
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const cleanEmail = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: 'Invalid email address format.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const users = await db.getUsers();
    const existingUser = users.find(u => u.email.toLowerCase() === cleanEmail);

    if (existingUser) {
      await db.updateUser(existingUser.id, {
        otpCode: otp,
        otpExpires: new Date(Date.now() + 10 * 60 * 1000)
      });
      mailer.sendOtpEmail(cleanEmail, otp, existingUser.displayName).catch(err => {
        console.error('[Send OTP Mail Error]', err);
      });
    }

    // SECURITY: Do NOT expose the OTP code in the response
    res.json({ success: true, message: 'OTP verification code sent to your email.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send OTP.' });
  }
});

// Verify OTP & Activate Account / Log In
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp, userId } = req.body;
    if (!otp) return res.status(400).json({ error: 'OTP code is required.' });

    const users = await db.getUsers();
    const cleanEmail = (email || '').toLowerCase().trim();
    const user = users.find(u => (userId && u.id === userId) || u.email.toLowerCase() === cleanEmail);

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Check OTP expiration
    if (user.otpExpires && new Date() > new Date(user.otpExpires)) {
      return res.status(400).json({ error: 'OTP code has expired. Please click "Resend Code".' });
    }

    // Check OTP match
    if (!user.otpCode || user.otpCode !== otp.trim()) {
      return res.status(400).json({ error: 'Incorrect OTP code. Please check your email inbox.' });
    }

    // Mark user as verified and clear OTP
    const updated = await db.updateUser(user.id, {
      isEmailVerified: true,
      otpCode: null,
      otpExpires: null
    });

    // Issue JWT token now that email is verified!
    const token = jwt.sign(
      { id: updated.id, username: updated.username, email: updated.email },
      config.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { passwordHash: _, otpCode: __, ...safeUser } = updated;
    res.json({
      success: true,
      message: 'Email verified successfully!',
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Verify OTP Error:', err);
    res.status(500).json({ error: 'Failed to verify OTP.' });
  }
});

// Google Sign-In / OAuth Authentication
// Directly validates real Google accounts (already verified by Google)
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Google credential token is required.' });
    }

    // Verify token with Google's secure public endpoint
    const googlePayload = await verifyGoogleIdToken(credential);

    const googleEmail = (googlePayload.email || '').toLowerCase().trim();
    const isEmailVerified = googlePayload.email_verified === true || googlePayload.email_verified === 'true';

    if (!googleEmail || !isEmailVerified) {
      return res.status(400).json({ error: 'Google account does not have a verified email address.' });
    }

    const users = await db.getUsers();
    let user = users.find(u => u.email.toLowerCase() === googleEmail);

    if (user) {
      // Existing user: ensure marked verified and avatar updated if empty
      const updates = {};
      if (!user.isEmailVerified) updates.isEmailVerified = true;
      if (!user.avatar && googlePayload.picture) updates.avatar = googlePayload.picture;

      if (Object.keys(updates).length > 0) {
        user = await db.updateUser(user.id, updates);
      }
    } else {
      // New user registering via Google: create account immediately with verified status
      const cleanBase = (googleEmail.split('@')[0] || 'user').toLowerCase().replace(/[^a-z0-9_]/g, '');
      let candidateUsername = cleanBase;
      let counter = 1;
      while (users.some(u => u.username.toLowerCase() === candidateUsername)) {
        candidateUsername = `${cleanBase}${counter++}`;
      }

      // Secure random password hash so account cannot be password-guessed
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(randomPassword, salt);

      const newUser = {
        id: 'user_' + Date.now(),
        email: googleEmail,
        username: candidateUsername,
        passwordHash,
        displayName: googlePayload.name || candidateUsername,
        avatar: googlePayload.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${candidateUsername}`,
        status: 'Hey there! I am using PulseChat.',
        isEmailVerified: true,
        createdAt: new Date().toISOString()
      };

      await db.saveUser(newUser);
      user = newUser;
    }

    // Sign JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      config.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { passwordHash: _, otpCode: __, ...safeUser } = user;
    res.json({
      success: true,
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Google Auth Error:', err);
    res.status(400).json({ error: 'Google authentication failed: ' + (err.message || 'Invalid token') });
  }
});

// Verify Current Session
router.get('/me', authMiddleware, async (req, res) => {
  const users = await db.getUsers();
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const { passwordHash: _, otpCode: __, ...userWithoutPass } = user;
  res.json({ user: userWithoutPass });
});

module.exports = router;
