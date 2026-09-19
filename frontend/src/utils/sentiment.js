// PulseChat Sentence & Word Sentiment Analyzer
// Evaluates chat messages sentence-by-sentence and word-by-word
// Supports English + Hinglish emotion vocabularies

export const MOOD_DEFINITIONS = {
  Joy: {
    mood: 'Joy',
    color: '#10b981', // Emerald green
    emoji: '😊',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.3)'
  },
  Love: {
    mood: 'Love',
    color: '#ec4899', // Pink
    emoji: '❤️',
    bg: 'rgba(236, 72, 153, 0.12)',
    border: 'rgba(236, 72, 153, 0.3)'
  },
  Calm: {
    mood: 'Calm',
    color: '#06b6d4', // Cyan
    emoji: '🌿',
    bg: 'rgba(6, 182, 212, 0.12)',
    border: 'rgba(6, 182, 212, 0.3)'
  },
  Excited: {
    mood: 'Excited',
    color: '#f59e0b', // Amber
    emoji: '✨',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.3)'
  },
  Sad: {
    mood: 'Sad',
    color: '#3b82f6', // Blue
    emoji: '🥺',
    bg: 'rgba(59, 130, 246, 0.12)',
    border: 'rgba(59, 130, 246, 0.3)'
  },
  Angry: {
    mood: 'Angry',
    color: '#f43f5e', // Rose red
    emoji: '😠',
    bg: 'rgba(244, 63, 94, 0.12)',
    border: 'rgba(244, 63, 94, 0.3)'
  },
  Casual: {
    mood: 'Casual',
    color: '#6366f1', // Indigo
    emoji: '💬',
    bg: 'rgba(99, 102, 241, 0.12)',
    border: 'rgba(99, 102, 241, 0.3)'
  }
};

// Word-level dictionaries with emotion categories
const WORD_DICTIONARY = {
  // Joy / Happiness
  happy: 'Joy',
  khush: 'Joy',
  haha: 'Joy',
  hahaha: 'Joy',
  lol: 'Joy',
  rofl: 'Joy',
  awesome: 'Joy',
  mast: 'Joy',
  badiya: 'Joy',
  badhiya: 'Joy',
  great: 'Joy',
  cool: 'Joy',
  party: 'Joy',
  congrat: 'Joy',
  congrats: 'Joy',
  congratulations: 'Joy',
  smile: 'Joy',
  yay: 'Joy',
  nice: 'Joy',
  good: 'Joy',
  sweet: 'Joy',
  wah: 'Joy',
  zabardast: 'Joy',
  mazedar: 'Joy',
  blessed: 'Joy',

  // Love / Affection
  love: 'Love',
  pyaar: 'Love',
  pyar: 'Love',
  ishq: 'Love',
  mohabbat: 'Love',
  heart: 'Love',
  dil: 'Love',
  'miss you': 'Love',
  missyou: 'Love',
  baby: 'Love',
  babe: 'Love',
  sweetheart: 'Love',
  jaan: 'Love',
  darling: 'Love',
  cutie: 'Love',
  cute: 'Love',
  caring: 'Love',
  lovely: 'Love',
  hugs: 'Love',
  hug: 'Love',
  kiss: 'Love',
  beautiful: 'Love',
  sundar: 'Love',

  // Calm / Peaceful
  ok: 'Calm',
  okay: 'Calm',
  thik: 'Calm',
  theek: 'Calm',
  sahi: 'Calm',
  relax: 'Calm',
  chill: 'Calm',
  peace: 'Calm',
  shanti: 'Calm',
  sure: 'Calm',
  bilkul: 'Calm',
  alright: 'Calm',
  calm: 'Calm',
  easy: 'Calm',
  halka: 'Calm',
  'no worries': 'Calm',
  sorted: 'Calm',
  agreed: 'Calm',

  // Excited / Amazed
  wow: 'Excited',
  omg: 'Excited',
  amazed: 'Excited',
  amazing: 'Excited',
  shock: 'Excited',
  surprise: 'Excited',
  superb: 'Excited',
  hyped: 'Excited',
  thrilled: 'Excited',
  fire: 'Excited',
  letsgo: 'Excited',
  lit: 'Excited',
  insane: 'Excited',
  crazy: 'Excited',
  op: 'Excited',

  // Sad / Empathy / Regret
  sad: 'Sad',
  sorry: 'Sad',
  cry: 'Sad',
  crying: 'Sad',
  hurt: 'Sad',
  dukh: 'Sad',
  dard: 'Sad',
  broken: 'Sad',
  upset: 'Sad',
  sigh: 'Sad',
  tear: 'Sad',
  tears: 'Sad',
  depress: 'Sad',
  depressed: 'Sad',
  udas: 'Sad',
  maafi: 'Sad',
  regret: 'Sad',
  lonely: 'Sad',
  alone: 'Sad',
  miss: 'Sad',
  pareshan: 'Sad',
  tension: 'Sad',

  // Angry / Heated (Emotional trigger words)
  angry: 'Angry',
  gussa: 'Angry',
  hate: 'Angry',
  'hate you': 'Angry',
  irritat: 'Angry',
  irritated: 'Angry',
  irritating: 'Angry',
  'shut up': 'Angry',
  shutup: 'Angry',
  bakwas: 'Angry',
  annoy: 'Angry',
  annoyed: 'Angry',
  annoying: 'Angry',
  furious: 'Angry',
  mad: 'Angry',
  pagal: 'Angry',
  'chup kar': 'Angry',
  chupkar: 'Angry',
  worst: 'Angry',
  disgusting: 'Angry',
  idiot: 'Angry',
  stupid: 'Angry',
  chutiya: 'Angry',
  nonsense: 'Angry'
};

// Emotional trigger words that warrant the 3-second cooldown pause
const EMOTIONAL_TRIGGER_REGEX = /\b(angry|gussa|hate|worst|shut up|shutup|furious|annoyed|annoy|mad|bakwas|pagal|chup kar|chupkar|idiot|stupid|irritated|hate you|breakup)\b/i;

/**
 * Checks whether a text contains high-intensity emotional words
 * requiring the 3s cooldown pause with Cancel / Send Now
 */
export function isEmotionalTriggerMessage(text) {
  if (!text || typeof text !== 'string') return false;
  return EMOTIONAL_TRIGGER_REGEX.test(text);
}

/**
 * Breaks a single text into sentences and scores words
 */
export function analyzeSentenceAndWordMood(text) {
  if (!text || typeof text !== 'string') {
    return MOOD_DEFINITIONS.Casual;
  }

  const cleanText = text.trim();
  if (!cleanText) return MOOD_DEFINITIONS.Casual;

  // Split into sentences using punctuation (. ! ? \n ;)
  const rawSentences = cleanText.split(/[.!?;\n]+/).map(s => s.trim()).filter(Boolean);
  const sentences = rawSentences.length > 0 ? rawSentences : [cleanText];

  const moodCounts = {
    Joy: 0,
    Love: 0,
    Calm: 0,
    Excited: 0,
    Sad: 0,
    Angry: 0
  };

  // Analyze each sentence and its constituent words
  sentences.forEach(sentence => {
    const words = sentence.toLowerCase().split(/\s+/);
    const sentenceLower = sentence.toLowerCase();

    // Check multi-word keys first
    ['shut up', 'chup kar', 'miss you', 'no worries', 'hate you'].forEach(phrase => {
      if (sentenceLower.includes(phrase)) {
        const cat = WORD_DICTIONARY[phrase];
        if (cat && moodCounts[cat] !== undefined) {
          moodCounts[cat] += 2.5; // Multi-word phrases have higher weight
        }
      }
    });

    // Check individual words
    words.forEach(word => {
      const cleanWord = word.replace(/[^a-z0-9]/gi, '');
      if (!cleanWord) return;

      if (WORD_DICTIONARY[cleanWord]) {
        const cat = WORD_DICTIONARY[cleanWord];
        moodCounts[cat] = (moodCounts[cat] || 0) + 1.2;
      } else {
        // Partial matches for common prefixes
        for (const [dictWord, cat] of Object.entries(WORD_DICTIONARY)) {
          if (cleanWord.length >= 4 && (cleanWord.startsWith(dictWord) || dictWord.startsWith(cleanWord))) {
            moodCounts[cat] = (moodCounts[cat] || 0) + 0.8;
            break;
          }
        }
      }
    });
  });

  // Find dominant mood
  let dominantMood = 'Casual';
  let highestScore = 0;

  for (const [mood, score] of Object.entries(moodCounts)) {
    if (score > highestScore && score >= 1) {
      highestScore = score;
      dominantMood = mood;
    }
  }

  return MOOD_DEFINITIONS[dominantMood] || MOOD_DEFINITIONS.Casual;
}

/**
 * Builds the timeline progression of moods across recent sentences and messages
 * @param {Array} messages - Message objects
 * @param {string|null} pendingCooldownMsg - Currently cooling down message, if any
 * @returns {Object} { currentMood, timelineSteps: Array<{ mood, emoji, color, textPreview }> }
 */
export function calculateConversationMoodTimeline(messages = [], pendingCooldownMsg = null) {
  const steps = [];

  // Look through recent messages (up to 8 text messages) in chronological order
  const recentTexts = [];
  if (Array.isArray(messages)) {
    for (let i = Math.max(0, messages.length - 8); i < messages.length; i++) {
      const m = messages[i];
      if (m && m.type === 'text' && m.content && m.content.trim()) {
        recentTexts.push({
          content: m.content.trim(),
          senderId: m.senderId
        });
      }
    }
  }

  // If there's an active pending cooling message, append it to the timeline
  if (pendingCooldownMsg && pendingCooldownMsg.trim()) {
    recentTexts.push({
      content: pendingCooldownMsg.trim(),
      isPending: true
    });
  }

  // Generate timeline steps from recent sentences
  recentTexts.forEach((item, idx) => {
    // Break item into individual sentences
    const rawSentences = item.content.split(/[.!?;\n]+/).map(s => s.trim()).filter(Boolean);
    const sentences = rawSentences.length > 0 ? rawSentences : [item.content];

    sentences.forEach((sent) => {
      if (sent.length < 2) return;
      const moodInfo = analyzeSentenceAndWordMood(sent);
      steps.push({
        id: `step-${idx}-${steps.length}`,
        mood: moodInfo.mood,
        emoji: moodInfo.emoji,
        color: moodInfo.color,
        bg: moodInfo.bg,
        border: moodInfo.border,
        preview: sent.length > 25 ? sent.substring(0, 22) + '...' : sent,
        isPending: !!item.isPending
      });
    });
  });

  // Keep last 4-5 steps for header display
  const displaySteps = steps.slice(-5);

  // Dominant/latest mood determination
  let currentMood = MOOD_DEFINITIONS.Casual;
  if (displaySteps.length > 0) {
    // Latest step defines the active tone
    const latestStep = displaySteps[displaySteps.length - 1];
    currentMood = MOOD_DEFINITIONS[latestStep.mood] || MOOD_DEFINITIONS.Casual;
  }

  return {
    currentMood,
    timelineSteps: displaySteps
  };
}
