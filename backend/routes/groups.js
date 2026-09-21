const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Group = require('../models/Group');
const User = require('../models/User');
const { uploadToCloudinary } = require('../utils/cloudinary');

// Create a new group
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { name, description, memberIds, avatar } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Group name is required.' });
    }

    const members = Array.from(new Set([req.user.id, ...(memberIds || [])]));

    const groupId = 'group_' + Date.now();
    let groupAvatar = avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${groupId}`;
    if (avatar && typeof avatar === 'string' && avatar.startsWith('data:')) {
      groupAvatar = await uploadToCloudinary(avatar, 'pulsechat_group_avatars', 'image');
    }

    const newGroup = await Group.create({
      id: groupId,
      name: name.trim(),
      description: description || 'Welcome to our group chat!',
      avatar: groupAvatar,
      adminId: req.user.id,
      members
    });

    res.status(201).json(newGroup);
  } catch (err) {
    console.error('Error creating group:', err);
    res.status(500).json({ error: 'Failed to create group.' });
  }
});

// Get groups for current user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user.id }).lean();
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch groups.' });
  }
});

const getGroupQuery = (param) => {
  const isHex = typeof param === 'string' && /^[0-9a-fA-F]{24}$/.test(param);
  return isHex ? { $or: [{ id: param }, { _id: param }] } : { id: param };
};

// Get group details
router.get('/:groupId', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findOne(getGroupQuery(req.params.groupId)).lean();
    if (!group) return res.status(404).json({ error: 'Group not found.' });

    // Fetch details of members
    const memberUsers = await User.find({ id: { $in: group.members } }, { passwordHash: 0 }).lean();
    res.json({ ...group, memberUsers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch group details.' });
  }
});

// Add member to group
router.post('/:groupId/add-member', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.body;
    const group = await Group.findOne(getGroupQuery(req.params.groupId));
    if (!group) return res.status(404).json({ error: 'Group not found.' });

    if (!group.members.includes(userId)) {
      group.members.push(userId);
      await group.save();
    }

    const memberUsers = await User.find({ id: { $in: group.members } }, { passwordHash: 0 }).lean();
    const updatedData = { ...group.toObject(), memberUsers };

    const io = req.app.get('io');
    if (io) {
      io.to(group.id).emit('group_updated', updatedData);
      group.members.forEach(mId => io.to(`user_${mId}`).emit('group_updated', updatedData));
    }

    res.json(updatedData);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add member.' });
  }
});

// Edit / Update group details (name, description, avatar DP)
router.put('/:groupId', authMiddleware, async (req, res) => {
  try {
    const { name, description, avatar } = req.body;
    const group = await Group.findOne(getGroupQuery(req.params.groupId));
    if (!group) return res.status(404).json({ error: 'Group not found.' });

    if (name && name.trim()) group.name = name.trim();
    if (avatar) {
      if (typeof avatar === 'string' && avatar.startsWith('data:')) {
        group.avatar = await uploadToCloudinary(avatar, 'pulsechat_group_avatars', 'image');
      } else {
        group.avatar = avatar;
      }
    }

    await group.save();

    const memberUsers = await User.find({ id: { $in: group.members } }, { passwordHash: 0 }).lean();
    const updatedGroupData = { ...group.toObject(), memberUsers };

    // Broadcast group update in real-time to all members
    const io = req.app.get('io');
    if (io) {
      io.to(group.id).emit('group_updated', updatedGroupData);
      if (Array.isArray(group.members)) {
        group.members.forEach(mId => io.to(`user_${mId}`).emit('group_updated', updatedGroupData));
      }
    }

    res.json(updatedGroupData);
  } catch (err) {
    console.error('Error updating group:', err);
    res.status(500).json({ error: 'Failed to update group.' });
  }
});

// Remove member from group
router.post('/:groupId/remove-member', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.body;
    const group = await Group.findOne(getGroupQuery(req.params.groupId));
    if (!group) return res.status(404).json({ error: 'Group not found.' });

    group.members = group.members.filter(m => m !== userId);
    await group.save();

    const memberUsers = await User.find({ id: { $in: group.members } }, { passwordHash: 0 }).lean();
    const updatedData = { ...group.toObject(), memberUsers };

    const io = req.app.get('io');
    if (io) {
      io.to(group.id).emit('group_updated', updatedData);
      group.members.forEach(mId => io.to(`user_${mId}`).emit('group_updated', updatedData));
    }

    res.json(updatedData);
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove member.' });
  }
});

// Leave group
router.post('/:groupId/leave', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findOne(getGroupQuery(req.params.groupId));
    if (!group) return res.status(404).json({ error: 'Group not found.' });

    group.members = group.members.filter(m => m !== req.user.id);
    await group.save();

    const io = req.app.get('io');
    if (io) {
      io.to(group.id).emit('group_updated', group.toObject());
      group.members.forEach(mId => io.to(`user_${mId}`).emit('group_updated', group.toObject()));
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to leave group.' });
  }
});

module.exports = router;
