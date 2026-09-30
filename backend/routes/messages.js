const express = require('express');
const router = express.Router();
const db = require('../database/db');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadToCloudinary } = require('../utils/cloudinary');

const User = require('../models/User');

const resolveGhostMode = async (userId) => {
  if (!userId) return false;
  try {
    const mongoose = require('mongoose');
    const u = await User.findOne({
      $or: [
        { id: userId },
        ...(mongoose.Types.ObjectId.isValid(userId) ? [{ _id: userId }] : []),
        { username: userId }
      ]
    }).select('hideReadReceipts').lean();
    return Boolean(u && u.hideReadReceipts);
  } catch {
    return false;
  }
};

// Get Chat Settings (Disappearing Messages) - MUST BE BEFORE /:chatId
router.get('/settings/:chatId', authMiddleware, async (req, res) => {
  try {
    const setting = await db.getChatSetting(req.params.chatId);
    res.json(setting);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chat settings' });
  }
});

// Toggle Disappearing Messages (24h) - MUST BE BEFORE /:chatId
router.put('/settings/:chatId/disappearing', authMiddleware, async (req, res) => {
  try {
    const { enabled } = req.body;
    const setting = await db.setDisappearingMessages(req.params.chatId, enabled, req.user.id);

    // Announce via system message
    const sysMsg = {
      id: 'msg_sys_' + Date.now(),
      chatId: req.params.chatId,
      senderId: 'system',
      receiverId: '',
      isGroup: !req.params.chatId.includes('_'),
      type: 'system',
      content: enabled ? '⏱️ Messages in this chat will disappear 24 hours after being sent.' : '⏱️ Disappearing messages was turned off.',
      status: 'sent',
      timestamp: new Date().toISOString()
    };
    await db.saveMessage(sysMsg);

    const io = req.app.get('io');
    if (io) {
      io.to(req.params.chatId).emit('chat_setting_updated', setting);
      io.to(req.params.chatId).emit('new_message', sysMsg);
      if (req.params.chatId.includes('_')) {
        const parts = req.params.chatId.split('_');
        parts.forEach(uId => {
          io.to(`user_${uId}`).emit('chat_setting_updated', setting);
          io.to(`user_${uId}`).emit('new_message', sysMsg);
        });
      }
    }

    res.json({ success: true, setting, systemMessage: sysMsg });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update disappearing messages' });
  }
});

// Get Chat Message History - ultra fast response with Redis RAM cache, non-blocking background read receipts
router.get('/:chatId', authMiddleware, async (req, res) => {
  try {
    const { limit, before } = req.query;
    const redis = require('../utils/redis');

    // 0. Instant RAM Cache Check for initial chat opening (0.5ms response time)
    if (!before) {
      try {
        const cached = await redis.getCachedMessages(req.params.chatId);
        if (cached && Array.isArray(cached) && cached.length > 0) {
          res.json(cached);

          // Non-blocking background read mark and socket emission
          setImmediate(async () => {
            try {
              const isGhostMode = await resolveGhostMode(req.user.id);

              await db.markChatAsRead(req.params.chatId, req.user.id, isGhostMode);
              const io = req.app.get('io');
              if (io) {
                io.to(`user_${req.user.id}`).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
                if (!isGhostMode) {
                  io.to(req.params.chatId).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
                  if (req.params.chatId.includes('_')) {
                    const otherId = req.params.chatId.split('_').find(id => id !== req.user.id);
                    if (otherId) io.to(`user_${otherId}`).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
                  }
                }
              }
            } catch (bgErr) {}
          });
          return;
        }
      } catch {}
    }

    const messages = await db.getMessages(req.params.chatId, limit, before);
    res.json(messages);

    // Save to Redis RAM Cache for next instant open
    if (!before && Array.isArray(messages) && messages.length > 0) {
      redis.setCachedMessages(req.params.chatId, messages, 1800).catch(() => {});
    }

    // Non-blocking background read mark and socket emission
    setImmediate(async () => {
      try {
        const isGhostMode = await resolveGhostMode(req.user.id);

        await db.markChatAsRead(req.params.chatId, req.user.id, isGhostMode);
        const io = req.app.get('io');
        if (io) {
          // ALWAYS emit to reader so their sidebar/tab unread badge immediately clears!
          io.to(`user_${req.user.id}`).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });

          if (!isGhostMode) {
            io.to(req.params.chatId).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
            if (req.params.chatId.includes('_')) {
              const otherId = req.params.chatId.split('_').find(id => id !== req.user.id);
              if (otherId) io.to(`user_${otherId}`).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
            }
          }
        }
      } catch (bgErr) {
        console.error('Background read mark error:', bgErr);
      }
    });
  } catch (err) {
    console.error('Error fetching chat messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Mark Chat Messages as Read
router.put('/:chatId/read', authMiddleware, async (req, res) => {
  try {
    const isGhostMode = await resolveGhostMode(req.user.id);

    await db.markChatAsRead(req.params.chatId, req.user.id, isGhostMode);
    const io = req.app.get('io');
    if (io) {
      // ALWAYS emit to reader so their sidebar/tab unread badge immediately clears!
      io.to(`user_${req.user.id}`).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });

      if (!isGhostMode) {
        io.to(req.params.chatId).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
        if (req.params.chatId.includes('_')) {
          const otherId = req.params.chatId.split('_').find(id => id !== req.user.id);
          if (otherId) io.to(`user_${otherId}`).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
        }
      }
    }
    res.json({ success: true, ghostMode: isGhostMode });
  } catch (err) {
    console.error('PUT /:chatId/read error:', err);
    res.status(500).json({ error: 'Failed to mark read' });
  }
});

const Message = require('../models/Message');

// Mark Chat Messages as Delivered (Called by Service Worker on background push receipt or client)
router.post('/delivered-ack', async (req, res) => {
  try {
    const { messageId, chatId } = req.body;
    if (!messageId) return res.status(400).json({ error: 'messageId required' });

    const updatedMsg = await Message.findOneAndUpdate(
      { id: messageId, status: 'sent' },
      { status: 'delivered' },
      { new: true }
    );

    if (updatedMsg) {
      const io = req.app.get('io');
      if (io) {
        const targetChatId = chatId || updatedMsg.chatId;
        if (updatedMsg.senderId) {
          io.to(`user_${updatedMsg.senderId}`).emit('message_delivered_update', {
            messageId,
            chatId: targetChatId,
            status: 'delivered'
          });
          io.to(`user_${updatedMsg.senderId}`).emit('messages_delivered', {
            chatId: targetChatId,
            messageIds: [messageId],
            status: 'delivered'
          });
        }
        if (targetChatId) {
          io.to(targetChatId).emit('message_delivered_update', {
            messageId,
            chatId: targetChatId,
            status: 'delivered'
          });
          io.to(targetChatId).emit('messages_delivered', {
            chatId: targetChatId,
            messageIds: [messageId],
            status: 'delivered'
          });
        }
      }
    }
    res.json({ success: true, delivered: !!updatedMsg });
  } catch (err) {
    console.error('Error in delivered-ack route:', err);
    res.status(500).json({ error: 'Failed to acknowledge delivery' });
  }
});

// Send message via HTTP (Offline Outbox sync fallback)
router.post('/send', authMiddleware, async (req, res) => {
  try {
    const { chatId, receiverId, isGroup, content, type, audioUrl, mediaUrl, pollData, replyTo, clientTempId } = req.body;
    const senderId = req.user.id;

    if (!chatId) return res.status(400).json({ error: 'chatId is required' });

    // Check if blocked in 1-to-1 chat
    if (receiverId && !isGroup) {
      const blockStatus = await db.isUserBlocked(senderId, receiverId);
      if (blockStatus.isBlocked) {
        return res.status(403).json({ error: 'Blocked contact' });
      }
    }

    if (type === '3d_text') {
      const senderUser = await User.findOne({ id: senderId });
      if (senderUser) {
        const isPro = Boolean(senderUser.isPro && senderUser.proExpiresAt && new Date(senderUser.proExpiresAt) > new Date());
        const hasUsedTrial = Boolean(senderUser.hasUsed3DTrial);

        if (!hasUsedTrial) {
          senderUser.hasUsed3DTrial = true;
          await senderUser.save();
        } else {
          if (!isPro) {
            return res.status(403).json({
              error: 'subscription_required',
              message: 'Aapka 3D Free Trial khatam ho chuka hai. 3D text stickers bhejne ke liye Pulse VIP subscription activate karein.'
            });
          }

          const SPARKS_COST = 10;
          const currentSparks = senderUser.pulseSparks || 0;
          if (currentSparks < SPARKS_COST) {
            return res.status(400).json({
              error: 'insufficient_sparks',
              message: `Sparks kam hain! 3D text bhejne ke liye 10 Sparks lagte hain, aapke paas sirf ${currentSparks} Sparks hain. VIP Store se free claim karein.`
            });
          }

          senderUser.pulseSparks = currentSparks - SPARKS_COST;
          await senderUser.save();
        }
      }
    }

    const chatSetting = await db.getChatSetting(chatId);
    const isDisappearing = Boolean(chatSetting && chatSetting.disappearingEnabled);
    const expiresAt = isDisappearing ? new Date(Date.now() + (chatSetting.disappearingDuration || 86400) * 1000) : null;

    // Cloudinary Auto-Upload for HTTP sync fallback
    let finalMediaUrl = mediaUrl || null;
    let finalAudioUrl = audioUrl || null;

    if (finalMediaUrl && typeof finalMediaUrl === 'string' && finalMediaUrl.startsWith('data:')) {
      try {
        const resType = type === 'video' ? 'video' : (type === 'audio' || type === 'voice' ? 'video' : 'auto');
        finalMediaUrl = await uploadToCloudinary(finalMediaUrl, 'pulsechat_media', resType);
      } catch (e) {
        console.warn('Cloudinary upload fallback:', e.message);
      }
    }

    if (finalAudioUrl && typeof finalAudioUrl === 'string' && finalAudioUrl.startsWith('data:')) {
      try {
        finalAudioUrl = await uploadToCloudinary(finalAudioUrl, 'pulsechat_voice', 'video');
      } catch (e) {
        console.warn('Cloudinary audio upload fallback:', e.message);
      }
    }

    const newMsg = {
      id: 'msg_' + Date.now(),
      clientTempId: clientTempId || null,
      chatId,
      senderId,
      receiverId: receiverId || '',
      isGroup: !!isGroup,
      content: content || '',
      type: type || 'text',
      audioUrl: finalAudioUrl,
      mediaUrl: finalMediaUrl,
      fileName: req.body.fileName || null,
      fileSize: req.body.fileSize || null,
      pollData: pollData || null,
      callData: null,
      isViewOnce: false,
      viewedBy: [],
      status: 'sent',
      timestamp: new Date().toISOString(),
      reactions: {},
      replyTo: replyTo || null,
      expiresAt
    };

    await db.saveMessage(newMsg);

    const io = req.app.get('io');
    if (io) {
      io.to(chatId).emit('new_message', newMsg);
      if (receiverId && !isGroup) {
        const sender = await User.findOne({ id: senderId }).select('displayName username avatar');
        io.to(`user_${receiverId}`).emit('message_notification', {
          ...newMsg,
          senderName: sender?.displayName || sender?.username || senderId,
          senderAvatar: sender?.avatar || null
        });
      }
    }

    res.json({ success: true, message: newMsg });
  } catch (err) {
    console.error('Error in /api/messages/send route:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Run Instant Storage Cleanup
router.post('/auto-cleanup', authMiddleware, async (req, res) => {
  try {
    const days = parseInt(req.body.days, 10) || 30;
    const result = await db.runAutoCleanupJob(days);

    // Invalidate Redis RAM Cache
    try {
      const redis = require('../utils/redis');
      redis.invalidateAllRecent().catch(() => {});
    } catch {}

    res.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Storage cleanup completed successfully! Removed ${result.deletedCount} old messages (${days}+ days old).`
    });
  } catch (err) {
    console.error('Instant auto-cleanup endpoint error:', err);
    res.status(500).json({ error: 'Failed to execute storage cleanup' });
  }
});

// YouTube / Full Song Audio Search Endpoint (Extracts full length direct audio tracks)
router.get('/youtube-search', authMiddleware, async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q.trim()) return res.json([]);

    const endpoints = [
      'https://jiosaavn-api-tan.vercel.app/api/search/songs?query=',
      'https://saavn.dev/api/search/songs?query=',
      'https://jiosaavn-api-private-us.vercel.app/api/search/songs?query='
    ];

    let fullSongItems = [];

    for (const ep of endpoints) {
      try {
        const fetchRes = await fetch(ep + encodeURIComponent(q.trim()));
        if (fetchRes.ok) {
          const data = await fetchRes.json();
          const results = data.data?.results || data.results;
          if (Array.isArray(results) && results.length > 0) {
            fullSongItems = results.map(song => {
              const audioObj = Array.isArray(song.downloadUrl)
                ? (song.downloadUrl.find(d => d.quality === '320kbps') || song.downloadUrl.find(d => d.quality === '160kbps') || song.downloadUrl[song.downloadUrl.length - 1])
                : null;
              const audioUrl = audioObj?.url || (typeof song.downloadUrl === 'string' ? song.downloadUrl : null);

              const imgObj = Array.isArray(song.image)
                ? (song.image.find(i => i.quality === '500x500') || song.image[song.image.length - 1])
                : null;
              const albumArt = imgObj?.url || (typeof song.image === 'string' ? song.image : null);

              const artist = Array.isArray(song.artists?.primary) && song.artists.primary.length > 0
                ? song.artists.primary.map(a => a.name).join(', ')
                : (song.primaryArtists || 'PulseChat Music');

              const title = (song.name || song.title || 'Full Song')
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&')
                .replace(/&#039;/g, "'");

              if (!audioUrl) return null;

              return {
                trackId: `full_${song.id || Math.random().toString(36).substr(2, 6)}`,
                songTitle: title,
                artistName: artist,
                albumArt: albumArt || '',
                audioUrl: audioUrl,
                duration: song.duration ? Number(song.duration) : 240,
                isFullSong: true
              };
            }).filter(Boolean);

            if (fullSongItems.length > 0) break;
          }
        }
      } catch (e) {
        console.warn('Saavn search endpoint error:', e.message);
      }
    }

    if (fullSongItems.length > 0) {
      return res.json(fullSongItems);
    }

    // YouTube Fallback Scraper if Saavn API yields zero items
    const searchUrl = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q.trim() + ' full song audio');
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await response.text();
    const matches = [...html.matchAll(/\/watch\?v=([a-zA-Z0-9_-]{11})/g)];
    const videoIds = Array.from(new Set(matches.map(m => m[1]))).slice(0, 10);

    const ytItems = await Promise.all(videoIds.map(async (vId) => {
      try {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${vId}&format=json`);
        if (!oembedRes.ok) return null;
        const info = await oembedRes.json();
        return {
          trackId: `yt_${vId}`,
          youtubeId: vId,
          songTitle: info.title || 'YouTube Track',
          artistName: info.author_name || 'YouTube Music',
          albumArt: info.thumbnail_url || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
          audioUrl: `https://www.youtube-nocookie.com/embed/${vId}?autoplay=1&enablejsapi=1`,
          isFullSong: true
        };
      } catch {
        return null;
      }
    }));

    res.json(ytItems.filter(Boolean));
  } catch (err) {
    console.error('Full song search error:', err);
    res.status(500).json({ error: 'Failed to search full song audio' });
  }
});

// Permanent Dissolve Stealth Dust Note Endpoint
router.post('/dissolve-dust/:messageId', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { chatId, messageMongoId, clientTempId } = req.body || {};
    const Message = require('../models/Message');
    const redis = require('../utils/redis');
    const mongoose = require('mongoose');

    const orConditions = [];
    if (messageId) {
      orConditions.push({ id: String(messageId) });
      orConditions.push({ clientTempId: String(messageId) });
      if (mongoose.Types.ObjectId.isValid(String(messageId))) {
        orConditions.push({ _id: new mongoose.Types.ObjectId(String(messageId)) });
      }
    }
    if (clientTempId) {
      orConditions.push({ id: String(clientTempId) });
      orConditions.push({ clientTempId: String(clientTempId) });
      if (mongoose.Types.ObjectId.isValid(String(clientTempId))) {
        orConditions.push({ _id: new mongoose.Types.ObjectId(String(clientTempId)) });
      }
    }
    if (messageMongoId && mongoose.Types.ObjectId.isValid(String(messageMongoId))) {
      orConditions.push({ _id: new mongoose.Types.ObjectId(String(messageMongoId)) });
    }

    if (orConditions.length > 0) {
      await Message.deleteMany({ $or: orConditions });
    }

    if (chatId) {
      await redis.invalidateChat(chatId).catch(() => {});
      if (chatId.includes('_')) {
        const parts = chatId.split('_');
        const revChatId = [parts[1], parts[0]].join('_');
        await redis.invalidateChat(revChatId).catch(() => {});
        await redis.invalidateChat(parts[0]).catch(() => {});
        await redis.invalidateChat(parts[1]).catch(() => {});
        redis.invalidateRecent(parts[0]).catch(() => {});
        redis.invalidateRecent(parts[1]).catch(() => {});
      }
    }

    const io = req.app.get('io');
    const payload = { chatId, messageId, messageMongoId, clientTempId };
    if (io && chatId) {
      io.to(chatId).emit('stealth_dust_dissolved', payload);
      if (chatId.includes('_')) {
        const parts = chatId.split('_');
        parts.forEach(uId => io.to(`user_${uId}`).emit('stealth_dust_dissolved', payload));
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error in dissolve-dust route:', err);
    res.status(500).json({ error: 'Failed to dissolve dust note' });
  }
});

module.exports = router;
