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
  }
};
