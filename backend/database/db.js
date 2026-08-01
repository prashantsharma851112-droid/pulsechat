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

module.exports = {
  getUsers: async () => {
    return await User.find({}).lean();
  },

  saveUser: async (user) => {
    await User.create(user);
    return user;
  },

  updateUser: async (id, updates) => {
    const updated = await User.findOneAndUpdate({ id }, updates, { new: true }).lean();
    return updated;
  },

  getMessages: async (chatId) => {
    return await Message.find({ chatId }).sort({ timestamp: 1 }).lean();
  },

  saveMessage: async (msg) => {
    await Message.create(msg);
    return msg;
  },

  updateMessageStatus: async (msgId, status) => {
    const updated = await Message.findOneAndUpdate({ id: msgId }, { status }, { new: true }).lean();
    return updated;
  },

  deleteMessage: async (msgId) => {
    const updated = await Message.findOneAndUpdate(
      { id: msgId },
      { content: 'This message was deleted', type: 'deleted', audioUrl: null, mediaUrl: null, pollData: null },
      { new: true }
    ).lean();
    return updated;
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

  // Returns everyone the given user has EVER exchanged a message with,
  // ordered by most recent activity, each with the last message preview
  // and an unread count. This powers the persistent "Chats" list in the
  // sidebar - it does NOT depend on the user having searched for anyone,
  // so if someone messages you first, you'll see them here automatically.
  getRecentConversations: async (myId) => {
    const messages = await Message.find({ $or: [{ senderId: myId }, { receiverId: myId }] })
      .sort({ timestamp: -1 })
      .lean();

    const seen = new Set();
    const ordered = [];
    for (const msg of messages) {
      const otherId = msg.senderId === myId ? msg.receiverId : msg.senderId;
      if (otherId && !seen.has(otherId)) {
        seen.add(otherId);
        ordered.push({ otherId, lastMessage: msg });
      }
    }

    const results = [];
    for (const { otherId, lastMessage } of ordered) {
      const otherUser = await User.findOne({ id: otherId }).lean();
      if (!otherUser) continue;

      const unreadCount = await Message.countDocuments({
        senderId: otherId,
        receiverId: myId,
        status: { $ne: 'read' }
      });

      const lastMsgText = lastMessage.type === 'text'
        ? lastMessage.content
        : (lastMessage.type === 'call'
            ? (lastMessage.callData?.isVideo ? '📹 Video Call' : '📞 Voice Call')
            : `[${lastMessage.type}]`);

      const { passwordHash, ...safeUser } = otherUser;
      results.push({
        ...safeUser,
        lastMessage: lastMsgText,
        lastMessageTime: lastMessage.timestamp,
        lastMessageFromMe: lastMessage.senderId === myId,
        unreadCount
      });
    }

    return results;
  }
};
