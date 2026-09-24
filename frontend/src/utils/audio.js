export function playSound(type = 'received') {
  if (typeof window !== 'undefined' && localStorage.getItem('pulsechat_notifications_enabled') === 'false') {
    return;
  }
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'sent') {
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'received') {
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    }
  } catch (e) {
    // Ignore audio autoplay restrictions
  }
}

// Global active Aura soundscape instance
let activeAuraCtx = null;
let activeAuraNodes = [];
let currentAuraId = null;

export function stopPulseAuraSound() {
  if (activeAuraNodes.length > 0) {
    activeAuraNodes.forEach(node => {
      try {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      } catch (e) {}
    });
    activeAuraNodes = [];
  }
  if (activeAuraCtx) {
    try {
      activeAuraCtx.close();
    } catch (e) {}
    activeAuraCtx = null;
  }
  currentAuraId = null;
}

export function playPulseAuraSound(auraId, volume = 0.15) {
  stopPulseAuraSound();
  if (!auraId || auraId === 'off') return;

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    activeAuraCtx = new AudioContext();
    const masterGain = activeAuraCtx.createGain();
    masterGain.gain.setValueAtTime(volume, activeAuraCtx.currentTime);
    masterGain.connect(activeAuraCtx.destination);
    currentAuraId = auraId;

    if (auraId === 'rain') {
      // Pink/White noise generator + Lowpass Filter (Cyberpunk Rain)
      const bufferSize = activeAuraCtx.sampleRate * 2;
      const noiseBuffer = activeAuraCtx.createBuffer(1, bufferSize, activeAuraCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        output[i] *= 0.11;
        b6 = white * 0.115926;
      }
      const whiteNoise = activeAuraCtx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = activeAuraCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(500, activeAuraCtx.currentTime);

      whiteNoise.connect(filter);
      filter.connect(masterGain);
      whiteNoise.start();
      activeAuraNodes.push(whiteNoise, filter);
    } else if (auraId === 'lofi') {
      // Warm Lofi Synth Chords (Fmaj7 / Am9)
      const freqs = [174.61, 220.00, 261.63, 329.63]; // F, A, C, E
      freqs.forEach((freq, idx) => {
        const osc = activeAuraCtx.createOscillator();
        const filter = activeAuraCtx.createBiquadFilter();
        const gainNode = activeAuraCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, activeAuraCtx.currentTime);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(320 + idx * 40, activeAuraCtx.currentTime);

        gainNode.gain.setValueAtTime(0.08, activeAuraCtx.currentTime);

        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(masterGain);
        osc.start();
        activeAuraNodes.push(osc, filter, gainNode);
      });
    } else if (auraId === 'waves') {
      // Sunset Ocean Waves (Modulated Pink Noise)
      const bufferSize = activeAuraCtx.sampleRate * 2;
      const noiseBuffer = activeAuraCtx.createBuffer(1, bufferSize, activeAuraCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.2;
      }
      const whiteNoise = activeAuraCtx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = activeAuraCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(350, activeAuraCtx.currentTime);

      // LFO for wave swelling
      const lfo = activeAuraCtx.createOscillator();
      lfo.frequency.setValueAtTime(0.12, activeAuraCtx.currentTime); // 12-second wave cycle
      const lfoGain = activeAuraCtx.createGain();
      lfoGain.gain.setValueAtTime(250, activeAuraCtx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      whiteNoise.connect(filter);
      filter.connect(masterGain);

      whiteNoise.start();
      lfo.start();
      activeAuraNodes.push(whiteNoise, filter, lfo, lfoGain);
    } else if (auraId === 'nebula') {
      // Cosmic Space Drone
      const freqs = [110, 164.81, 220, 277.18];
      freqs.forEach(freq => {
        const osc = activeAuraCtx.createOscillator();
        const gainNode = activeAuraCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, activeAuraCtx.currentTime);

        gainNode.gain.setValueAtTime(0.05, activeAuraCtx.currentTime);

        osc.connect(gainNode);
        gainNode.connect(masterGain);
        osc.start();
        activeAuraNodes.push(osc, gainNode);
      });
    }
  } catch (e) {
    console.warn('Aura sound playback error:', e);
  }
}

export function getCurrentAuraId() {
  return currentAuraId;
}

