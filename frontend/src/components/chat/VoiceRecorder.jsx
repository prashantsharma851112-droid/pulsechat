import React, { useState, useEffect, useRef } from 'react';
import { Square, Send, X, MicOff, Play, Pause, Sparkles, RefreshCw } from 'lucide-react';
import { applyVoiceFilter, VOICE_FILTERS } from '../../utils/voiceFilters';

function VoiceRecorder({ onSendVoice, onCancel }) {
  const [recording, setRecording] = useState(false);
  const [rawAudioBlob, setRawAudioBlob] = useState(null);
  const [filteredAudioBlob, setFilteredAudioBlob] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('normal');
  const [isFiltering, setIsFiltering] = useState(false);
  const [timer, setTimer] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const audioPreviewRef = useRef(null);
  const chunksRef = useRef([]);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const canvasRef = useRef(null);

  const getSupportedMimeType = () => {
    if (typeof MediaRecorder === 'undefined') return '';
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg'];
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return '';
  };

  const startRecording = async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000
        }
      });
      streamRef.current = stream;

      // Realtime AudioContext & AnalyserNode for dancing live microphone waves
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        try {
          const audioCtx = new AudioCtx();
          audioCtxRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const numBars = 14;

          const updateFrequencyBars = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);

            const canvas = canvasRef.current;
            if (canvas) {
              const ctx = canvas.getContext('2d');
              if (ctx) {
                const w = canvas.width;
                const h = canvas.height;
                ctx.clearRect(0, 0, w, h);

                const step = Math.max(1, Math.floor(dataArray.length / numBars));
                const totalGaps = (numBars - 1) * 3;
                const barWidth = Math.max(2, (w - totalGaps) / numBars);

                for (let i = 0; i < numBars; i++) {
                  const val = dataArray[i * step] || 0;
                  const normalized = Math.max(0.18, Math.min(1.0, (val / 255) * 1.55));
                  const barHeight = Math.max(4, Math.round(normalized * h));
                  const x = i * (barWidth + 3);
                  const y = Math.round((h - barHeight) / 2);

                  const grad = ctx.createLinearGradient(0, y + barHeight, 0, y);
                  grad.addColorStop(0, '#ef4444');
                  grad.addColorStop(1, '#f97316');
                  ctx.fillStyle = grad;

                  ctx.beginPath();
                  if (typeof ctx.roundRect === 'function') {
                    ctx.roundRect(x, y, barWidth, barHeight, 2.5);
                  } else {
                    ctx.rect(x, y, barWidth, barHeight);
                  }
                  ctx.fill();
                }
              }
            }
            animFrameRef.current = requestAnimationFrame(updateFrequencyBars);
          };
          animFrameRef.current = requestAnimationFrame(updateFrequencyBars);
        } catch (e) {
          console.warn('AudioContext analyser error:', e);
        }
      }

      const mimeType = getSupportedMimeType();
      const options = {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 128000
      };
      let mediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, options);
      } catch (errOptions) {
        mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      }
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalType = mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: finalType });
        setRawAudioBlob(blob);
        setFilteredAudioBlob(blob);
      };

      mediaRecorder.start();
      setRecording(true);

      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } catch (err) {
      console.error("Mic error:", err);
      setErrorMsg("Microphone access is required to record voice notes.");
    }
  };

  const stopAndCleanupMedia = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      try { audioCtxRef.current.close(); } catch (e) {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioPreviewRef.current) {
      try {
        audioPreviewRef.current.pause();
        audioPreviewRef.current.src = '';
      } catch (e) {}
    }
  };

  useEffect(() => {
    startRecording();
    return () => {
      stopAndCleanupMedia();
    };
  }, []);

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      try { audioCtxRef.current.close(); } catch (e) {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setRecording(false);
  };

  // Switch voice filter with instant audio rendering
  const handleSelectFilter = async (filterId) => {
    if (!rawAudioBlob || filterId === selectedFilter) return;
    stopPreviewAudio();
    setSelectedFilter(filterId);

    if (filterId === 'normal') {
      setFilteredAudioBlob(rawAudioBlob);
      return;
    }

    setIsFiltering(true);
    try {
      const processed = await applyVoiceFilter(rawAudioBlob, filterId);
      setFilteredAudioBlob(processed);
    } catch (e) {
      console.warn("Filter application error:", e);
      setFilteredAudioBlob(rawAudioBlob);
    } finally {
      setIsFiltering(false);
    }
  };

  const stopPreviewAudio = () => {
    if (audioPreviewRef.current) {
      try {
        audioPreviewRef.current.pause();
        audioPreviewRef.current.currentTime = 0;
      } catch (e) {}
    }
    setIsPlayingPreview(false);
  };

  const togglePreview = () => {
    const targetBlob = filteredAudioBlob || rawAudioBlob;
    if (!targetBlob) return;

    if (isPlayingPreview && audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      stopPreviewAudio();
      const url = URL.createObjectURL(targetBlob);
      const audio = new Audio(url);
      audioPreviewRef.current = audio;
      audio.play().then(() => {
        setIsPlayingPreview(true);
      }).catch(err => console.error("Playback error:", err));

      audio.onended = () => setIsPlayingPreview(false);
    }
  };

  const handleSend = async () => {
    stopPreviewAudio();
    if (!rawAudioBlob && recording) {
      // Direct send while recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = async () => {
          const mimeType = getSupportedMimeType() || 'audio/wav';
          const blob = new Blob(chunksRef.current, { type: mimeType });
          let finalToSend = blob;
          if (selectedFilter !== 'normal') {
            try {
              finalToSend = await applyVoiceFilter(blob, selectedFilter);
            } catch (e) {}
          }
          convertAndSend(finalToSend, selectedFilter);
        };
        stopRecording();
        return;
      }
    }

    const finalBlob = filteredAudioBlob || rawAudioBlob;
    if (finalBlob) {
      convertAndSend(finalBlob, selectedFilter);
    }
  };

  const convertAndSend = (blob, filter) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      onSendVoice(reader.result, filter);
    };
  };

  if (errorMsg) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', padding: '0.4rem 0.9rem', borderRadius: '24px', color: '#f87171', fontSize: '0.82rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MicOff size={16} />
          <span>{errorMsg}</span>
        </div>
        <button onClick={onCancel} style={{ background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.4rem',
      background: 'var(--bg-card, #121826)',
      padding: '0.5rem 0.75rem',
      borderRadius: '20px',
      border: '1px solid var(--border, rgba(255,255,255,0.1))',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      minWidth: 0
    }}>
      {/* Voice Pitch Filters Bar (Displayed after recording or during recording) */}
      {!recording && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '2px',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch'
        }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
            <Sparkles size={12} color="#a855f7" /> Filter:
          </span>
          {VOICE_FILTERS.map(f => {
            const isSelected = selectedFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => handleSelectFilter(f.id)}
                disabled={isFiltering}
                style={{
                  background: isSelected ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'rgba(255,255,255,0.06)',
                  color: isSelected ? '#ffffff' : 'var(--text-muted, #94a3b8)',
                  border: isSelected ? '1px solid #818cf8' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '14px',
                  padding: '3px 10px',
                  fontSize: '0.72rem',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 2px 8px rgba(99, 102, 241, 0.4)' : 'none'
                }}
                title={f.desc}
              >
                <span>{f.icon}</span>
                <span>{f.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Recording Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', minWidth: 0 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{ background: 'transparent', color: '#ef4444', display: 'flex', alignItems: 'center', flexShrink: 0, padding: '4px', cursor: 'pointer', border: 'none' }}
          title="Cancel"
        >
          <X size={20} />
        </button>

        <span style={{ fontSize: '0.82rem', color: recording ? '#ef4444' : 'var(--accent, #6366f1)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {recording ? (
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }} />
          ) : '🎙️'}
          {Math.floor(timer / 60)}:{('0' + (timer % 60)).slice(-2)}
        </span>

        {/* Live Dancing Waveform Canvas when Recording (Zero React re-render, Web Audio GPU pipe) */}
        {recording ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', height: '24px', minWidth: 0, padding: '0 4px', overflow: 'hidden' }}>
            <canvas
              ref={canvasRef}
              width={220}
              height={24}
              style={{ width: '100%', height: '24px', display: 'block' }}
            />
          </div>
        ) : (
          <div style={{ flex: 1, minWidth: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>
            {isFiltering ? '✨ Applying voice filter...' : `Recorded! ${selectedFilter !== 'normal' ? `(${VOICE_FILTERS.find(f => f.id === selectedFilter)?.name})` : 'Ready to send'}`}
          </div>
        )}

        {!recording && (rawAudioBlob || filteredAudioBlob) && (
          <button
            type="button"
            onClick={togglePreview}
            disabled={isFiltering}
            style={{
              background: 'var(--hover-bg, rgba(255,255,255,0.08))',
              color: 'var(--text-main, #ffffff)',
              padding: '6px',
              borderRadius: '50%',
              border: '1px solid var(--border, rgba(255,255,255,0.15))',
              cursor: isFiltering ? 'wait' : 'pointer',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title={isPlayingPreview ? 'Pause Preview' : 'Play Preview'}
          >
            {isFiltering ? <RefreshCw size={14} className="animate-spin" /> : (isPlayingPreview ? <Pause size={15} /> : <Play size={15} />)}
          </button>
        )}

        {recording ? (
          <button
            type="button"
            onClick={stopRecording}
            style={{ background: '#ef4444', color: '#fff', width: '34px', height: '34px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: 'none', boxShadow: '0 2px 10px rgba(239, 68, 68, 0.4)' }}
            title="Stop Recording"
          >
            <Square size={14} />
          </button>
        ) : null}

        <button
          type="button"
          onClick={handleSend}
          disabled={isFiltering}
          style={{
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            color: '#fff',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            cursor: isFiltering ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            border: 'none',
            boxShadow: '0 2px 10px rgba(99, 102, 241, 0.45)'
          }}
          title="Send Voice Note"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

export default React.memo(VoiceRecorder);
