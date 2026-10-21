/**
 * PulseChat Vibe Radar Hydration Engine
 *
 * Safely hydrates active user vibe auras from MongoDB into the in-memory
 * userVibeAuras Map on server startup so vibes survive container restarts.
 */

async function hydrateUserVibeAuras(UserModel, vibeAurasMap, currentTime = Date.now()) {
  if (!UserModel || typeof UserModel.find !== 'function') return 0;
  if (!vibeAurasMap || typeof vibeAurasMap.set !== 'function') return 0;

  const usersWithVibes = await UserModel.find({
    'vibeAura.auraType': { $exists: true, $ne: 'none' },
    'vibeAura.cleared': { $ne: true }
  }).lean();

  if (Array.isArray(usersWithVibes)) {
    for (const u of usersWithVibes) {
      if (!u || !u.vibeAura || u.vibeAura.cleared || u.vibeAura.auraType === 'none') {
        continue;
      }

      // Check if trial aura has expired
      if (u.vibeAura.trialExpiresAt && currentTime > Number(u.vibeAura.trialExpiresAt)) {
        if (typeof UserModel.updateOne === 'function') {
          UserModel.updateOne({ _id: u._id }, { $unset: { vibeAura: 1 } }).catch(() => {});
        }
        continue;
      }

      const clean = {
        ...u.vibeAura,
        userId: u.id || u.username || String(u._id || ''),
        username: u.username || ''
      };

      if (u.id) vibeAurasMap.set(String(u.id), clean);
      if (u._id) vibeAurasMap.set(String(u._id), clean);
      if (u.username) vibeAurasMap.set(String(u.username), clean);
    }
  }

  return vibeAurasMap.size;
}

module.exports = {
  hydrateUserVibeAuras
};
