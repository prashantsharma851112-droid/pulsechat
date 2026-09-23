const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const https = require('https');
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');
const Message = require('../models/Message');
const db = require('../database/db');
const webpush = require('../utils/webpush');

// Supported Plans & Catalog
const PLANS = {
  pro_monthly: { name: 'Pulse Pro (Monthly)', amount: 49, currency: 'INR', type: 'pro', durationDays: 30, tier: 'monthly' },
  pro_yearly: { name: 'Pulse Pro (Yearly)', amount: 499, currency: 'INR', type: 'pro', durationDays: 365, tier: 'yearly' },
  sparks_100: { name: '100 Pulse Sparks', amount: 19, currency: 'INR', type: 'sparks', sparks: 100 },
  sparks_300: { name: '300 Pulse Sparks', amount: 49, currency: 'INR', type: 'sparks', sparks: 300 },
  sparks_1000: { name: '1000 Pulse Sparks', amount: 149, currency: 'INR', type: 'sparks', sparks: 1000 }
};

const GIFTS = {
  coffee: { id: 'coffee', name: 'Coffee Vibe', sparks: 10, icon: '☕', animation: 'steam' },
  heart: { id: 'heart', name: 'Love Pulse', sparks: 20, icon: '💖', animation: 'heartbeat' },
  fire: { id: 'fire', name: 'Fire Energy', sparks: 25, icon: '🔥', animation: 'flame' },
  rocket: { id: 'rocket', name: 'Super Rocket', sparks: 35, icon: '🚀', animation: 'launch' },
  diamond: { id: 'diamond', name: 'Pulse Diamond', sparks: 50, icon: '💎', animation: 'sparkle' },
  crown: { id: 'crown', name: 'Royal Crown', sparks: 100, icon: '👑', animation: 'golden' }
};

// Helper to create Razorpay Order via native HTTPS (no external dependency needed)
function requestRazorpayOrder(amountInPaise, currency, receipt, keyId, keySecret) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      amount: amountInPaise,
      currency: currency || 'INR',
      receipt: receipt || `rcpt_${Date.now()}`
    });

    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    const options = {
      hostname: 'api.razorpay.com',
      port: 443,
      path: '/v1/orders',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': authHeader
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.error?.description || 'Razorpay order creation failed'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(postData);
    req.end();
  });
}

// 1. Get Payment Config (Key ID & Available Plans)
router.get('/config', (req, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  res.json({
    razorpayKeyId: keyId,
    isLiveConfigured: Boolean(keyId && keySecret),
    plans: PLANS,
    gifts: GIFTS
  });
});

// 2. Create Order for Razorpay Checkout
router.post('/create-order', authMiddleware, async (req, res) => {
  try {
    const { planId } = req.body;
    const plan = PLANS[planId];
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    const userDoc = await User.findOne({ id: req.user.id });
    if (!userDoc) return res.status(404).json({ error: 'User not found' });

    if (plan.type === 'pro') {
      const now = new Date();
      const isCurrentlyActive = Boolean(userDoc.isPro && userDoc.proExpiresAt && new Date(userDoc.proExpiresAt) > now);

      if (isCurrentlyActive && userDoc.proTier === plan.tier) {
        const expiryFormatted = new Date(userDoc.proExpiresAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
        return res.status(400).json({
          error: `Aapka ${plan.tier === 'yearly' ? 'Annual' : 'Monthly'} VIP plan pehle se active hai (${expiryFormatted} tak). Expire hone se pehle dubara nahi liya ja sakta.`
        });
      }
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (keyId && keySecret) {
      try {
        const order = await requestRazorpayOrder(
          plan.amount * 100, // paise
          plan.currency,
          `pulse_${req.user.id}_${Date.now()}`,
          keyId,
          keySecret
        );
        return res.json({
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
          planId,
          keyId,
          isSandbox: false
        });
      } catch (rErr) {
        console.warn('Razorpay live order error, falling back to demo order:', rErr.message);
      }
    }

    // Demo / Sandbox Order fallback
    const demoOrderId = 'order_demo_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    return res.json({
      orderId: demoOrderId,
      amount: plan.amount * 100,
      currency: plan.currency,
      planId,
      keyId: keyId || 'rzp_test_pulsechat_demo',
      isSandbox: true
    });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Failed to initiate payment order' });
  }
});

// 3. Verify Payment & Activate Plan / Sparks
router.post('/verify', authMiddleware, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId, isSandbox } = req.body;
    const plan = PLANS[planId];
    if (!plan) return res.status(400).json({ error: 'Invalid plan' });

    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // Signature verification for live Razorpay payments
    if (!isSandbox && keySecret && razorpay_order_id && razorpay_signature) {
      const generatedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(razorpay_order_id + '|' + razorpay_payment_id)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({ error: 'Invalid payment signature' });
      }
    }

    // Apply Perks to User
    const userDoc = await User.findOne({ id: req.user.id });
    if (!userDoc) return res.status(404).json({ error: 'User not found' });

    if (plan.type === 'pro') {
      const now = new Date();
      const isCurrentlyActive = Boolean(userDoc.isPro && userDoc.proExpiresAt && new Date(userDoc.proExpiresAt) > now);

      if (isCurrentlyActive && userDoc.proTier === plan.tier) {
        const expiryFormatted = new Date(userDoc.proExpiresAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
        return res.status(400).json({
          error: `Aapka ${plan.tier === 'yearly' ? 'Annual' : 'Monthly'} VIP plan pehle se active hai (${expiryFormatted} tak). Expire hone se pehle dubara nahi liya ja sakta.`
        });
      }

      const durationMs = (plan.durationDays || 30) * 24 * 60 * 60 * 1000;
      userDoc.isPro = true;
      userDoc.proTier = plan.tier || 'monthly';
      userDoc.proExpiresAt = new Date(Date.now() + durationMs);
      userDoc.customBadge = '⚡ VIP';
    } else if (plan.type === 'sparks') {
      userDoc.pulseSparks = (userDoc.pulseSparks || 0) + (plan.sparks || 0);
    }

    await userDoc.save();

    const sanitizedUser = await User.findOne({ id: req.user.id })
      .select('-passwordHash -friends -otpCode -otpExpires -pushSubscriptions')
      .lean();

    res.json({
      success: true,
      message: plan.type === 'pro' ? '🎉 Welcome to PulseChat Pro!' : `⚡ Added ${plan.sparks} Pulse Sparks!`,
      user: sanitizedUser
    });
  } catch (err) {
    console.error('Payment verification error:', err);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// 4. Instant Demo Sandbox Activation (For testing without live gateway)
router.post('/demo-activate', authMiddleware, async (req, res) => {
  try {
    const { planId } = req.body;
    const plan = PLANS[planId] || PLANS.pro_monthly;

    const userDoc = await User.findOne({ id: req.user.id });
    if (!userDoc) return res.status(404).json({ error: 'User not found' });

    if (plan.type === 'pro') {
      // Annual plan is NOT free! Only Monthly VIP is free beta access
      if (plan.tier === 'yearly' || planId === 'pro_yearly') {
        return res.status(400).json({
          error: 'Annual VIP is a paid membership (₹499/year). Only Monthly VIP is currently available for free access.'
        });
      }

      const now = new Date();
      const isCurrentlyActive = Boolean(userDoc.isPro && userDoc.proExpiresAt && new Date(userDoc.proExpiresAt) > now);

      // Cannot activate same plan if already active
      if (isCurrentlyActive && userDoc.proTier === plan.tier) {
        const expiryFormatted = new Date(userDoc.proExpiresAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
        return res.status(400).json({
          error: `Aapka Monthly VIP plan pehle se active hai (${expiryFormatted} tak). Expire hone se pehle dubara activate nahi kiya ja sakta.`
        });
      }

      if (isCurrentlyActive && userDoc.proTier === 'yearly') {
        const expiryFormatted = new Date(userDoc.proExpiresAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
        return res.status(400).json({
          error: `Aapke paas pehle se Annual VIP active hai (${expiryFormatted} tak).`
        });
      }

      const durationMs = (plan.durationDays || 30) * 24 * 60 * 60 * 1000;
      userDoc.isPro = true;
      userDoc.proTier = 'monthly';
      userDoc.proExpiresAt = new Date(Date.now() + durationMs);
      userDoc.customBadge = '⚡ VIP';
    } else if (plan.type === 'sparks') {
      const now = Date.now();
      const cooldownMs = 24 * 60 * 60 * 1000;
      const lastClaimedStr = userDoc.claimedFreeSparks?.[planId];
      if (lastClaimedStr) {
        const lastClaimedTime = new Date(lastClaimedStr).getTime();
        const diff = now - lastClaimedTime;
        if (diff < cooldownMs) {
          const remainingMs = cooldownMs - diff;
          const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
          const remainingMins = Math.ceil((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
          return res.status(400).json({
            error: `Aapne ye ${plan.name} pehle hi claim kar liya hai. 24 ghante baad (${remainingHours}h ${remainingMins}m baki) dubara free claim kar sakte hain.`
          });
        }
      }

      if (!userDoc.claimedFreeSparks) userDoc.claimedFreeSparks = {};
      userDoc.claimedFreeSparks[planId] = new Date().toISOString();
      userDoc.markModified('claimedFreeSparks');
      userDoc.pulseSparks = (userDoc.pulseSparks || 0) + (plan.sparks || 100);
    }

    await userDoc.save();

    const sanitizedUser = await User.findOne({ id: req.user.id })
      .select('-passwordHash -friends -otpCode -otpExpires -pushSubscriptions')
      .lean();

    const returnMsg = plan.type === 'pro'
      ? (plan.tier === 'yearly' ? '👑 Pulse VIP Annual Plan Activated!' : '⚡ Pulse VIP Monthly Plan Activated!')
      : `⚡ +${plan.sparks} Sparks Credited!`;

    res.json({
      success: true,
      message: returnMsg,
      user: sanitizedUser
    });
  } catch (err) {
    console.error('Demo activate error:', err);
    res.status(500).json({ error: 'Failed to activate demo' });
  }
});

// 5. Send Virtual Gift in Chat
router.post('/send-gift', authMiddleware, async (req, res) => {
  try {
    const { chatId, receiverId, giftId, isGroup, receiverName } = req.body;
    const gift = GIFTS[giftId];
    if (!gift) return res.status(400).json({ error: 'Invalid gift item' });

    const sender = await User.findOne({ id: req.user.id });
    if (!sender) return res.status(404).json({ error: 'Sender not found' });

    const currentSparks = sender.pulseSparks || 0;
    if (currentSparks < gift.sparks) {
      return res.status(400).json({
        error: 'insufficient_sparks',
        message: `You need ${gift.sparks} Sparks, but you only have ${currentSparks} Sparks. Top up to send this gift!`,
        required: gift.sparks,
        current: currentSparks
      });
    }

    // Deduct from sender
    sender.pulseSparks = currentSparks - gift.sparks;
    await sender.save();

    // If 1-on-1 chat, credit sparks to receiver
    if (receiverId && !isGroup) {
      await User.updateOne({ id: receiverId }, { $inc: { pulseSparks: gift.sparks } });
    }

    const senderName = sender.displayName || sender.username || 'PulseChat User';
    const senderAvatar = sender.avatar || null;

    // Construct Gift Message
    const giftMessage = {
      id: 'msg_gift_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      chatId,
      senderId: req.user.id,
      senderName,
      senderAvatar,
      receiverId: receiverId || '',
      isGroup: Boolean(isGroup),
      content: `${gift.icon} Sent a ${gift.name} (${gift.sparks} Sparks)`,
      type: 'gift',
      giftData: {
        giftId: gift.id,
        giftName: gift.name,
        sparkAmount: gift.sparks,
        icon: gift.icon,
        animation: gift.animation,
        receiverName: receiverName || ''
      },
      status: 'sent',
      timestamp: new Date().toISOString()
    };

    await db.saveMessage(giftMessage);

    // Emit Real-Time Socket Event
    const io = req.app.get('io');
    if (io) {
      io.to(chatId).emit('new_message', giftMessage);
      io.to(`user_${req.user.id}`).emit('new_message', giftMessage);
      if (receiverId && !isGroup) {
        io.to(`user_${receiverId}`).emit('new_message', giftMessage);
        io.to(`user_${receiverId}`).emit('message_notification', {
          ...giftMessage,
          title: `🎁 Gift from ${senderName}`,
          senderName,
          senderAvatar
        });
      }
    }

    // Background push notification if recipient is subscribed
    if (receiverId && !isGroup) {
      setImmediate(async () => {
        try {
          const recipientUser = await User.findOne({ id: receiverId }).select('pushSubscriptions');
          if (recipientUser?.pushSubscriptions?.length > 0) {
            const pushPayload = {
              title: `🎁 Gift from ${senderName}`,
              body: `Sent you a ${gift.name}! (${gift.icon})`,
              icon: senderAvatar || '/icon-192.png',
              badge: '/icon-192.png',
              tag: `gift-${giftMessage.id}`,
              data: {
                url: `/?openChat=${chatId}&senderId=${req.user.id}`,
                chatId,
                messageId: giftMessage.id,
                senderId: req.user.id
              }
            };
            recipientUser.pushSubscriptions.forEach(sub => {
              webpush.sendPushNotification(sub, pushPayload).catch(() => {});
            });
          }
        } catch (pushErr) {}
      });
    }

    res.json({
      success: true,
      message: giftMessage,
      remainingSparks: sender.pulseSparks
    });
  } catch (err) {
    console.error('Send gift error:', err);
    res.status(500).json({ error: 'Failed to send virtual gift' });
  }
});

module.exports = router;
