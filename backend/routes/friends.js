const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const authMiddleware = require('../middleware/authMiddleware');
const webpush = require('../utils/webpush');

// Helper to sanitize safe user object (Strictly omit friends array, friend count, and password)
const getSafeUser = (u) => {
  if (!u) return null;
  return {
    id: u.id || (u._id ? u._id.toString() : ''),
    displayName: u.displayName || u.username || 'PulseChat User',
    username: u.username || 'user',
    avatar: u.avatar || '',
    status: u.status || 'Hey there! I am using PulseChat.',
    isEmailVerified: Boolean(u.isEmailVerified)
  };
};

// Helper to extract all possible identifiers for a user
const getUserIdentifiers = (user) => {
  if (!user) return [];
  const ids = new Set();
  if (user.id) ids.add(user.id);
  if (user._id) ids.add(user._id.toString());
  if (user.username) ids.add(user.username);
  return Array.from(ids);
};

// Helper to lookup user by id, _id, or username
const findUserAnywhere = async (idOrUsername) => {
  if (!idOrUsername) return null;
  const isObjectId = mongoose.Types.ObjectId.isValid(idOrUsername);
  return User.findOne({
    $or: [
      { id: idOrUsername },
      ...(isObjectId ? [{ _id: idOrUsername }] : []),
      { username: idOrUsername }
    ]
  });
};

// 1. Get Current User's Friends List (Only logged-in user can access their own friends)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const currentUser = await findUserAnywhere(req.user.id);
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    const friendIds = currentUser.friends || [];
    if (friendIds.length === 0) {
      return res.json({ friends: [] });
    }

    const friends = await User.find({
      $or: [
        { id: { $in: friendIds } },
        { username: { $in: friendIds } },
        { _id: { $in: friendIds.filter(id => mongoose.Types.ObjectId.isValid(id)) } }
      ]
    })
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
    const currentUser = await findUserAnywhere(req.user.id);
    const myIds = Array.from(new Set([
      ...getUserIdentifiers(currentUser),
      req.user.id,
      req.user.username
    ].filter(Boolean)));

    const [incomingReqs, outgoingReqs] = await Promise.all([
      FriendRequest.find({ receiverId: { $in: myIds }, status: 'pending' })
        .sort({ createdAt: -1 })
        .lean(),
      FriendRequest.find({ senderId: { $in: myIds }, status: 'pending' })
        .sort({ createdAt: -1 })
        .lean()
    ]);

    // Populate user details for incoming requests
    const senderIds = incomingReqs.map(r => r.senderId);
    const senders = await User.find({
      $or: [
        { id: { $in: senderIds } },
        { username: { $in: senderIds } },
        { _id: { $in: senderIds.filter(id => mongoose.Types.ObjectId.isValid(id)) } }
      ]
    })
      .select('id displayName username avatar status isEmailVerified')
      .lean();

    const senderMap = new Map();
    senders.forEach(s => {
      const safe = getSafeUser(s);
      if (s.id) senderMap.set(s.id, safe);
      if (s.username) senderMap.set(s.username, safe);
      if (s._id) senderMap.set(s._id.toString(), safe);
    });

    const populatedIncoming = incomingReqs.map(r => ({
      ...r,
      sender: senderMap.get(r.senderId) || { id: r.senderId, displayName: 'PulseChat User', username: 'user' }
    }));

    // Populate user details for outgoing requests
    const receiverIds = outgoingReqs.map(r => r.receiverId);
    const receivers = await User.find({
      $or: [
        { id: { $in: receiverIds } },
        { username: { $in: receiverIds } },
        { _id: { $in: receiverIds.filter(id => mongoose.Types.ObjectId.isValid(id)) } }
      ]
    })
      .select('id displayName username avatar status isEmailVerified')
      .lean();

    const receiverMap = new Map();
    receivers.forEach(rec => {
      const safe = getSafeUser(rec);
      if (rec.id) receiverMap.set(rec.id, safe);
      if (rec.username) receiverMap.set(rec.username, safe);
      if (rec._id) receiverMap.set(rec._id.toString(), safe);
    });

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
      findUserAnywhere(req.user.id),
      findUserAnywhere(targetId)
    ]);

    if (!currentUser) return res.status(404).json({ error: 'Current user not found' });
    if (!targetUser) return res.status(404).json({ error: 'User does not exist' });

    const myIds = getUserIdentifiers(currentUser);
    const targetIds = getUserIdentifiers(targetUser);

    if (myIds.some(id => targetIds.includes(id))) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }

    // Check block list
    const isBlocked = (currentUser.blockedUsers || []).some(id => targetIds.includes(id)) ||
                      (targetUser.blockedUsers || []).some(id => myIds.includes(id));
    if (isBlocked) {
      return res.status(400).json({ error: 'Unable to send friend request' });
    }

    // Check if already friends
    const isAlreadyFriends = (currentUser.friends || []).some(id => targetIds.includes(id)) ||
                            (targetUser.friends || []).some(id => myIds.includes(id));
    if (isAlreadyFriends) {
      return res.status(400).json({ error: 'You are already friends' });
    }

    // Check if current user already sent a pending request
    const existingOutgoing = await FriendRequest.findOne({
      senderId: { $in: myIds },
      receiverId: { $in: targetIds },
      status: 'pending'
    });
    if (existingOutgoing) {
      return res.status(400).json({ error: 'Friend request already sent' });
    }

    // Check if target user already sent a pending request -> Auto-accept!
    const existingIncoming = await FriendRequest.findOne({
      senderId: { $in: targetIds },
      receiverId: { $in: myIds },
      status: 'pending'
    });

    const primaryMyId = currentUser.id || req.user.id;
    const primaryTargetId = targetUser.id || targetId;

    if (existingIncoming) {
      existingIncoming.status = 'accepted';
      await existingIncoming.save();

      await Promise.all([
        User.updateOne({ _id: currentUser._id }, { $addToSet: { friends: primaryTargetId } }),
        User.updateOne({ _id: targetUser._id }, { $addToSet: { friends: primaryMyId } })
      ]);

      const io = req.app.get('io');
      if (io) {
        const senderData = { requestId: existingIncoming.id, friend: getSafeUser(currentUser), friendId: primaryMyId };
        const targetData = { requestId: existingIncoming.id, friend: getSafeUser(targetUser), friendId: primaryTargetId };

        const targetRooms = [`user_${primaryTargetId}`, primaryTargetId, ...targetIds.map(i => `user_${i}`)];
        const myRooms = [`user_${primaryMyId}`, primaryMyId, ...myIds.map(i => `user_${i}`)];

        targetRooms.forEach(rm => io.to(rm).emit('friend_request_accepted', senderData));
        myRooms.forEach(rm => io.to(rm).emit('friend_request_accepted', targetData));

        targetRooms.forEach(rm => io.to(rm).emit('friend_notification', {
          type: 'friend_accepted',
          senderId: primaryMyId,
          senderName: currentUser.displayName || currentUser.username,
          senderAvatar: currentUser.avatar,
          title: 'Pulse Synced! ⚡',
          body: `${currentUser.displayName || currentUser.username} is now synced with you!`,
          friend: getSafeUser(currentUser)
        }));
      }

      return res.json({ success: true, status: 'accepted', friend: getSafeUser(targetUser) });
    }

    // Create new friend request
    const vibe = (req.body && req.body.vibe) || '⚡ Quick Pulse';
    const newRequest = await FriendRequest.create({
      id: `freq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      senderId: primaryMyId,
      receiverId: primaryTargetId,
      status: 'pending',
      createdAt: new Date()
    });

    const populatedRequest = {
      id: newRequest.id,
      senderId: primaryMyId,
      receiverId: primaryTargetId,
      status: 'pending',
      vibe,
      createdAt: newRequest.createdAt,
      sender: getSafeUser(currentUser)
    };

    const io = req.app.get('io');
    if (io) {
      const eventPayload = {
        request: populatedRequest,
        requestId: newRequest.id,
        id: newRequest.id,
        senderId: primaryMyId,
        receiverId: primaryTargetId,
        vibe,
        sender: getSafeUser(currentUser),
        createdAt: newRequest.createdAt
      };

      const notifPayload = {
        type: 'friend_request',
        senderId: primaryMyId,
        senderName: currentUser.displayName || currentUser.username,
        senderAvatar: currentUser.avatar,
        title: `⚡ Sync Request: ${currentUser.displayName || currentUser.username}`,
        body: `Wants to sync pulse with you (${vibe})`,
        requestId: newRequest.id,
        sender: getSafeUser(currentUser)
      };

      const targetRooms = Array.from(new Set([
        `user_${primaryTargetId}`,
        primaryTargetId,
        ...targetIds.map(i => `user_${i}`),
        ...targetIds
      ]));

      targetRooms.forEach(rm => {
        io.to(rm).emit('friend_request_received', eventPayload);
        io.to(rm).emit('friend_notification', notifPayload);
      });
    }

    // Push notification if subscribed
    if (targetUser.pushSubscriptions?.length > 0) {
      const pushPayload = {
        title: 'New Pulse Sync Request ⚡',
        body: `${currentUser.displayName || currentUser.username} wants to sync pulse with you!`,
        icon: currentUser.avatar || '/icon-192.png',
        badge: '/icon-192.png',
        tag: `freq-${newRequest.id}`,
        data: {
          url: '/?tab=friends&subTab=requests',
          type: 'friend_request'
        }
      };
      targetUser.pushSubscriptions.forEach(sub => {
        webpush.sendPushNotification(sub, pushPayload).catch(() => {});
      });
    }

    res.json({
      success: true,
      request: {
        id: newRequest.id,
        senderId: primaryMyId,
        receiverId: primaryTargetId,
        status: 'pending',
        vibe,
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
    const currentUser = await findUserAnywhere(req.user.id);
    const myIds = getUserIdentifiers(currentUser);
    if (req.user.id && !myIds.includes(req.user.id)) myIds.push(req.user.id);

    const request = await FriendRequest.findOne({
      id: requestId,
      receiverId: { $in: myIds },
      status: 'pending'
    });
    if (!request) return res.status(404).json({ error: 'Friend request not found or already processed' });

    request.status = 'accepted';
    await request.save();

    const [senderUser, receiverUser] = await Promise.all([
      findUserAnywhere(request.senderId),
      currentUser
    ]);

    const senderPrimaryId = senderUser?.id || request.senderId;
    const receiverPrimaryId = receiverUser?.id || req.user.id;

    if (senderUser && receiverUser) {
      await Promise.all([
        User.updateOne({ _id: receiverUser._id }, { $addToSet: { friends: senderPrimaryId } }),
        User.updateOne({ _id: senderUser._id }, { $addToSet: { friends: receiverPrimaryId } })
      ]);
    }

    const io = req.app.get('io');
    if (io) {
      const senderData = {
        requestId,
        friend: getSafeUser(receiverUser),
        friendId: receiverPrimaryId,
        status: 'accepted'
      };
      const receiverData = {
        requestId,
        friend: getSafeUser(senderUser),
        friendId: senderPrimaryId,
        status: 'accepted'
      };

      const senderRooms = Array.from(new Set([`user_${senderPrimaryId}`, senderPrimaryId, ...getUserIdentifiers(senderUser).map(i => `user_${i}`)]));
      const receiverRooms = Array.from(new Set([`user_${receiverPrimaryId}`, receiverPrimaryId, ...myIds.map(i => `user_${i}`)]));

      senderRooms.forEach(rm => io.to(rm).emit('friend_request_accepted', senderData));
      receiverRooms.forEach(rm => io.to(rm).emit('friend_request_accepted', receiverData));

      // In-app alert for the original sender
      senderRooms.forEach(rm => io.to(rm).emit('friend_notification', {
        type: 'friend_accepted',
        senderId: receiverPrimaryId,
        senderName: receiverUser.displayName || receiverUser.username,
        senderAvatar: receiverUser.avatar,
        title: 'Pulse Synced! ⚡',
        body: `${receiverUser.displayName || receiverUser.username} accepted your sync request!`,
        friend: getSafeUser(receiverUser)
      }));
    }

    // Web push to original sender if subscribed
    if (senderUser && senderUser.pushSubscriptions?.length > 0) {
      const pushPayload = {
        title: 'Pulse Synced! ⚡',
        body: `${receiverUser.displayName || receiverUser.username} accepted your sync request!`,
        icon: receiverUser.avatar || '/icon-192.png',
        badge: '/icon-192.png',
        tag: `freq-acc-${requestId}`,
        data: {
          url: '/?tab=friends',
          type: 'friend_accepted'
        }
      };
      senderUser.pushSubscriptions.forEach(sub => {
        webpush.sendPushNotification(sub, pushPayload).catch(() => {});
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
    const currentUser = await findUserAnywhere(req.user.id);
    const myIds = getUserIdentifiers(currentUser);
    if (req.user.id && !myIds.includes(req.user.id)) myIds.push(req.user.id);

    const request = await FriendRequest.findOne({
      id: requestId,
      receiverId: { $in: myIds },
      status: 'pending'
    });
    if (!request) return res.status(404).json({ error: 'Friend request not found' });

    await FriendRequest.deleteOne({ id: requestId });

    const io = req.app.get('io');
    if (io) {
      const senderRooms = [`user_${request.senderId}`, request.senderId];
      senderRooms.forEach(rm => io.to(rm).emit('friend_request_rejected', {
        requestId,
        userId: currentUser?.id || req.user.id
      }));
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
    const currentUser = await findUserAnywhere(req.user.id);
    const myIds = getUserIdentifiers(currentUser);
    if (req.user.id && !myIds.includes(req.user.id)) myIds.push(req.user.id);

    const request = await FriendRequest.findOne({
      id: requestId,
      senderId: { $in: myIds },
      status: 'pending'
    });
    if (!request) return res.status(404).json({ error: 'Friend request not found' });

    await FriendRequest.deleteOne({ id: requestId });

    const io = req.app.get('io');
    if (io) {
      const receiverRooms = [`user_${request.receiverId}`, request.receiverId];
      receiverRooms.forEach(rm => io.to(rm).emit('friend_request_cancelled', {
        requestId,
        userId: currentUser?.id || req.user.id
      }));
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
    const [currentUser, targetUser] = await Promise.all([
      findUserAnywhere(req.user.id),
      findUserAnywhere(targetId)
    ]);

    const myIds = getUserIdentifiers(currentUser);
    const targetIds = getUserIdentifiers(targetUser);
    if (req.user.id && !myIds.includes(req.user.id)) myIds.push(req.user.id);
    if (targetId && !targetIds.includes(targetId)) targetIds.push(targetId);

    await Promise.all([
      User.updateOne({ _id: currentUser?._id }, { $pull: { friends: { $in: targetIds } } }),
      User.updateOne({ _id: targetUser?._id }, { $pull: { friends: { $in: myIds } } }),
      FriendRequest.deleteMany({
        $or: [
          { senderId: { $in: myIds }, receiverId: { $in: targetIds } },
          { senderId: { $in: targetIds }, receiverId: { $in: myIds } }
        ]
      })
    ]);

    const io = req.app.get('io');
    if (io) {
      const targetRooms = [`user_${targetId}`, targetId, ...targetIds.map(i => `user_${i}`)];
      const myRooms = [`user_${req.user.id}`, req.user.id, ...myIds.map(i => `user_${i}`)];

      targetRooms.forEach(rm => io.to(rm).emit('friend_removed', { userId: currentUser?.id || req.user.id, targetId }));
      myRooms.forEach(rm => io.to(rm).emit('friend_removed', { userId: targetUser?.id || targetId, targetId }));
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
    const [currentUser, targetUser] = await Promise.all([
      findUserAnywhere(req.user.id),
      findUserAnywhere(targetId)
    ]);

    const myIds = getUserIdentifiers(currentUser);
    const targetIds = getUserIdentifiers(targetUser);
    if (req.user.id && !myIds.includes(req.user.id)) myIds.push(req.user.id);
    if (targetId && !targetIds.includes(targetId)) targetIds.push(targetId);

    if (myIds.some(id => targetIds.includes(id))) return res.json({ status: 'self' });

    if (currentUser?.friends?.some(fId => targetIds.includes(fId))) {
      return res.json({ status: 'friends' });
    }

    const sentReq = await FriendRequest.findOne({
      senderId: { $in: myIds },
      receiverId: { $in: targetIds },
      status: 'pending'
    });
    if (sentReq) {
      return res.json({ status: 'pending_sent', requestId: sentReq.id });
    }

    const receivedReq = await FriendRequest.findOne({
      senderId: { $in: targetIds },
      receiverId: { $in: myIds },
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
