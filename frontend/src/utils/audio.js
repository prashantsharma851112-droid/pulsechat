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
let activeMasterGain = null;
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
  activeMasterGain = null;
  currentAuraId = null;
}

export function setPulseAuraVolume(vol = 0.7) {
  if (activeMasterGain && activeAuraCtx) {
    try {
      const cleanVol = Math.max(0, Math.min(1, vol));
      activeMasterGain.gain.setValueAtTime(activeMasterGain.gain.value, activeAuraCtx.currentTime);
      activeMasterGain.gain.linearRampToValueAtTime(cleanVol, activeAuraCtx.currentTime + 0.05);
    } catch (e) {}
  }
}

export function playPulseAuraSound(auraId, volume = 0.7) {
  stopPulseAuraSound();
  if (!auraId || auraId === 'off') return;

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    activeAuraCtx = new AudioContext();
    const masterGain = activeAuraCtx.createGain();
    const initialVol = Math.max(0, Math.min(1, Number(volume) || 0.7));
    masterGain.gain.setValueAtTime(initialVol, activeAuraCtx.currentTime);
    masterGain.connect(activeAuraCtx.destination);
    activeMasterGain = masterGain;
    currentAuraId = auraId;

    if (auraId === 'rain') {
      // Cyberpunk Rain - Increased volume & richer filter frequency
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
        output[i] *= 0.35; // Boosted from 0.11 for rich rain sound
        b6 = white * 0.115926;
      }
      const whiteNoise = activeAuraCtx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = activeAuraCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1100, activeAuraCtx.currentTime); // Crisp rain

      whiteNoise.connect(filter);
      filter.connect(masterGain);
      whiteNoise.start();
      activeAuraNodes.push(whiteNoise, filter);
    } else if (auraId === 'lofi') {
      // Warm Lofi Chill Beats (Lush 7th Chords + Sub Bass + Tape Wobble + Vinyl Texture + Beat Pulse)
      const padNotes = [
        { freq: 174.61, gain: 0.28 }, // F3
        { freq: 220.00, gain: 0.25 }, // A3
        { freq: 261.63, gain: 0.22 }, // C4
        { freq: 329.63, gain: 0.20 }, // E4
        { freq: 392.00, gain: 0.16 }  // G4
      ];

      padNotes.forEach(({ freq, gain }) => {
        const osc = activeAuraCtx.createOscillator();
        const subOsc = activeAuraCtx.createOscillator();
        const filter = activeAuraCtx.createBiquadFilter();
        const gainNode = activeAuraCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, activeAuraCtx.currentTime);

        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(freq * 0.5, activeAuraCtx.currentTime);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(750, activeAuraCtx.currentTime);

        // Tape Wobble (Vibrato LFO)
        const lfo = activeAuraCtx.createOscillator();
        const lfoGain = activeAuraCtx.createGain();
        lfo.frequency.setValueAtTime(4.2, activeAuraCtx.currentTime);
        lfoGain.gain.setValueAtTime(2.2, activeAuraCtx.currentTime);
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start();

        gainNode.gain.setValueAtTime(gain, activeAuraCtx.currentTime);

        osc.connect(filter);
        subOsc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(masterGain);

        osc.start();
        subOsc.start();
        activeAuraNodes.push(osc, subOsc, filter, gainNode, lfo, lfoGain);
      });

      // Lofi Vinyl Texture
      const bufferSize = activeAuraCtx.sampleRate * 2;
      const crackleBuffer = activeAuraCtx.createBuffer(1, bufferSize, activeAuraCtx.sampleRate);
      const crackleData = crackleBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        crackleData[i] = Math.random() < 0.002 ? (Math.random() * 2 - 1) * 0.22 : (Math.random() * 2 - 1) * 0.02;
      }
      const crackleSrc = activeAuraCtx.createBufferSource();
      crackleSrc.buffer = crackleBuffer;
      crackleSrc.loop = true;

      const crackleFilter = activeAuraCtx.createBiquadFilter();
      crackleFilter.type = 'bandpass';
      crackleFilter.frequency.setValueAtTime(1600, activeAuraCtx.currentTime);

      crackleSrc.connect(crackleFilter);
      crackleFilter.connect(masterGain);
      crackleSrc.start();
      activeAuraNodes.push(crackleSrc, crackleFilter);

      // Smooth Chillhop Rhythm Beat Pulse (~84 bpm)
      const beatInterval = 1.42;
      const runLofiBeat = () => {
        if (!activeAuraCtx || currentAuraId !== 'lofi') return;
        try {
          const now = activeAuraCtx.currentTime;
          // Soft Lofi Kick
          const kickOsc = activeAuraCtx.createOscillator();
          const kickGain = activeAuraCtx.createGain();
          kickOsc.type = 'sine';
          kickOsc.frequency.setValueAtTime(95, now);
          kickOsc.frequency.exponentialRampToValueAtTime(38, now + 0.16);
          kickGain.gain.setValueAtTime(0.38, now);
          kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
          kickOsc.connect(kickGain);
          kickGain.connect(masterGain);
          kickOsc.start(now);
          kickOsc.stop(now + 0.16);

          // Soft Snare Brush
          const snareOsc = activeAuraCtx.createOscillator();
          const snareGain = activeAuraCtx.createGain();
          snareOsc.type = 'triangle';
          snareOsc.frequency.setValueAtTime(240, now + beatInterval / 2);
          snareOsc.frequency.exponentialRampToValueAtTime(110, now + beatInterval / 2 + 0.12);
          snareGain.gain.setValueAtTime(0.22, now + beatInterval / 2);
          snareGain.gain.exponentialRampToValueAtTime(0.001, now + beatInterval / 2 + 0.12);
          snareOsc.connect(snareGain);
          snareGain.connect(masterGain);
          snareOsc.start(now + beatInterval / 2);
          snareOsc.stop(now + beatInterval / 2 + 0.12);
        } catch (e) {}
      };

      runLofiBeat();
      const beatTimer = setInterval(runLofiBeat, beatInterval * 1000);
      activeAuraNodes.push({ stop: () => clearInterval(beatTimer), disconnect: () => {} });
    } else if (auraId === 'waves') {
      // Sunset Ocean Waves (Modulated Pink Noise)
      const bufferSize = activeAuraCtx.sampleRate * 2;
      const noiseBuffer = activeAuraCtx.createBuffer(1, bufferSize, activeAuraCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.45; // Boosted from 0.2
      }
      const whiteNoise = activeAuraCtx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = activeAuraCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(700, activeAuraCtx.currentTime);

      const lfo = activeAuraCtx.createOscillator();
      lfo.frequency.setValueAtTime(0.12, activeAuraCtx.currentTime);
      const lfoGain = activeAuraCtx.createGain();
      lfoGain.gain.setValueAtTime(400, activeAuraCtx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      whiteNoise.connect(filter);
      filter.connect(masterGain);

      whiteNoise.start();
      lfo.start();
      activeAuraNodes.push(whiteNoise, filter, lfo, lfoGain);
    } else if (auraId === 'nebula') {
      // Space Nebula Synth Drone - Deep rich ambient pads
      const freqs = [110, 164.81, 220, 277.18];
      freqs.forEach(freq => {
        const osc = activeAuraCtx.createOscillator();
        const gainNode = activeAuraCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, activeAuraCtx.currentTime);

        gainNode.gain.setValueAtTime(0.25, activeAuraCtx.currentTime); // Boosted from 0.05

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

