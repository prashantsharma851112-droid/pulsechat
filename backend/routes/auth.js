const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const db = require('../database/db');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const mailer = require('../utils/mailer');

// Helper to send OTP mail with fast 2.5s response guarantee
const safeSendOtpMail = async (email, otp, name, purpose = 'verification') => {
  try {
    const mailPromise = mailer.sendOtpEmail(email, otp, name, purpose);
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ delivered: false, timeout: true }), 2500));
    return await Promise.race([mailPromise, timeoutPromise]);
  } catch (err) {
    return { delivered: false, error: err.message };
  }
};

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

// Live Username Availability Check (instant index lookup)
router.get('/check-username/:username', async (req, res) => {
  const username = req.params.username.toLowerCase().trim();
  const exists = await User.exists({ username });
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
      return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
    }

    // Check BOTH username and email in database
    const existingUsername = await User.findOne({ username: cleanUsername });
    const existingEmail = await User.findOne({ email: cleanEmail });

    // 1. If username is already verified on an account
    if (existingUsername && existingUsername.isEmailVerified) {
      if (existingUsername.email !== cleanEmail) {
        return res.status(400).json({ error: 'This username is already taken. Please choose another username.' });
      } else {
        return res.status(400).json({ error: 'An account with this username and email already exists. Please log in.' });
      }
    }

    // 2. If email is already verified on an account
    if (existingEmail && existingEmail.isEmailVerified) {
      return res.status(400).json({ error: 'This email address is already registered. Please sign in or use "Forgot Password".' });
    }

    // Generate secure 6-digit OTP & password hash
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    let targetUserId = null;

    // 3. If unverified account with this email already exists: update it with new details & fresh OTP
    if (existingEmail && !existingEmail.isEmailVerified) {
      // Check if username is taken by another verified user
      if (existingUsername && existingUsername.id !== existingEmail.id && existingUsername.isEmailVerified) {
        return res.status(400).json({ error: 'This username is already taken. Please choose another username.' });
      }

      targetUserId = existingEmail.id;
      await db.updateUser(existingEmail.id, {
        username: cleanUsername,
        passwordHash,
        displayName: displayName.trim(),
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanUsername}`,
        otpCode: otp,
        otpExpires
      });
    }
    // 4. If unverified account with this username exists: update it with new email & fresh OTP
    else if (existingUsername && !existingUsername.isEmailVerified) {
      targetUserId = existingUsername.id;
      await db.updateUser(existingUsername.id, {
        email: cleanEmail,
        passwordHash,
        displayName: displayName.trim(),
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanUsername}`,
        otpCode: otp,
        otpExpires
      });
    }
    // 5. Fresh registration: create new user document
    else {
      targetUserId = 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const newUser = {
        id: targetUserId,
        email: cleanEmail,
        username: cleanUsername,
        passwordHash,
        displayName: displayName.trim(),
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanUsername}`,
        status: 'Hey there! I am using PulseChat.',
        isEmailVerified: false,
        otpCode: otp,
        otpExpires,
        pulseSparks: 50,
        hasUsed3DTrial: false,
        claimedFreeSparks: {},
        createdAt: new Date().toISOString()
      };

      await db.saveUser(newUser);
    }

    // Send real OTP email to user's actual email address safely
    let mailResult = { delivered: false };
    try {
      mailResult = await safeSendOtpMail(cleanEmail, otp, displayName.trim());
    } catch (mailErr) {
      console.warn('sendOtpEmail warning during registration:', mailErr.message);
      mailResult = { delivered: false, error: mailErr.message };
    }

    res.status(200).json({
      success: true,
      requiresVerification: true,
      message: mailResult.delivered
        ? 'Verification code sent to your email address.'
        : 'Verification code generated.',
      email: cleanEmail,
      userId: targetUserId,
      emailDelivered: mailResult.delivered,
      fallbackOtp: !mailResult.delivered ? otp : undefined,
      mailError: !mailResult.delivered ? mailResult.error : undefined
    });
  } catch (err) {
    console.error('Registration Error:', err);

    // MongoDB duplicate key error handling
    if (err.code === 11000 || err.name === 'MongoServerError') {
      const errStr = (err.message || '') + JSON.stringify(err.keyPattern || err.keyValue || {});
      if (errStr.includes('email')) {
        return res.status(400).json({ error: 'This email is already registered. Please sign in or use "Forgot Password".' });
      }
      if (errStr.includes('username')) {
        return res.status(400).json({ error: 'This username is already taken. Please choose another username.' });
      }
      return res.status(400).json({ error: 'An account with these details already exists. Please sign in.' });
    }

    res.status(500).json({ error: err.message || 'Server error during registration.' });
  }
});

// Login via Email OR Username + Password
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Please enter Email/Username and Password.' });
    }

    const cleanId = identifier.toLowerCase().trim().replace(/^@/, '');
    const candidates = await User.find({
      $or: [
        { email: cleanId },
        { username: cleanId },
        { email: new RegExp('^' + cleanId + '$', 'i') },
        { username: new RegExp('^' + cleanId + '$', 'i') }
      ]
    });

    if (!candidates || candidates.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials. User not found.' });
    }

    let user = null;
    for (const cand of candidates) {
      if (!cand.passwordHash) continue;
      try {
        const match = await bcrypt.compare(password, cand.passwordHash);
        if (match) {
          user = cand;
          break;
        }
      } catch (bcryptErr) {
        console.warn('bcrypt compare error on candidate:', bcryptErr.message);
      }
    }

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials. Incorrect password.' });
    }

    // STRICT SECURITY: If email is NOT verified, refuse login and require OTP verification!
    if (!user.isEmailVerified) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

      await db.updateUser(user.id, {
        otpCode: otp,
        otpExpires
      });

      let mailResult = { delivered: false };
      try {
        mailResult = await safeSendOtpMail(user.email, otp, user.displayName);
      } catch (mailErr) {
        console.warn('Login sendOtpEmail error:', mailErr.message);
        mailResult = { delivered: false, error: mailErr.message };
      }

      return res.status(403).json({
        requiresVerification: true,
        email: user.email,
        userId: user.id,
        error: 'Please verify your email address to continue. A 6-digit OTP code has been sent to your email.',
        emailDelivered: mailResult.delivered,
        fallbackOtp: !mailResult.delivered ? otp : undefined,
        mailError: !mailResult.delivered ? mailResult.error : undefined
      });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      config.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.passwordHash;
    delete userObj.otpCode;
    delete userObj.otpExpires;

    res.json({ token, user: userObj });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: err.message || 'Server error during login.' });
  }
});

// Resend OTP Code for Email Verification
router.post('/resend-otp', async (req, res) => {
  try {
    const { email, userId } = req.body;
    if (!email && !userId) {
      return res.status(400).json({ error: 'Email or User ID is required.' });
    }

    const cleanEmail = (email || '').toLowerCase().trim();
    let user = null;
    if (userId) {
      const mongoose = require('mongoose');
      const isObjectId = mongoose.Types.ObjectId.isValid(userId);
      user = await User.findOne(isObjectId ? { $or: [{ id: userId }, { _id: userId }] } : { id: userId });
    }
    if (!user && cleanEmail) {
      user = await User.findOne({ email: cleanEmail });
    }

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

    // Send real email safely
    let mailResult = { delivered: false };
    try {
      mailResult = await safeSendOtpMail(user.email, otp, user.displayName);
    } catch (mailErr) {
      console.warn('Resend OTP sendOtpEmail error:', mailErr.message);
      mailResult = { delivered: false, error: mailErr.message };
    }

    res.json({
      success: true,
      message: mailResult.delivered
        ? 'A fresh 6-digit verification code has been sent to your email.'
        : 'A fresh verification code has been generated.',
      emailDelivered: mailResult.delivered,
      fallbackOtp: !mailResult.delivered ? otp : undefined,
      mailError: !mailResult.delivered ? mailResult.error : undefined
    });
  } catch (err) {
    console.error('Resend OTP Error:', err);
    res.status(500).json({ error: err.message || 'Failed to resend OTP code.' });
  }
});

// Diagnostic Test Endpoint: verify email sending via browser / curl
router.get('/test-email', async (req, res) => {
  try {
    const to = (req.query.to || process.env.SMTP_USER || process.env.BREVO_SENDER_EMAIL || '').trim();
    if (!to) {
      return res.status(400).json({
        error: 'Query param "to" is required, e.g. /api/auth/test-email?to=your_email@gmail.com',
        configStatus: mailer.getMailConfigStatus()
      });
    }

    const testOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const result = await mailer.sendOtpEmail(to, testOtp, 'PulseChat Tester');

    res.json({
      testSentTo: to,
      result,
      configStatus: mailer.getMailConfigStatus(),
      help: !result.success
        ? 'If hosted on Render Free Tier, SMTP ports 25, 465, 587 are blocked. Add BREVO_API_KEY to Render Environment Variables for 100% email delivery via HTTPS.'
        : 'OTP email sent successfully!'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    const existingUser = await User.findOne({ email: cleanEmail });

    let mailResult = { delivered: false };
    if (existingUser) {
      await db.updateUser(existingUser.id, {
        otpCode: otp,
        otpExpires: new Date(Date.now() + 10 * 60 * 1000)
      });
      try {
        mailResult = await safeSendOtpMail(cleanEmail, otp, existingUser.displayName);
      } catch (mailErr) {
        console.warn('sendOtpEmail warning in send-otp:', mailErr.message);
        mailResult = { delivered: false, error: mailErr.message };
      }
    }

    res.json({
      success: true,
      message: mailResult.delivered ? 'OTP verification code sent to your email.' : 'OTP generated.',
      emailDelivered: mailResult.delivered,
      fallbackOtp: !mailResult.delivered ? otp : undefined
    });
  } catch (err) {
    console.error('Send OTP Error:', err);
    res.status(500).json({ error: err.message || 'Failed to send OTP.' });
  }
});

// Verify OTP & Activate Account / Log In
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp, userId } = req.body;
    if (!otp) return res.status(400).json({ error: 'OTP code is required.' });

    const cleanEmail = (email || '').toLowerCase().trim();
    let user = null;
    if (userId) {
      const mongoose = require('mongoose');
      const isObjectId = mongoose.Types.ObjectId.isValid(userId);
      user = await User.findOne(isObjectId ? { $or: [{ id: userId }, { _id: userId }] } : { id: userId });
    }
    if (!user && cleanEmail) {
      user = await User.findOne({ email: cleanEmail });
    }

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
    const targetId = user.id || user._id;
    let updated = await db.updateUser(targetId, {
      isEmailVerified: true,
      otpCode: null,
      otpExpires: null
    });

    if (!updated) {
      user.isEmailVerified = true;
      user.otpCode = null;
      user.otpExpires = null;
      await user.save();
      updated = user.toObject ? user.toObject() : user;
    }

    // Issue JWT token now that email is verified!
    const token = jwt.sign(
      { id: updated.id || user.id, username: updated.username || user.username, email: updated.email || user.email },
      config.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const safeUser = updated.toObject ? updated.toObject() : { ...updated };
    delete safeUser.passwordHash;
    delete safeUser.otpCode;
    delete safeUser.otpExpires;
    safeUser.isEmailVerified = true;

    // Invalidate Redis RAM caches so Discover Pulses and suggestions refresh immediately
    try {
      const redis = require('../utils/redis');
      redis.invalidateAllRecent().catch(() => {});
    } catch {}

    // Broadcast new user to all connected clients in real time
    const io = req.app.get('io');
    if (io) {
      io.emit('new_user_registered', {
        id: safeUser.id,
        username: safeUser.username,
        displayName: safeUser.displayName,
        avatar: safeUser.avatar || '',
        status: safeUser.status || 'Hey there! I am using PulseChat.',
        isEmailVerified: true,
        isPro: Boolean(safeUser.isPro),
        proTier: safeUser.proTier || 'none',
        customBadge: safeUser.customBadge || '',
        pulseSparks: safeUser.pulseSparks || 50,
        email: safeUser.email,
        createdAt: safeUser.createdAt
      });
    }

    res.json({
      success: true,
      message: 'Email verified successfully!',
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Verify OTP Error:', err);
    res.status(500).json({ error: err.message || 'Failed to verify OTP.' });
  }
});

// Request Password Reset OTP
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Please enter your registered email address.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(404).json({ error: 'No account found with this email address.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.updateUser(user.id, {
      otpCode: otp,
      otpExpires
    });

    let mailResult = { delivered: false };
    try {
      mailResult = await safeSendOtpMail(cleanEmail, otp, user.displayName, 'reset');
    } catch (mailErr) {
      console.warn('sendOtpEmail warning in forgot-password:', mailErr.message);
      mailResult = { delivered: false, error: mailErr.message };
    }

    res.json({
      success: true,
      message: mailResult.delivered
        ? 'A 6-digit password reset code has been sent to your email.'
        : 'Password reset code generated.',
      email: cleanEmail,
      userId: user.id,
      emailDelivered: mailResult.delivered,
      fallbackOtp: !mailResult.delivered ? otp : undefined,
      mailError: !mailResult.delivered ? mailResult.error : undefined
    });
  } catch (err) {
    console.error('Forgot Password Error:', err);
    res.status(500).json({ error: err.message || 'Server error while processing password reset request.' });
  }
});

// Verify OTP & Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, verification code, and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (user.otpExpires && new Date() > new Date(user.otpExpires)) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
    }

    if (!user.otpCode || user.otpCode !== otp.trim()) {
      return res.status(400).json({ error: 'Incorrect verification code. Please check your email.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await db.updateUser(user.id, {
      passwordHash,
      otpCode: null,
      otpExpires: null,
      isEmailVerified: true
    });

    res.json({
      success: true,
      message: 'Password reset successfully! You can now log in with your new password.'
    });
  } catch (err) {
    console.error('Reset Password Error:', err);
    res.status(500).json({ error: 'Server error while resetting password.' });
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

    let user = await User.findOne({ email: googleEmail });

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
      while (await User.exists({ username: candidateUsername })) {
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
        isPro: false,
        proTier: 'none',
        customBadge: '',
        pulseSparks: 50,
        createdAt: new Date().toISOString()
      };

      await db.saveUser(newUser);
      user = newUser;

      // Invalidate Redis RAM caches
      try {
        const redis = require('../utils/redis');
        redis.invalidateAllRecent().catch(() => {});
      } catch {}

      const io = req.app.get('io');
      if (io) {
        io.emit('new_user_registered', {
          id: newUser.id,
          username: newUser.username,
          displayName: newUser.displayName,
          avatar: newUser.avatar,
          status: newUser.status,
          isEmailVerified: newUser.isEmailVerified,
          isPro: false,
          proTier: 'none',
          customBadge: '',
          pulseSparks: 50,
          email: newUser.email,
          createdAt: newUser.createdAt
        });
      }
    }

    // Sign JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      config.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { passwordHash: _, otpCode: __, ...safeUser } = user.toObject ? user.toObject() : user;
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

// Verify Current Session (instant index lookup)
router.get('/me', authMiddleware, async (req, res) => {
  const mongoose = require('mongoose');
  const isObjectId = mongoose.Types.ObjectId.isValid(req.user.id);
  const user = await User.findOne(isObjectId ? { $or: [{ id: req.user.id }, { _id: req.user.id }] } : { id: req.user.id })
    .select('-passwordHash -friends -otpCode -otpExpires -pushSubscriptions')
    .lean();
  if (!user) return res.status(404).json({ error: 'User not found.' });

  res.json({ user });
});

module.exports = router;

