// Voice Note Pitch Filters and Audio Effects for PulseChat
// Built with Web Audio API & OfflineAudioContext with zero external dependencies.

/**
 * Converts an AudioBuffer to a standard 16-bit PCM WAV Blob
 */
export function audioBufferToWav(buffer) {
  const numChannels = Math.min(buffer.numberOfChannels, 2);
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  let result;
  if (numChannels === 2) {
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    result = new Float32Array(left.length + right.length);
    for (let i = 0; i < left.length; i++) {
      result[i * 2] = left[i];
      result[i * 2 + 1] = right[i];
    }
  } else {
    result = buffer.getChannelData(0);
  }

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = result.length * bytesPerSample;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;
  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  // RIFF Chunk Descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM float samples converted to 16-bit signed PCM
  let offset = 44;
  for (let i = 0; i < result.length; i++) {
    const s = Math.max(-1, Math.min(1, result[i]));
    const sample = s < 0 ? s * 0x8000 : s * 0x7FFF;
    view.setInt16(offset, sample, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Applies instant voice filters to an audio Blob:
 * - 'normal': Original audio untouched
 * - 'deep': Heavy pitch drop & low-end resonance
 * - 'helium': High pitch chipmunk speed effect
 * - 'lofi': Telephone bandpass + warm delay echo
 */
export async function applyVoiceFilter(audioBlob, filterType = 'normal') {
  if (!audioBlob || filterType === 'normal') {
    return audioBlob;
  }

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return audioBlob;

  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const tempCtx = new AudioCtx();
    const decodedBuffer = await tempCtx.decodeAudioData(arrayBuffer);
    tempCtx.close();

    const sampleRate = decodedBuffer.sampleRate;
    const channels = decodedBuffer.numberOfChannels;

    if (filterType === 'helium') {
      // Helium: 1.35x playback speed shift with high clarity
      const playbackRate = 1.35;
      const targetDuration = decodedBuffer.duration / playbackRate;
      const targetLength = Math.ceil(targetDuration * sampleRate);

      const offlineCtx = new OfflineAudioContext(channels, targetLength, sampleRate);
      const source = offlineCtx.createBufferSource();
      source.buffer = decodedBuffer;
      source.playbackRate.value = playbackRate;

      // Brightness high-shelf boost
      const highShelf = offlineCtx.createBiquadFilter();
      highShelf.type = 'highshelf';
      highShelf.frequency.value = 2500;
      highShelf.gain.value = 6;

      source.connect(highShelf);
      highShelf.connect(offlineCtx.destination);
      source.start(0);

      const renderedBuffer = await offlineCtx.startRendering();
      return audioBufferToWav(renderedBuffer);
    }

    if (filterType === 'deep') {
      // Deep Voice: 0.78x pitch drop with deep low-end shelf
      const playbackRate = 0.78;
      const targetDuration = decodedBuffer.duration / playbackRate;
      const targetLength = Math.ceil(targetDuration * sampleRate);

      const offlineCtx = new OfflineAudioContext(channels, targetLength, sampleRate);
      const source = offlineCtx.createBufferSource();
      source.buffer = decodedBuffer;
      source.playbackRate.value = playbackRate;

      // Bass boost filter for heavy chest resonance
      const bassBoost = offlineCtx.createBiquadFilter();
      bassBoost.type = 'lowshelf';
      bassBoost.frequency.value = 160;
      bassBoost.gain.value = 9;

      // Lowpass filter to dampen harsh sibilance
      const lowpass = offlineCtx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 4200;

      source.connect(bassBoost);
      bassBoost.connect(lowpass);
      lowpass.connect(offlineCtx.destination);
      source.start(0);

      const renderedBuffer = await offlineCtx.startRendering();
      return audioBufferToWav(renderedBuffer);
    }

    if (filterType === 'lofi') {
      // Lofi Echo: Bandpass telephone EQ + sweet tape delay
      const targetDuration = decodedBuffer.duration + 1.2; // Extra tail for echo
      const targetLength = Math.ceil(targetDuration * sampleRate);

      const offlineCtx = new OfflineAudioContext(channels, targetLength, sampleRate);
      const source = offlineCtx.createBufferSource();
      source.buffer = decodedBuffer;

      // Bandpass telephone effect (Highpass 400Hz, Lowpass 3000Hz)
      const highpass = offlineCtx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 400;

      const lowpass = offlineCtx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 3000;

      // Echo Delay Node
      const delay = offlineCtx.createDelay();
      delay.delayTime.value = 0.22; // 220ms slapback echo

      const feedback = offlineCtx.createGain();
      feedback.gain.value = 0.35; // 35% echo feedback

      const masterGain = offlineCtx.createGain();
      masterGain.gain.value = 1.1;

      // Dry Path
      source.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(masterGain);

      // Wet Path (Echo Loop)
      lowpass.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(masterGain);

      masterGain.connect(offlineCtx.destination);
      source.start(0);

      const renderedBuffer = await offlineCtx.startRendering();
      return audioBufferToWav(renderedBuffer);
    }

    return audioBlob;
  } catch (err) {
    console.error('applyVoiceFilter error:', err);
    return audioBlob;
  }
}

export const VOICE_FILTERS = [
  { id: 'normal', name: 'Normal', icon: '🎙️', desc: 'Natural voice' },
  { id: 'deep', name: 'Deep Voice', icon: '🤖', desc: 'Bass & robotic pitch' },
  { id: 'helium', name: 'Helium', icon: '🎈', desc: 'Funny chipmunk pitch' },
  { id: 'lofi', name: 'Lofi Echo', icon: '📻', desc: 'Vintage radio echo' }
];
