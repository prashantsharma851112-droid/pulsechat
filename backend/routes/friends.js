const express = require('express');
const router = express.Router();
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const authMiddleware = require('../middleware/authMiddleware');
const webpush = require('../utils/webpush');

// Helper to sanitize safe user object (Strictly omit friends array, friend count, and password)
const getSafeUser = (u) => ({
  id: u.id,
  displayName: u.displayName,
  username: u.username,
  avatar: u.avatar,
  status: u.status,
  isEmailVerified: u.isEmailVerified
});

// 1. Get Current User's Friends List (Only logged-in user can access their own friends)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const currentUser = await User.findOne({ id: req.user.id });
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    const friendIds = currentUser.friends || [];
    if (friendIds.length === 0) {
      return res.json({ friends: [] });
    }

    const friends = await User.find({ id: { $in: friendIds } })
      .select('id displayName username avatar status isEmailVerified')
      .lean();

    res.json({ friends: friends.map(getSafeUser) });
  } catch (err) {
    console.error('Error fetching friends:', err);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

// 2. Get Pending Friend Requests (Incoming & Outgoing)
router.get('/requests', authMiddleware, async (req, res) => {
  try {
    const incomingReqs = await FriendRequest.find({ receiverId: req.user.id, status: 'pending' })
      .sort({ createdAt: -1 })
      .lean();

    const outgoingReqs = await FriendRequest.find({ senderId: req.user.id, status: 'pending' })
      .sort({ createdAt: -1 })
      .lean();

    // Populate user details for incoming requests
    const senderIds = incomingReqs.map(r => r.senderId);
    const senders = await User.find({ id: { $in: senderIds } })
      .select('id displayName username avatar status isEmailVerified')
      .lean();
    const senderMap = new Map(senders.map(s => [s.id, getSafeUser(s)]));

    const populatedIncoming = incomingReqs.map(r => ({
      ...r,
      sender: senderMap.get(r.senderId) || { id: r.senderId, displayName: 'PulseChat User', username: 'user' }
    }));

    // Populate user details for outgoing requests
    const receiverIds = outgoingReqs.map(r => r.receiverId);
    const receivers = await User.find({ id: { $in: receiverIds } })
      .select('id displayName username avatar status isEmailVerified')
      .lean();
    const receiverMap = new Map(receivers.map(rec => [rec.id, getSafeUser(rec)]));

    const populatedOutgoing = outgoingReqs.map(r => ({
      ...r,
      receiver: receiverMap.get(r.receiverId) || { id: r.receiverId, displayName: 'PulseChat User', username: 'user' }
    }));

    res.json({
      incoming: populatedIncoming,
      outgoing: populatedOutgoing
    });
  } catch (err) {
    console.error('Error fetching friend requests:', err);
    res.status(500).json({ error: 'Failed to fetch friend requests' });
  }
});

// 3. Send Friend Request
router.post('/request/:targetId', authMiddleware, async (req, res) => {
  try {
    const { targetId } = req.params;
    if (!targetId || targetId === req.user.id) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }

    const [currentUser, targetUser] = await Promise.all([
      User.findOne({ id: req.user.id }),
      User.findOne({ id: targetId })
    ]);

    if (!targetUser) return res.status(404).json({ error: 'User does not exist' });

    // Check block list
    if (currentUser.blockedUsers?.includes(targetId) || targetUser.blockedUsers?.includes(req.user.id)) {
      return res.status(400).json({ error: 'Unable to send friend request' });
    }

    // Check if already friends
    if (currentUser.friends?.includes(targetId)) {
      return res.status(400).json({ error: 'You are already friends' });
    }

    // Check if current user already sent a pending request
    const existingOutgoing = await FriendRequest.findOne({
      senderId: req.user.id,
      receiverId: targetId,
      status: 'pending'
    });
    if (existingOutgoing) {
      return res.status(400).json({ error: 'Friend request already sent' });
    }

    // Check if target user already sent a pending request -> Auto-accept!
    const existingIncoming = await FriendRequest.findOne({
      senderId: targetId,
      receiverId: req.user.id,
      status: 'pending'
    });

    if (existingIncoming) {
      existingIncoming.status = 'accepted';
      await existingIncoming.save();

      await Promise.all([
        User.updateOne({ id: req.user.id }, { $addToSet: { friends: targetId } }),
        User.updateOne({ id: targetId }, { $addToSet: { friends: req.user.id } })
      ]);

      const io = req.app.get('io');
      if (io) {
        io.to(`user_${targetId}`).emit('friend_request_accepted', {
          requestId: existingIncoming.id,
          friend: getSafeUser(currentUser)
        });
        io.to(`user_${req.user.id}`).emit('friend_request_accepted', {
          requestId: existingIncoming.id,
          friend: getSafeUser(targetUser)
        });
      }

      return res.json({ success: true, status: 'accepted', friend: getSafeUser(targetUser) });
    }

    // Create new friend request
    const newRequest = await FriendRequest.create({
      id: `freq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      senderId: req.user.id,
      receiverId: targetId,
      status: 'pending',
      createdAt: new Date()
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${targetId}`).emit('friend_request_received', {
        request: {
          id: newRequest.id,
          senderId: req.user.id,
          receiverId: targetId,
          status: 'pending',
          createdAt: newRequest.createdAt,
          sender: getSafeUser(currentUser)
        }
      });
    }

    // Push notification if subscribed
    if (targetUser.pushSubscriptions?.length > 0) {
      targetUser.pushSubscriptions.forEach(sub => {
        webpush.sendNotification(sub, {
          title: 'New Friend Request 🤝',
          body: `${currentUser.displayName || currentUser.username} sent you a friend request.`,
          icon: currentUser.avatar || '/icon-192.png',
          url: '/'
        }).catch(() => {});
      });
    }

    res.json({
      success: true,
      request: {
        id: newRequest.id,
        senderId: req.user.id,
        receiverId: targetId,
        status: 'pending',
        createdAt: newRequest.createdAt,
        receiver: getSafeUser(targetUser)
      }
    });
  } catch (err) {
    console.error('Error sending friend request:', err);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// 4. Accept Friend Request
router.post('/accept/:requestId', authMiddleware, async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await FriendRequest.findOne({ id: requestId, receiverId: req.user.id, status: 'pending' });
    if (!request) return res.status(404).json({ error: 'Friend request not found or already processed' });

    request.status = 'accepted';
    await request.save();

    const [senderUser, receiverUser] = await Promise.all([
      User.findOne({ id: request.senderId }),
      User.findOne({ id: req.user.id }),
      User.updateOne({ id: req.user.id }, { $addToSet: { friends: request.senderId } }),
      User.updateOne({ id: request.senderId }, { $addToSet: { friends: req.user.id } })
    ]);

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${request.senderId}`).emit('friend_request_accepted', {
        requestId,
        friend: getSafeUser(receiverUser)
      });
      io.to(`user_${req.user.id}`).emit('friend_request_accepted', {
        requestId,
        friend: getSafeUser(senderUser)
      });
    }

    res.json({ success: true, friend: getSafeUser(senderUser) });
  } catch (err) {
    console.error('Error accepting friend request:', err);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

// 5. Reject Friend Request
router.post('/reject/:requestId', authMiddleware, async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await FriendRequest.findOne({ id: requestId, receiverId: req.user.id, status: 'pending' });
    if (!request) return res.status(404).json({ error: 'Friend request not found' });

    await FriendRequest.deleteOne({ id: requestId });

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${request.senderId}`).emit('friend_request_rejected', { requestId });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error rejecting friend request:', err);
    res.status(500).json({ error: 'Failed to reject friend request' });
  }
});

// 6. Cancel Sent Friend Request
router.delete('/cancel/:requestId', authMiddleware, async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await FriendRequest.findOne({ id: requestId, senderId: req.user.id, status: 'pending' });
    if (!request) return res.status(404).json({ error: 'Friend request not found' });

    await FriendRequest.deleteOne({ id: requestId });

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${request.receiverId}`).emit('friend_request_cancelled', { requestId });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error cancelling friend request:', err);
    res.status(500).json({ error: 'Failed to cancel friend request' });
  }
});

// 7. Unfriend / Remove Friend
router.delete('/:targetId', authMiddleware, async (req, res) => {
  try {
    const { targetId } = req.params;

    await Promise.all([
      User.updateOne({ id: req.user.id }, { $pull: { friends: targetId } }),
      User.updateOne({ id: targetId }, { $pull: { friends: req.user.id } }),
      FriendRequest.deleteMany({
        $or: [
          { senderId: req.user.id, receiverId: targetId },
          { senderId: targetId, receiverId: req.user.id }
        ]
      })
    ]);

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${targetId}`).emit('friend_removed', { userId: req.user.id });
      io.to(`user_${req.user.id}`).emit('friend_removed', { userId: targetId });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error removing friend:', err);
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

// 8. Check Friendship Status with Target User
router.get('/status/:targetId', authMiddleware, async (req, res) => {
  try {
    const { targetId } = req.params;
    if (targetId === req.user.id) return res.json({ status: 'self' });

    const currentUser = await User.findOne({ id: req.user.id });
    if (currentUser?.friends?.includes(targetId)) {
      return res.json({ status: 'friends' });
    }

    const sentReq = await FriendRequest.findOne({
      senderId: req.user.id,
      receiverId: targetId,
      status: 'pending'
    });
    if (sentReq) {
      return res.json({ status: 'pending_sent', requestId: sentReq.id });
    }

    const receivedReq = await FriendRequest.findOne({
      senderId: targetId,
      receiverId: req.user.id,
      status: 'pending'
    });
    if (receivedReq) {
      return res.json({ status: 'pending_received', requestId: receivedReq.id });
    }

    res.json({ status: 'none' });
  } catch (err) {
    console.error('Error checking friendship status:', err);
    res.status(500).json({ error: 'Failed to check friendship status' });
  }
});

module.exports = router;
