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
    const mongoose = require('mongoose');
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const query = isObjectId
      ? { $or: [{ id }, { _id: id }] }
      : { id };
    const updated = await User.findOneAndUpdate(query, updates, { new: true }).lean();
    return updated;
  },

  getMessages: async (chatId) => {
    return await Message.find({
      chatId,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    }).sort({ timestamp: 1 }).lean();
  },

  saveMessage: async (msg) => {
    await Message.create(msg);
    return msg;
  },

  updateMessageStatus: async (msgId, status) => {
    const updated = await Message.findOneAndUpdate({ id: msgId }, { status }, { new: true }).lean();
    return updated;
  },

  markChatAsRead: async (chatId, userId) => {
    await Message.updateMany(
      { chatId, receiverId: userId, status: { $ne: 'read' } },
      { status: 'read' }
    );
  },

  toggleReaction: async (messageId, emoji, userId) => {
    const msg = await Message.findOne({ id: messageId });
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
    const msg = await Message.findOne({ id: messageId });
    if (!msg || !msg.isViewOnce) return null;

    // Only count as viewed if opened by recipient (not sender)
    if (msg.senderId !== userId) {
      if (!msg.viewedBy.includes(userId)) {
        msg.viewedBy.push(userId);
        msg.markModified('viewedBy');
        await msg.save();
      }
    }
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
      // Parallel index scans for 1-on-1 chats (excluding group messages)
      const [sentMsgs, receivedMsgs] = await Promise.all([
        Message.find({ senderId: myId, isGroup: { $ne: true } }).sort({ timestamp: -1 }).limit(150).lean(),
        Message.find({ receiverId: myId, isGroup: { $ne: true } }).sort({ timestamp: -1 }).limit(150).lean()
      ]);

      const messages = [...sentMsgs, ...receivedMsgs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      const seen = new Set();
      const ordered = [];
      for (const msg of messages) {
        const otherId = msg.senderId === myId ? msg.receiverId : msg.senderId;
        if (otherId && otherId !== myId && !seen.has(otherId)) {
          seen.add(otherId);
          ordered.push({ otherId, lastMessage: msg });
        }
      }

      if (ordered.length === 0) return [];

      const otherIds = Array.from(seen).filter(Boolean);
      const mongoose = require('mongoose');
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
          { $match: { receiverId: myId, status: { $ne: 'read' }, senderId: { $in: otherIds }, isGroup: { $ne: true } } },
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

      const results = [];
      const addedUserIds = new Set();
      for (const { otherId, lastMessage } of ordered) {
        const otherUser = userMap.get(otherId);
        if (!otherUser) continue;
        if (addedUserIds.has(otherUser.id)) continue;
        addedUserIds.add(otherUser.id);

        const unreadCount = unreadMap.get(otherUser.id) || unreadMap.get(otherId) || 0;

        const lastMsgText = lastMessage.type === 'text'
          ? lastMessage.content
          : (lastMessage.type === 'call'
              ? (lastMessage.callData?.isVideo ? '📹 Video Call' : '📞 Voice Call')
              : (lastMessage.type === 'voice'
                  ? '🎤 Voice note'
                  : (lastMessage.type === 'image'
                      ? (lastMessage.content || '🖼️ Photo')
                      : (lastMessage.type === 'video'
                          ? '🎥 Video'
                          : `[${lastMessage.type}]`))));

        results.push({
          ...otherUser,
          lastMessage: lastMsgText,
          lastMessageTime: lastMessage.timestamp,
          lastMessageTimestamp: lastMessage.timestamp,
          lastMessageFromMe: lastMessage.senderId === myId,
          lastMessageStatus: lastMessage.status || 'sent',
          lastMessageType: lastMessage.type || 'text',
          unreadCount
        });
      }

      return results;
    } catch (err) {
      console.error('getRecentConversations error:', err);
      return [];
    }
  },

  clearChatMessages: async (chatId) => {
    const messages = await Message.find({ chatId }).lean();
    await Message.deleteMany({ chatId });
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

  getChatSetting: async (chatId) => {
    let setting = await ChatSetting.findOne({ chatId }).lean();
    if (!setting) {
      setting = { chatId, disappearingEnabled: false, disappearingDuration: 86400 };
    }
    return setting;
  },

  setDisappearingMessages: async (chatId, enabled, userId) => {
    const updated = await ChatSetting.findOneAndUpdate(
      { chatId },
      { disappearingEnabled: !!enabled, disappearingDuration: 86400, updatedAt: new Date(), updatedBy: userId || '' },
      { upsert: true, new: true }
    ).lean();
    return updated;
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
  }
};
