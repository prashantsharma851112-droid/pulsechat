export const DEFAULT_QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥'];

export const getSavedQuickReactions = () => {
  try {
    const saved = localStorage.getItem('pulsechat_quick_reactions');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return DEFAULT_QUICK_REACTIONS;
};

export const recordRecentReaction = (emoji) => {
  if (!emoji) return;
  try {
    const current = getSavedQuickReactions();
    const updated = [emoji, ...current.filter(e => e !== emoji)].slice(0, 7);
    localStorage.setItem('pulsechat_quick_reactions', JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pulsechat_quick_reactions_updated', { detail: { reactions: updated } }));
    }
    return updated;
  } catch (e) {
    return DEFAULT_QUICK_REACTIONS;
  }
};

export const saveDefaultQuickReactions = (reactionsArray) => {
  if (!Array.isArray(reactionsArray) || reactionsArray.length === 0) return;
  try {
    localStorage.setItem('pulsechat_quick_reactions', JSON.stringify(reactionsArray.slice(0, 7)));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pulsechat_quick_reactions_updated', { detail: { reactions: reactionsArray.slice(0, 7) } }));
    }
  } catch (e) {}
};
