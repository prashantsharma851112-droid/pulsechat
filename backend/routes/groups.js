const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Group = require('../models/Group');
const User = require('../models/User');

// Create a new group
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { name, description, memberIds, avatar } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Group name is required.' });
    }

    const members = Array.from(new Set([req.user.id, ...(memberIds || [])]));

    const groupId = 'group_' + Date.now();
    const groupAvatar = avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${groupId}`;

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

// Get group details
router.get('/:groupId', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findOne({ id: req.params.groupId }).lean();
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
    const group = await Group.findOne({ id: req.params.groupId });
    if (!group) return res.status(404).json({ error: 'Group not found.' });

    if (!group.members.includes(userId)) {
      group.members.push(userId);
      await group.save();
    }
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add member.' });
  }
});

// Edit / Update group details (name, description, avatar DP)
router.put('/:groupId', authMiddleware, async (req, res) => {
  try {
    const { name, description, avatar } = req.body;
    const group = await Group.findOne({ id: req.params.groupId });
    if (!group) return res.status(404).json({ error: 'Group not found.' });

    if (name && name.trim()) group.name = name.trim();
    if (description !== undefined) group.description = description.trim();
    if (avatar) group.avatar = avatar;

    await group.save();

    const memberUsers = await User.find({ id: { $in: group.members } }, { passwordHash: 0 }).lean();
    res.json({ ...group.toObject(), memberUsers });
  } catch (err) {
    console.error('Error updating group:', err);
    res.status(500).json({ error: 'Failed to update group.' });
  }
});

// Remove member from group
router.post('/:groupId/remove-member', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.body;
    const group = await Group.findOne({ id: req.params.groupId });
    if (!group) return res.status(404).json({ error: 'Group not found.' });

    group.members = group.members.filter(m => m !== userId);
    await group.save();

    const memberUsers = await User.find({ id: { $in: group.members } }, { passwordHash: 0 }).lean();
    res.json({ ...group.toObject(), memberUsers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove member.' });
  }
});

// Leave group
router.post('/:groupId/leave', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findOne({ id: req.params.groupId });
    if (!group) return res.status(404).json({ error: 'Group not found.' });

    group.members = group.members.filter(m => m !== req.user.id);
    await group.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to leave group.' });
  }
});

module.exports = router;
