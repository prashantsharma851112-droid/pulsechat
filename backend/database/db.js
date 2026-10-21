// This file used to read/write a local data.json file. That approach breaks
// in production because hosting platforms like Render have an EPHEMERAL
// filesystem - the file gets wiped on every restart/redeploy, losing all
// users and messages. This version stores everything in MongoDB instead,
// which persists properly. The exported function NAMES are kept identical
// to before, so routes/sockets barely had to change - only `await` was
// added, since these are now asynchronous database calls instead of
// synchronous file reads.

const User = require('../models/User');
const Message = require('../models/Message');
const ChatSetting = require('../models/ChatSetting');

module.exports = {
  getUsers: async () => {
    return await User.find({}).lean();
  },

  saveUser: async (user) => {
    await User.create(user);
    return user;
  },

  updateUser: async (id, updates) => {
    if (!id) return null;
    const mongoose = require('mongoose');
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const query = {
      $or: [
        { id },
        ...(isObjectId ? [{ _id: id }] : []),
        { username: id }
      ]
    };
    const updated = await User.findOneAndUpdate(query, updates, { new: true }).lean();
    if (updated) {
      try {
        const redis = require('../utils/redis');
        if (updated.id) redis.invalidateUser(updated.id).catch(() => {});
        if (updated.username) redis.invalidateUser(updated.username).catch(() => {});
        redis.invalidateAllRecent().catch(() => {});
      } catch {}
    }
    return updated;
  },

  getMessages: async (chatId, limit = 50, before = null, userId = null, since = null) => {
    let chatQuery = chatId;
    if (chatId && typeof chatId === 'string') {
      const queryList = [chatId];
      if (chatId.includes('_user_')) {
        const idx = chatId.indexOf('_user_');
        const first = chatId.slice(0, idx);
        const second = chatId.slice(idx + 1);
        queryList.push(`${second}_${first}`);
      }
      chatQuery = queryList.length > 1 ? { $in: queryList } : chatId;
    }
    const query = {
      chatId: chatQuery,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    };
    if (userId) {
      query.deletedFor = { $ne: String(userId) };
    }
    if (before) {
      query.timestamp = { $lt: before };
    }
    if (since) {
      query.timestamp = { $gt: since };
    }
    const limitNum = Math.min(parseInt(limit, 10) || 50, 200);
    const msgs = await Message.find(query)
      .sort({ timestamp: since ? 1 : -1 })
      .limit(limitNum)
      .lean();
    return since ? msgs : msgs.reverse();
  },

  saveMessage: async (msg) => {
    await Message.create(msg);
    // Invalidate Redis RAM cache so fresh messages load instantly
    if (msg.chatId) {
      try {
        const redis = require('../utils/redis');
        redis.invalidateChat(msg.chatId).catch(() => {});
        if (msg.chatId.includes('_')) {
          const canonical = msg.chatId.split('_').sort().join('_');
          if (canonical !== msg.chatId) redis.invalidateChat(canonical).catch(() => {});
        }
        if (msg.senderId) redis.invalidateRecent(msg.senderId).catch(() => {});
        if (msg.receiverId) redis.invalidateRecent(msg.receiverId).catch(() => {});
      } catch {}
    }
    return msg;
  },

  updateMessageStatus: async (msgId, status) => {
    const updated = await Message.findOneAndUpdate({ id: msgId }, { status }, { new: true }).lean();
    return updated;
  },

  markChatAsRead: async (chatOrContactId, userId, isGhostMode = false) => {
    if (!chatOrContactId || !userId) return;

    let myVariants = [userId];
    let otherVariants = [];
    try {
      const mongoose = require('mongoose');
      const me = await User.findOne({
        $or: [
          { id: userId },
          { username: userId },
          ...(mongoose.Types.ObjectId.isValid(userId) ? [{ _id: userId }] : [])
        ]
      }).select('id username _id').lean();
      if (me) {
        if (me.id) myVariants.push(me.id);
        if (me.username) myVariants.push(me.username);
        if (me._id) myVariants.push(me._id.toString());
      }
    } catch (e) {}
    myVariants = Array.from(new Set(myVariants.filter(Boolean)));

    try {
      const mongoose = require('mongoose');
      let targetIdToSearch = chatOrContactId;
      if (typeof chatOrContactId === 'string' && chatOrContactId.includes('_')) {
        for (const m of myVariants) {
          if (!m) continue;
          if (chatOrContactId.startsWith(m + '_')) {
            targetIdToSearch = chatOrContactId.slice(m.length + 1);
            break;
          } else if (chatOrContactId.endsWith('_' + m)) {
            targetIdToSearch = chatOrContactId.slice(0, -(m.length + 1));
            break;
          }
        }
      }
      if (targetIdToSearch) {
        const other = await User.findOne({
          $or: [
            { id: targetIdToSearch },
            { username: targetIdToSearch },
            ...(mongoose.Types.ObjectId.isValid(targetIdToSearch) ? [{ _id: targetIdToSearch }] : [])
          ]
        }).select('id username _id').lean();
        if (other) {
          if (other.id) otherVariants.push(other.id);
          if (other.username) otherVariants.push(other.username);
          if (other._id) otherVariants.push(other._id.toString());
        }
      }
    } catch (e) {}
    if (typeof chatOrContactId === 'string') otherVariants.push(chatOrContactId);
    otherVariants = Array.from(new Set(otherVariants.filter(Boolean)));

    const chatConditions = [
      { chatId: chatOrContactId },
      { senderId: { $in: otherVariants }, receiverId: { $in: myVariants } }
    ];

    myVariants.forEach(m => {
      otherVariants.forEach(o => {
        chatConditions.push({ chatId: [m, o].sort().join('_') });
      });
    });

    const filter = {
      $or: chatConditions,
      senderId: { $nin: myVariants }
    };

    const updateDoc = {
      $addToSet: { readBy: { $each: myVariants } }
    };

    if (!isGhostMode) {
      updateDoc.$set = { status: 'read' };
      await Message.updateMany(filter, updateDoc);
    } else {
      // In Ghost Mode: upgrade any 'sent' (single tick) to 'delivered' (double grey tick)!
      // But NEVER set status to 'read' (blue tick)!
      await Message.updateMany(
        { ...filter, status: 'sent' },
        { $set: { status: 'delivered' }, $addToSet: { readBy: { $each: myVariants } } }
      );
      // Ensure readBy contains reader so unread badge clears
      await Message.updateMany(filter, updateDoc);
    }

    // Invalidate Redis RAM caches so unread count updates immediately across rest endpoints
    try {
      const redis = require('../utils/redis');
      myVariants.forEach(v => redis.invalidateRecent(v).catch(() => {}));
      otherVariants.forEach(v => redis.invalidateRecent(v).catch(() => {}));
      redis.invalidateChat(chatOrContactId).catch(() => {});
      chatConditions.forEach(c => {
        if (c.chatId) redis.invalidateChat(c.chatId).catch(() => {});
      });
    } catch (e) {}
  },

  toggleReaction: async (messageId, emoji, userId) => {
    const mongoose = require('mongoose');
    const isObjectId = mongoose.Types.ObjectId.isValid(messageId);
    const msg = await Message.findOne({
      $or: [
        { id: String(messageId) },
        ...(isObjectId ? [{ _id: messageId }] : [])
      ]
    });
    if (!msg) return null;

    let reactions = msg.reactions || {};
    if (typeof reactions !== 'object' || Array.isArray(reactions)) {
      reactions = {};
    }

    const userList = reactions[emoji] || [];
    if (userList.includes(userId)) {
      reactions[emoji] = userList.filter(id => id !== userId);
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    } else {
      reactions[emoji] = [...userList, userId];
    }

    msg.reactions = reactions;
    msg.markModified('reactions');
    await msg.save();
    return msg;
  },

  deleteMessage: async (msgId) => {
    const msg = await Message.findOne({ id: msgId });
    if (!msg) return null;

    msg.originalContent = msg.content;
    msg.originalType = msg.type;
    msg.originalAudioUrl = msg.audioUrl;
    msg.originalMediaUrl = msg.mediaUrl;
    msg.originalPollData = msg.pollData;

    msg.content = 'This message was deleted';
    msg.type = 'deleted';
    msg.audioUrl = null;
    msg.mediaUrl = null;
    msg.pollData = null;

    await msg.save();

    if (msg.chatId) {
      try {
        const redis = require('../utils/redis');
        redis.invalidateChat(msg.chatId).catch(() => {});
      } catch {}
    }

    return msg.toObject();
  },

  deleteMessageForMe: async (msgId, userId) => {
    if (!msgId || !userId) return null;
    const msg = await Message.findOne({ id: msgId });
    if (!msg) return null;

    if (!Array.isArray(msg.deletedFor)) msg.deletedFor = [];
    if (!msg.deletedFor.includes(String(userId))) {
      msg.deletedFor.push(String(userId));
      msg.markModified('deletedFor');
      await msg.save();
    }

    if (msg.chatId) {
      try {
        const redis = require('../utils/redis');
        redis.invalidateChat(msg.chatId).catch(() => {});
      } catch {}
    }

    return msg.toObject();
  },

  restoreMessage: async (msgId) => {
    const msg = await Message.findOne({ id: msgId });
    if (!msg || msg.type !== 'deleted') return null;

    msg.content = msg.originalContent || '';
    msg.type = msg.originalType || 'text';
    msg.audioUrl = msg.originalAudioUrl || null;
    msg.mediaUrl = msg.originalMediaUrl || null;
    msg.pollData = msg.originalPollData || null;

    msg.originalContent = null;
    msg.originalType = null;
    msg.originalAudioUrl = null;
    msg.originalMediaUrl = null;
    msg.originalPollData = null;

    await msg.save();
    return msg.toObject();
  },

  panicWipeChats: async (userId) => {
    await Message.deleteMany({ $or: [{ senderId: userId }, { receiverId: userId }] });
    return { success: true };
  },

  markViewOnceOpened: async (messageId, userId) => {
    if (!messageId) return null;
    const mongoose = require('mongoose');
    const isObjId = mongoose.Types.ObjectId.isValid(messageId);
    const msg = await Message.findOne({
      $or: [
        { id: String(messageId) },
        ...(isObjId ? [{ _id: messageId }] : [])
      ]
    });
    if (!msg || !msg.isViewOnce) return null;

    // Check if the user is the sender (must NOT count as recipient view)
    const isSender = String(msg.senderId) === String(userId);
    if (isSender) return null;

    try {
      const senderUser = await User.findOne({ $or: [{ id: msg.senderId }, { _id: msg.senderId }] }).select('id _id');
      if (senderUser) {
        if (String(senderUser.id) === String(userId) || String(senderUser._id) === String(userId)) {
          return null;
        }
      }
    } catch (e) {}

    if (!msg.viewCounts) msg.viewCounts = {};
    const currentViews = (msg.viewCounts[userId] || 0) + 1;
    msg.viewCounts[userId] = currentViews;
    msg.markModified('viewCounts');

    const maxLimit = msg.viewLimit || (msg.isViewTwice ? 2 : 1);
    if (currentViews >= maxLimit && !msg.viewedBy.includes(userId)) {
      msg.viewedBy.push(userId);
      msg.markModified('viewedBy');
    }
    // Set status to read so sender receives double blue tick
    msg.status = 'read';
    if (!msg.readBy) msg.readBy = [];
    if (!msg.readBy.includes(userId)) {
      msg.readBy.push(userId);
      msg.markModified('readBy');
    }
    await msg.save();
    return msg;
  },

  updatePollVote: async (messageId, optionId, userId) => {
    const msg = await Message.findOne({ id: messageId });
    if (!msg || !msg.pollData) return null;

    const pollData = msg.pollData;
    const isMultiple = pollData.isMultipleChoice;

    pollData.options = pollData.options.map(opt => {
      let votes = opt.votes || [];
      if (opt.id === optionId) {
        if (votes.includes(userId)) {
          // Unvote
          votes = votes.filter(u => u !== userId);
        } else {
          // Vote
          votes = [...votes, userId];
        }
      } else if (!isMultiple) {
        // Single choice: remove vote from other options
        votes = votes.filter(u => u !== userId);
      }
      return { ...opt, votes };
    });

    msg.pollData = pollData;
    msg.markModified('pollData');
    await msg.save();
    return msg;
  },

  updatePollData: async (messageId, updatedPollData) => {
    const msg = await Message.findOne({ id: messageId });
    if (!msg || !msg.pollData) return null;

    msg.pollData = updatedPollData;
    msg.markModified('pollData');
    await msg.save();
    return msg;
  },

  // Returns everyone the given user has EVER exchanged a message with,
  // ordered by most recent activity, each with the last message preview
  // and an unread count. Optimized with parallel index scans for 0ms latency.
  getRecentConversations: async (myId) => {
    try {
      // 0. Check Redis In-Memory RAM Cache (0.5ms ultra-low latency)
      try {
        const redis = require('../utils/redis');
        const cached = await redis.getCachedRecent(myId);
        if (cached && Array.isArray(cached) && cached.length > 0) {
          return cached;
        }
      } catch {}

      const mongoose = require('mongoose');

      // Resolve all ID representations for myId
      let myVariants = [myId];
      try {
        const me = await User.findOne({
          $or: [
            { id: myId },
            { username: myId },
            ...(mongoose.Types.ObjectId.isValid(myId) ? [{ _id: myId }] : [])
          ]
        }).select('id username _id').lean();
        if (me) {
          if (me.id) myVariants.push(me.id);
          if (me.username) myVariants.push(me.username);
          if (me._id) myVariants.push(me._id.toString());
        }
      } catch (e) {}
      myVariants = Array.from(new Set(myVariants.filter(Boolean)));

      // Parallel index scans for 1-on-1 chats (excluding group messages)
      const [sentMsgs, receivedMsgs] = await Promise.all([
        Message.find({ senderId: { $in: myVariants }, isGroup: { $ne: true } }).sort({ timestamp: -1 }).limit(150).lean(),
        Message.find({ receiverId: { $in: myVariants }, isGroup: { $ne: true } }).sort({ timestamp: -1 }).limit(150).lean()
      ]);

      const messages = [...sentMsgs, ...receivedMsgs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      const seen = new Set();
      const ordered = [];
      for (const msg of messages) {
        const otherId = myVariants.includes(msg.senderId) ? msg.receiverId : msg.senderId;
        if (otherId && !myVariants.includes(otherId) && !seen.has(otherId)) {
          seen.add(otherId);
          ordered.push({ otherId, lastMessage: msg });
        }
      }

      if (ordered.length === 0) return [];

      const otherIds = Array.from(seen).filter(Boolean);
      const validObjectIds = otherIds
        .filter(id => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id))
        .map(id => new mongoose.Types.ObjectId(id));

      const [usersList, unreadAgg] = await Promise.all([
        User.find({
          $or: [
            { id: { $in: otherIds } },
            { username: { $in: otherIds } },
            ...(validObjectIds.length > 0 ? [{ _id: { $in: validObjectIds } }] : [])
          ]
        })
          .select('-passwordHash -friends -otpCode -otpExpires -pushSubscriptions')
          .lean(),
        Message.aggregate([
          {
            $match: {
              receiverId: { $in: myVariants },
              status: { $ne: 'read' },
              readBy: { $nin: myVariants },
              senderId: { $in: otherIds },
              isGroup: { $ne: true }
            }
          },
          { $group: { _id: '$senderId', count: { $sum: 1 } } }
        ])
      ]);

      const userMap = new Map();
      for (const u of usersList) {
        if (u.id) userMap.set(u.id, u);
        if (u._id) userMap.set(u._id.toString(), u);
        if (u.username) userMap.set(u.username, u);
      }
      const unreadMap = new Map(unreadAgg.map(u => [u._id, u.count]));

      // Pre-fetch ChatSettings for 1-on-1 chats to resolve private mutual nicknames
      const candidateChatIds = new Set();
      for (const { otherId } of ordered) {
        const uObj = userMap.get(otherId);
        if (!uObj) continue;
        const otherVariants = [uObj.id, uObj.username, uObj._id ? uObj._id.toString() : null].filter(Boolean);
        for (const myVar of myVariants) {
          for (const othVar of otherVariants) {
            candidateChatIds.add([myVar, othVar].sort().join('_'));
            candidateChatIds.add(`${myVar}_${othVar}`);
            candidateChatIds.add(`${othVar}_${myVar}`);
            candidateChatIds.add(`${myVar}_${othVar}`.split('_').sort().join('_'));
            candidateChatIds.add(`${othVar}_${myVar}`.split('_').sort().join('_'));
          }
        }
      }
      const chatSettingsMap = new Map();
      if (candidateChatIds.size > 0) {
        try {
          const matchedSettings = await ChatSetting.find({ chatId: { $in: Array.from(candidateChatIds) } }).lean();
          matchedSettings.forEach(s => {
            if (s.chatId) chatSettingsMap.set(s.chatId, s);
          });
        } catch (e) {}
      }

      const results = [];
      const addedUserIds = new Set();
      for (const { otherId, lastMessage } of ordered) {
        if (otherId === 'anonymous_pulse_bot') {
          const unreadCount = unreadMap.get('anonymous_pulse_bot') || 0;
          const msgContent = typeof lastMessage?.content === 'string' ? lastMessage.content : '🤫 Secret Message';
          results.push({
            id: 'anonymous_pulse_bot',
            username: 'anonymous_pulse',
            displayName: '🤫 Anonymous Pulse',
            avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=anonymous_pulse_bot&backgroundColor=09090b',
            status: 'Secret messages from your Instagram link 🤫',
            isAnonymousBot: true,
            lastMessage: msgContent,
            lastMessageTime: lastMessage.timestamp || new Date().toISOString(),
            lastMessageTimestamp: lastMessage.timestamp || new Date().toISOString(),
            lastMessageFromMe: false,
            lastMessageStatus: lastMessage.status || 'delivered',
            lastMessageType: 'anonymous_pulse',
            unreadCount
          });
          continue;
        }

        if (otherId === 'user') continue;
        const otherUser = userMap.get(otherId);
        if (!otherUser) continue;
        const otherUniqueKey = otherUser.id || (otherUser._id ? otherUser._id.toString() : null) || otherUser.username;
        if (addedUserIds.has(otherUniqueKey)) continue;
        addedUserIds.add(otherUniqueKey);

        const otherVariants = [otherUser.id, otherUser.username, otherUser._id ? otherUser._id.toString() : null].filter(Boolean);
        let chatSetting = null;
        for (const myVar of myVariants) {
          for (const othVar of otherVariants) {
            const keys = [
              `${myVar}_${othVar}`.split('_').sort().join('_'),
              [myVar, othVar].sort().join('_'),
              `${myVar}_${othVar}`,
              `${othVar}_${myVar}`
            ];
            for (const k of keys) {
              if (chatSettingsMap.has(k)) {
                chatSetting = chatSettingsMap.get(k);
                break;
              }
            }
            if (chatSetting) break;
          }
          if (chatSetting) break;
        }

        let partnerNickname = null;
        if (chatSetting?.nicknames) {
          for (const othVar of otherVariants) {
            if (chatSetting.nicknames[othVar]) {
              partnerNickname = chatSetting.nicknames[othVar];
              break;
            }
          }
        }

        const unreadCount = unreadMap.get(otherUser.id) ||
                            (otherUser.username && unreadMap.get(otherUser.username)) ||
                            (otherUser._id && unreadMap.get(otherUser._id.toString())) ||
                            unreadMap.get(otherId) || 0;

        let lastMsgText = '';
        const isFromMe = myVariants.includes(lastMessage.senderId);

        if (lastMessage.type === 'stealth_dust' || lastMessage.isDustText) {
          lastMsgText = '⚡ Stealth Dust Text';
        } else if (lastMessage.type === 'story_reply' || lastMessage.storyReply) {
          const sr = lastMessage.storyReply;
          const isSharedStory = (lastMessage.content && lastMessage.content.startsWith('Shared ')) || (!sr?.reactionEmoji && !sr?.tipSparks && !sr?.replyText);
          if (isSharedStory) {
            lastMsgText = isFromMe ? 'You shared a vibe ⚡' : 'Shared a vibe ⚡';
          } else if (sr?.reactionEmoji) {
            lastMsgText = isFromMe ? `You reacted ${sr.reactionEmoji} to story` : `Reacted ${sr.reactionEmoji} to your story`;
          } else if (sr?.tipSparks) {
            lastMsgText = isFromMe ? `You tipped ⚡ ${sr.tipSparks} Sparks on story` : `Tipped ⚡ ${sr.tipSparks} Sparks on your story!`;
          } else if (sr?.replyText) {
            lastMsgText = isFromMe ? `You replied: "${sr.replyText}"` : `Replied to your story: "${sr.replyText}"`;
          } else {
            lastMsgText = isFromMe ? 'You shared a vibe ⚡' : 'Shared a vibe ⚡';
          }
        } else if (lastMessage.type === 'text') {
          if (lastMessage.content && lastMessage.content.startsWith('Replied to your story:')) {
            lastMsgText = isFromMe
              ? lastMessage.content.replace(/^Replied to your story:\s*/, 'You replied: ')
              : lastMessage.content;
          } else if (lastMessage.content && lastMessage.content.startsWith('Reacted ') && lastMessage.content.includes(' to your story')) {
            lastMsgText = isFromMe
              ? lastMessage.content.replace(/\s*to your story$/, ' to story')
              : lastMessage.content;
          } else if (lastMessage.content && lastMessage.content.startsWith('Tipped ') && lastMessage.content.includes(' on your story!')) {
            lastMsgText = isFromMe
              ? lastMessage.content.replace(/\s*on your story!$/, ' on story!')
              : lastMessage.content;
          } else {
            lastMsgText = lastMessage.content;
          }
        } else if (lastMessage.type === '3d_text') {
          lastMsgText = `✨ 3D: ${lastMessage.content}`;
        } else if (lastMessage.type === 'gift') {
          lastMsgText = '🎁 Virtual Gift';
        } else if (lastMessage.type === 'call') {
          lastMsgText = lastMessage.callData?.isVideo ? '📹 Video Call' : '📞 Voice Call';
        } else if (lastMessage.type === 'voice') {
          lastMsgText = '🎤 Voice note';
        } else if (lastMessage.type === 'image') {
          lastMsgText = lastMessage.content || '🖼️ Photo';
        } else if (lastMessage.type === 'video') {
          lastMsgText = '🎥 Video';
        } else if (lastMessage.type === 'poll') {
          lastMsgText = '📊 Poll';
        } else {
          lastMsgText = lastMessage.content || `[${lastMessage.type}]`;
        }

        results.push({
          ...otherUser,
          nickname: partnerNickname,
          nicknames: chatSetting?.nicknames || {},
          isPro: Boolean(otherUser.isPro),
          proTier: otherUser.proTier || 'none',
          customBadge: otherUser.customBadge || '',
          lastMessage: lastMsgText,
          lastMessageTime: lastMessage.timestamp,
          lastMessageTimestamp: lastMessage.timestamp,
          lastMessageFromMe: isFromMe,
          lastMessageStatus: lastMessage.status || 'sent',
          lastMessageType: lastMessage.type || 'text',
          unreadCount
        });
      }

      if (results.length > 0) {
        try {
          const redis = require('../utils/redis');
          redis.setCachedRecent(myId, results, 90).catch(() => {});
        } catch {}
      }

      return results;
    } catch (err) {
      console.error('getRecentConversations error:', err);
      return [];
    }
  },

  clearChatMessages: async (chatId) => {
    if (!chatId) return [];
    const canonicalChatId = (chatId && chatId.includes('_')) ? chatId.split('_').sort().join('_') : chatId;
    const reversedChatId = (chatId && chatId.includes('_')) ? chatId.split('_').reverse().join('_') : chatId;
    const chatQueries = Array.from(new Set([chatId, canonicalChatId, reversedChatId]));
    const messages = await Message.find({ chatId: { $in: chatQueries } }).lean();
    await Message.deleteMany({ chatId: { $in: chatQueries } });
    return messages;
  },

  restoreChatMessages: async (messages) => {
    if (Array.isArray(messages) && messages.length > 0) {
      await Message.insertMany(messages);
    }
    return { success: true };
  },

  deleteMultipleMessages: async (messageIds) => {
    const msgs = await Message.find({ id: { $in: messageIds } });
    const chatIds = new Set();
    for (const msg of msgs) {
      msg.originalContent = msg.content;
      msg.originalType = msg.type;
      msg.originalAudioUrl = msg.audioUrl;
      msg.originalMediaUrl = msg.mediaUrl;
      msg.originalPollData = msg.pollData;

      msg.content = 'This message was deleted';
      msg.type = 'deleted';
      msg.audioUrl = null;
      msg.mediaUrl = null;
      msg.pollData = null;
      await msg.save();
      if (msg.chatId) chatIds.add(msg.chatId);
    }
    if (chatIds.size > 0) {
      try {
        const redis = require('../utils/redis');
        chatIds.forEach(cid => redis.invalidateChat(cid).catch(() => {}));
      } catch {}
    }
    return msgs;
  },

  deleteMultipleMessagesForMe: async (messageIds, userId) => {
    if (!Array.isArray(messageIds) || messageIds.length === 0 || !userId) return [];
    const msgs = await Message.find({ id: { $in: messageIds } });
    const chatIds = new Set();
    for (const msg of msgs) {
      if (!Array.isArray(msg.deletedFor)) msg.deletedFor = [];
      if (!msg.deletedFor.includes(String(userId))) {
        msg.deletedFor.push(String(userId));
        msg.markModified('deletedFor');
        await msg.save();
      }
      if (msg.chatId) chatIds.add(msg.chatId);
    }
    if (chatIds.size > 0) {
      try {
        const redis = require('../utils/redis');
        chatIds.forEach(cid => redis.invalidateChat(cid).catch(() => {}));
      } catch {}
    }
    return msgs;
  },

  restoreMultipleMessages: async (messageIds) => {
    const msgs = await Message.find({ id: { $in: messageIds }, type: 'deleted' });
    for (const msg of msgs) {
      msg.content = msg.originalContent || '';
      msg.type = msg.originalType || 'text';
      msg.audioUrl = msg.originalAudioUrl || null;
      msg.mediaUrl = msg.originalMediaUrl || null;
      msg.pollData = msg.originalPollData || null;

      msg.originalContent = null;
      msg.originalType = null;
      msg.originalAudioUrl = null;
      msg.originalMediaUrl = null;
      msg.originalPollData = null;
      await msg.save();
    }
    return msgs;
  },

  getChatSetting: async (rawChatId) => {
    if (!rawChatId) return { disappearingEnabled: false, disappearingDuration: 86400, wallpaperId: 'none', customWallpaperUrl: null, chatTheme: 'midnight_amoled', nicknames: {}, vanishMode: false, themeTrialExpiresAt: null, wallpaperTrialExpiresAt: null };
    const canonicalChatId = (rawChatId && rawChatId.includes('_')) ? rawChatId.split('_').sort().join('_') : rawChatId;
    let query = { chatId: canonicalChatId };
    if (rawChatId.includes('_')) {
      const parts = rawChatId.split('_');
      query = { $or: [{ chatId: canonicalChatId }, { chatId: rawChatId }, { chatId: `${parts[1]}_${parts[0]}` }] };
    }
    let setting = await ChatSetting.findOne(query);
    if (!setting) {
      setting = {
        chatId: canonicalChatId,
        disappearingEnabled: false,
        disappearingDuration: 86400,
        wallpaperId: 'none',
        customWallpaperUrl: null,
        chatTheme: 'midnight_amoled',
        nicknames: {},
        vanishMode: false,
        themeTrialExpiresAt: null,
        wallpaperTrialExpiresAt: null
      };
    } else {
      const now = Date.now();
      let needsSave = false;
      if (setting.themeTrialExpiresAt && now >= new Date(setting.themeTrialExpiresAt).getTime()) {
        setting.chatTheme = 'midnight_amoled';
        setting.themeTrialExpiresAt = null;
        needsSave = true;
      }
      if (setting.wallpaperTrialExpiresAt && now >= new Date(setting.wallpaperTrialExpiresAt).getTime()) {
        setting.wallpaperId = 'none';
        setting.customWallpaperUrl = null;
        setting.wallpaperTrialExpiresAt = null;
        needsSave = true;
      }
      if (needsSave) {
        await setting.save().catch(() => {});
      }
      setting = setting.toObject ? setting.toObject() : setting;
      if (!setting.nicknames) setting.nicknames = {};
      setting.vanishMode = Boolean(setting.vanishMode);
    }
    return setting;
  },

  setDisappearingMessages: async (rawChatId, enabled, userId) => {
    if (!rawChatId) return null;
    const canonicalChatId = (rawChatId && rawChatId.includes('_')) ? rawChatId.split('_').sort().join('_') : rawChatId;
    let query = { chatId: canonicalChatId };
    if (rawChatId.includes('_')) {
      const parts = rawChatId.split('_');
      query = { $or: [{ chatId: canonicalChatId }, { chatId: rawChatId }, { chatId: `${parts[1]}_${parts[0]}` }] };
    }
    let setting = await ChatSetting.findOne(query);
    if (!setting) {
      try {
        setting = await ChatSetting.create({
          chatId: canonicalChatId,
          disappearingEnabled: !!enabled,
          disappearingDuration: 86400,
          updatedAt: new Date(),
          updatedBy: userId || ''
        });
      } catch (err) {
        setting = await ChatSetting.findOne({ chatId: canonicalChatId });
        if (setting) {
          setting.disappearingEnabled = !!enabled;
          setting.updatedAt = new Date();
          setting.updatedBy = userId || '';
          await setting.save();
        }
      }
    } else {
      setting.chatId = canonicalChatId;
      setting.disappearingEnabled = !!enabled;
      setting.updatedAt = new Date();
      setting.updatedBy = userId || '';
      await setting.save();
    }
    return setting ? (setting.toObject ? setting.toObject() : setting) : { chatId: canonicalChatId, disappearingEnabled: !!enabled };
  },

  setVanishMode: async (rawChatId, enabled, userId) => {
    if (!rawChatId) return null;
    const canonicalChatId = (rawChatId && rawChatId.includes('_')) ? rawChatId.split('_').sort().join('_') : rawChatId;
    let query = { chatId: canonicalChatId };
    if (rawChatId.includes('_')) {
      const parts = rawChatId.split('_');
      query = { $or: [{ chatId: canonicalChatId }, { chatId: rawChatId }, { chatId: `${parts[1]}_${parts[0]}` }] };
    }
    let setting = await ChatSetting.findOne(query);
    if (!setting) {
      try {
        setting = await ChatSetting.create({
          chatId: canonicalChatId,
          vanishMode: !!enabled,
          updatedAt: new Date(),
          updatedBy: userId || ''
        });
      } catch (err) {
        setting = await ChatSetting.findOne({ chatId: canonicalChatId });
        if (setting) {
          setting.vanishMode = !!enabled;
          setting.updatedAt = new Date();
          setting.updatedBy = userId || '';
          await setting.save();
        }
      }
    } else {
      setting.chatId = canonicalChatId;
      setting.vanishMode = !!enabled;
      setting.updatedAt = new Date();
      setting.updatedBy = userId || '';
      await setting.save();
    }
    try {
      await ChatSetting.updateMany(query, {
        $set: { vanishMode: !!enabled, updatedAt: new Date(), updatedBy: userId || '' }
      });
    } catch (e) {}

    return setting ? (setting.toObject ? setting.toObject() : setting) : { chatId: canonicalChatId, vanishMode: !!enabled };
  },

  evaporateVanishMessages: async (rawChatId) => {
    if (!rawChatId) return [];
    const canonicalChatId = (rawChatId && rawChatId.includes('_')) ? rawChatId.split('_').sort().join('_') : rawChatId;
    let chatConditions = [{ chatId: canonicalChatId }, { chatId: rawChatId }];
    if (rawChatId.includes('_')) {
      const parts = rawChatId.split('_');
      chatConditions.push({ chatId: `${parts[1]}_${parts[0]}` });
    }
    const filter = {
      $or: chatConditions,
      isVanish: true
    };
    const vanishMsgs = await Message.find(filter, { id: 1 }).lean();
    const deletedIds = vanishMsgs.map(m => m.id);
    if (deletedIds.length > 0) {
      await Message.deleteMany(filter);
      try {
        const redis = require('../utils/redis');
        chatConditions.forEach(c => redis.invalidateChat(c.chatId).catch(() => {}));
      } catch (e) {}
    }
    return deletedIds;
  },

  setChatWallpaper: async (rawChatId, wallpaperId, customWallpaperUrl, userId, trialExpiresAt = null) => {
    if (!rawChatId) return null;
    const canonicalChatId = (rawChatId && rawChatId.includes('_')) ? rawChatId.split('_').sort().join('_') : rawChatId;
    let query = { chatId: canonicalChatId };
    if (rawChatId.includes('_')) {
      const parts = rawChatId.split('_');
      query = { $or: [{ chatId: canonicalChatId }, { chatId: rawChatId }, { chatId: `${parts[1]}_${parts[0]}` }] };
    }
    const finalExpiresAt = trialExpiresAt ? new Date(trialExpiresAt) : null;
    let setting = await ChatSetting.findOne(query);
    if (!setting) {
      try {
        setting = await ChatSetting.create({
          chatId: canonicalChatId,
          wallpaperId: wallpaperId || 'none',
          customWallpaperUrl: customWallpaperUrl || null,
          wallpaperTrialExpiresAt: finalExpiresAt,
          updatedAt: new Date(),
          updatedBy: userId || ''
        });
      } catch (err) {
        setting = await ChatSetting.findOne({ chatId: canonicalChatId });
        if (setting) {
          setting.wallpaperId = wallpaperId || 'none';
          setting.customWallpaperUrl = customWallpaperUrl || null;
          setting.wallpaperTrialExpiresAt = finalExpiresAt;
          setting.updatedAt = new Date();
          setting.updatedBy = userId || '';
          await setting.save();
        }
      }
    } else {
      setting.chatId = canonicalChatId;
      setting.wallpaperId = wallpaperId || 'none';
      setting.customWallpaperUrl = customWallpaperUrl || null;
      setting.wallpaperTrialExpiresAt = finalExpiresAt;
      setting.updatedAt = new Date();
      setting.updatedBy = userId || '';
      await setting.save();
    }
    return setting ? (setting.toObject ? setting.toObject() : setting) : { chatId: canonicalChatId, wallpaperId: wallpaperId || 'none', customWallpaperUrl, wallpaperTrialExpiresAt: finalExpiresAt };
  },

  setChatTheme: async (rawChatId, themeId, userId, trialExpiresAt = null) => {
    if (!rawChatId) return null;
    const canonicalChatId = (rawChatId && rawChatId.includes('_')) ? rawChatId.split('_').sort().join('_') : rawChatId;
    let query = { chatId: canonicalChatId };
    if (rawChatId.includes('_')) {
      const parts = rawChatId.split('_');
      query = { $or: [{ chatId: canonicalChatId }, { chatId: rawChatId }, { chatId: `${parts[1]}_${parts[0]}` }] };
    }
    const finalExpiresAt = trialExpiresAt ? new Date(trialExpiresAt) : null;
    let setting = await ChatSetting.findOne(query);
    if (!setting) {
      try {
        setting = await ChatSetting.create({
          chatId: canonicalChatId,
          chatTheme: themeId || 'midnight_amoled',
          themeTrialExpiresAt: finalExpiresAt,
          updatedAt: new Date(),
          updatedBy: userId || ''
        });
      } catch (err) {
        setting = await ChatSetting.findOne({ chatId: canonicalChatId });
        if (setting) {
          setting.chatTheme = themeId || 'midnight_amoled';
          setting.themeTrialExpiresAt = finalExpiresAt;
          setting.updatedAt = new Date();
          setting.updatedBy = userId || '';
          await setting.save();
        }
      }
    } else {
      setting.chatId = canonicalChatId;
      setting.chatTheme = themeId || 'midnight_amoled';
      setting.themeTrialExpiresAt = finalExpiresAt;
      setting.updatedAt = new Date();
      setting.updatedBy = userId || '';
      await setting.save();
    }
    return setting ? (setting.toObject ? setting.toObject() : setting) : { chatId: canonicalChatId, chatTheme: themeId || 'midnight_amoled', themeTrialExpiresAt: finalExpiresAt };
  },

  setChatNickname: async (rawChatId, targetUserId, nickname, userId) => {
    if (!rawChatId || !targetUserId) return null;
    const mongoose = require('mongoose');
    const canonicalChatId = (rawChatId && rawChatId.includes('_')) ? rawChatId.split('_').sort().join('_') : rawChatId;
    let query = { chatId: canonicalChatId };
    if (rawChatId.includes('_')) {
      const parts = rawChatId.split('_');
      query = { $or: [{ chatId: canonicalChatId }, { chatId: rawChatId }, { chatId: `${parts[1]}_${parts[0]}` }] };
    }
    let setting = await ChatSetting.findOne(query);
    if (!setting) {
      try {
        setting = await ChatSetting.create({
          chatId: canonicalChatId,
          nicknames: {},
          updatedAt: new Date(),
          updatedBy: userId || ''
        });
      } catch (err) {
        setting = await ChatSetting.findOne({ chatId: canonicalChatId });
      }
    }
    if (!setting) {
      setting = new ChatSetting({ chatId: canonicalChatId, nicknames: {} });
    }

    let nicks = {};
    if (setting.nicknames) {
      if (typeof setting.nicknames.toObject === 'function') {
        nicks = setting.nicknames.toObject();
      } else {
        nicks = { ...setting.nicknames };
      }
    }

    // Resolve all possible key variants of targetUserId (custom id, mongo _id, username)
    const targetKeys = new Set([String(targetUserId)]);
    try {
      const targetUser = await User.findOne({
        $or: [
          { id: targetUserId },
          { username: targetUserId },
          ...(mongoose.Types.ObjectId.isValid(targetUserId) ? [{ _id: targetUserId }] : [])
        ]
      });
      if (targetUser) {
        if (targetUser.id) targetKeys.add(String(targetUser.id));
        if (targetUser._id) targetKeys.add(String(targetUser._id));
        if (targetUser.username) targetKeys.add(String(targetUser.username));
      }
    } catch (e) {}

    // Remove all previous entries for this user
    targetKeys.forEach(k => {
      delete nicks[k];
    });

    const trimmed = (nickname || '').trim();
    if (trimmed) {
      // Set nickname under targetUserId and all its known identifier variants
      targetKeys.forEach(k => {
        nicks[k] = trimmed;
      });
    }

    setting.chatId = canonicalChatId;
    setting.nicknames = nicks;
    setting.markModified('nicknames');
    setting.updatedAt = new Date();
    setting.updatedBy = userId || '';
    await setting.save();

    // Also sync all matching ChatSetting records for this chat query
    try {
      await ChatSetting.updateMany(query, {
        $set: { nicknames: nicks, updatedAt: new Date(), updatedBy: userId || '' }
      });
    } catch (e) {}

    return setting.toObject ? setting.toObject() : setting;
  },

  blockUser: async (userId, targetUserId) => {
    const user = await User.findOne({ id: userId });
    if (!user) return null;
    if (!user.blockedUsers) user.blockedUsers = [];
    if (!user.blockedUsers.includes(targetUserId)) {
      user.blockedUsers.push(targetUserId);
      user.markModified('blockedUsers');
      await user.save();
    }
    return user.blockedUsers;
  },

  unblockUser: async (userId, targetUserId) => {
    const user = await User.findOne({ id: userId });
    if (!user) return null;
    if (!user.blockedUsers) user.blockedUsers = [];
    user.blockedUsers = user.blockedUsers.filter(id => id !== targetUserId);
    user.markModified('blockedUsers');
    await user.save();
    return user.blockedUsers;
  },

  getBlockedUsers: async (userId) => {
    const user = await User.findOne({ id: userId }).lean();
    if (!user || !user.blockedUsers || user.blockedUsers.length === 0) return [];
    const blockedList = await User.find({ id: { $in: user.blockedUsers } })
      .select('id displayName username avatar status')
      .lean();
    return blockedList;
  },

  isUserBlocked: async (userAId, userBId) => {
    if (!userAId || !userBId) return { isBlocked: false, aBlockedB: false, bBlockedA: false };
    const users = await User.find({ id: { $in: [userAId, userBId] } }).select('id blockedUsers').lean();
    const userA = users.find(u => u.id === userAId);
    const userB = users.find(u => u.id === userBId);
    const aBlockedB = Boolean(userA?.blockedUsers && userA.blockedUsers.includes(userBId));
    const bBlockedA = Boolean(userB?.blockedUsers && userB.blockedUsers.includes(userAId));
    return {
      isBlocked: aBlockedB || bBlockedA,
      aBlockedB,
      bBlockedA
    };
  },

  runAutoCleanupJob: async (days = 7) => {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffIso = cutoffDate.toISOString();

      // Find users who explicitly turned OFF auto-cleanup
      const disabledUsers = await User.find({ autoCleanupEnabled: false }).select('id').lean();
      const disabledIds = disabledUsers.map(u => u.id).filter(Boolean);

      const query = {
        timestamp: { $lt: cutoffIso },
        isViewOnce: false,
        type: { $ne: 'system' }
      };

      if (disabledIds.length > 0) {
        query.senderId = { $nin: disabledIds };
        query.receiverId = { $nin: disabledIds };
      }

      // 1. Purge messages matching the 7-day auto-cleanup query
      const result = await Message.deleteMany(query);

      // 2. Also purge expired 24h vibes automatically
      try {
        const Vibe = require('../models/Vibe');
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        await Vibe.deleteMany({
          $or: [
            { expiresAt: { $lte: new Date() } },
            { createdAt: { $lte: oneDayAgo } }
          ]
        });
      } catch (ve) {}

      console.log(`[Auto-Cleanup Job] Successfully purged ${result?.deletedCount || 0} old messages (${days}+ days old).`);
      return { success: true, deletedCount: result?.deletedCount || 0 };
    } catch (err) {
      console.error('[Auto-Cleanup Job] Error performing cleanup:', err);
      return { success: false, error: err.message, deletedCount: 0 };
    }
  },

  // =========================================================================
  // PULSE STREAKS ENGINE (Daily Snap & Chat Streaks, Sparks, and Freeze)
  // =========================================================================
  updateChatStreak: async (rawChatId, senderId, receiverId) => {
    if (!rawChatId || !senderId || !receiverId) return null;
    const canonicalChatId = (rawChatId && rawChatId.includes('_')) ? rawChatId.split('_').sort().join('_') : rawChatId;
    let query = { chatId: canonicalChatId };
    if (rawChatId.includes('_')) {
      const parts = rawChatId.split('_');
      query = { $or: [{ chatId: canonicalChatId }, { chatId: rawChatId }, { chatId: `${parts[1]}_${parts[0]}` }] };
    }
    let setting = await ChatSetting.findOne(query);
    if (!setting) {
      try {
        setting = await ChatSetting.create({ chatId: canonicalChatId });
      } catch (err) {
        setting = await ChatSetting.findOne(query);
      }
    }
    if (!setting) return null;

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const lastDate = setting.lastStreakDate;

    let streakUpdated = false;
    let bonusSparks = 0;
    let milestoneHit = null;

    if (!lastDate || (setting.streakCount || 0) <= 0) {
      // First chat interaction or streak was at 0: Start Day 1!
      setting.streakCount = 1;
      setting.lastStreakDate = today;
      setting.lastStreakSenderId = senderId;
      streakUpdated = true;
      bonusSparks = 1;
      await User.updateMany(
        { $or: [{ id: { $in: [senderId, receiverId] } }, { username: { $in: [senderId, receiverId] } }] },
        { $inc: { pulseSparks: bonusSparks } }
      ).catch(() => {});
    } else if (lastDate === today) {
      // Already chatted today - streak maintained
      streakUpdated = true;
    } else if (lastDate === yesterday) {
      setting.streakCount = (setting.streakCount || 0) + 1;
      setting.lastStreakDate = today;
      setting.lastStreakSenderId = senderId;
      streakUpdated = true;

      const current = setting.streakCount;
      let auraUnlocked = null;
      if (current >= 3) {
        // Unlock exclusive Neon Flame Aura for both friends
        await User.updateMany(
          { $or: [{ id: { $in: [senderId, receiverId] } }, { username: { $in: [senderId, receiverId] } }] },
          { $set: { hasNeonFlameAura: true } }
        ).catch(() => {});
      }

      if (current === 3 && (!setting.streakMilestonesClaimed || !setting.streakMilestonesClaimed.includes(3))) {
        bonusSparks = 15; // 3-Day Daily Vibe Streak Reward (Sparks Drop)
        milestoneHit = 3;
        auraUnlocked = 'neon_flame';
        setting.streakMilestonesClaimed = [...(setting.streakMilestonesClaimed || []), 3];
      } else if (current === 7 && (!setting.streakMilestonesClaimed || !setting.streakMilestonesClaimed.includes(7))) {
        bonusSparks = 25;
        milestoneHit = 7;
        setting.streakMilestonesClaimed = [...(setting.streakMilestonesClaimed || []), 7];
      } else if (current === 30 && (!setting.streakMilestonesClaimed || !setting.streakMilestonesClaimed.includes(30))) {
        bonusSparks = 60;
        milestoneHit = 30;
        setting.streakMilestonesClaimed = [...(setting.streakMilestonesClaimed || []), 30];
      } else {
        bonusSparks = 1; // +1 daily maintenance spark reward!
      }

      if (bonusSparks > 0) {
        await User.updateMany(
          { $or: [{ id: { $in: [senderId, receiverId] } }, { username: { $in: [senderId, receiverId] } }] },
          { $inc: { pulseSparks: bonusSparks } }
        ).catch(() => {});
      }
    } else {
      // More than 1 day missed: Check Streak Freeze shields!
      const isFrozen = setting.streakFrozenUntil && new Date(setting.streakFrozenUntil) > new Date();
      let senderShields = (setting.streakShields && setting.streakShields.get && setting.streakShields.get(senderId)) || 0;
      let receiverShields = (setting.streakShields && setting.streakShields.get && setting.streakShields.get(receiverId)) || 0;

      if (isFrozen) {
        setting.lastStreakDate = today;
        setting.streakFrozenUntil = null;
        streakUpdated = true;
      } else if (senderShields > 0) {
        setting.streakShields.set(senderId, senderShields - 1);
        setting.lastStreakDate = today;
        streakUpdated = true;
      } else if (receiverShields > 0) {
        setting.streakShields.set(receiverId, receiverShields - 1);
        setting.lastStreakDate = today;
        streakUpdated = true;
      } else {
        setting.streakCount = 1;
        setting.lastStreakDate = today;
        setting.lastStreakSenderId = senderId;
        setting.streakMilestonesClaimed = [];
        streakUpdated = true;
      }
    }

    setting.markModified('streakShields');
    setting.markModified('streakMilestonesClaimed');
    await setting.save().catch(() => {});

    const shieldsObj = setting.streakShields ? (setting.streakShields instanceof Map ? Object.fromEntries(setting.streakShields) : setting.streakShields) : {};
    return {
      chatId: canonicalChatId,
      rawChatId,
      streakCount: Math.max(1, setting.streakCount || 1),
      lastStreakDate: setting.lastStreakDate,
      streakShields: shieldsObj,
      shields: shieldsObj,
      bonusSparks,
      milestoneHit,
      auraUnlocked: (milestoneHit === 3 || setting.streakCount >= 3) ? 'neon_flame' : null,
      streakUpdated: true
    };
  },

  buyStreakFreeze: async (rawChatId, userId) => {
    if (!rawChatId || !userId) return { success: false, error: 'Invalid parameters' };
    const user = await User.findOne({ $or: [{ id: userId }, { username: userId }] });
    if (!user) return { success: false, error: 'User not found' };

    const FREEZE_COST = 20; // 20 Sparks for 1 Freeze Shield
    if ((user.pulseSparks || 0) < FREEZE_COST) {
      return { success: false, error: `Sparks kam hain! Streak Freeze ke liye ${FREEZE_COST} Sparks chahiye.` };
    }

    user.pulseSparks -= FREEZE_COST;
    await user.save();

    const canonicalChatId = (rawChatId && rawChatId.includes('_')) ? rawChatId.split('_').sort().join('_') : rawChatId;
    let setting = await ChatSetting.findOne({ chatId: canonicalChatId });
    if (!setting) {
      setting = await ChatSetting.create({ chatId: canonicalChatId });
    }

    if (!setting.streakShields) setting.streakShields = new Map();
    const currentShields = (setting.streakShields.get && setting.streakShields.get(userId)) || 0;
    setting.streakShields.set(userId, currentShields + 1);
    setting.markModified('streakShields');
    await setting.save();

    return {
      success: true,
      shields: currentShields + 1,
      pulseSparks: user.pulseSparks
    };
  }
};
