import React, { useState, useEffect, useRef } from 'react';
import { Square, Send, X, MicOff, Play, Pause } from 'lucide-react';

export default function VoiceRecorder({ onSendVoice, onCancel }) {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [timer, setTimer] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const audioPreviewRef = useRef(null);
  const chunksRef = useRef([]);

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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalType = mimeType || 'audio/wav';
        const blob = new Blob(chunksRef.current, { type: finalType });
        setAudioBlob(blob);
      };

      mediaRecorder.start(100);
      setRecording(true);

      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } catch (err) {
      console.error("Mic error:", err);
      setErrorMsg("Microphone access is required to record voice notes.");
    }
  };

  const stopAndCleanupMedia = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setRecording(false);
  };

  const togglePreview = () => {
    if (!audioBlob) return;
    if (isPlayingPreview && audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audioPreviewRef.current = audio;
      audio.play().then(() => {
        setIsPlayingPreview(true);
      }).catch(err => console.error("Playback error:", err));

      audio.onended = () => setIsPlayingPreview(false);
    }
  };

  const handleSend = () => {
    if (!audioBlob && recording) {
      // If user clicks send directly while recording, stop & send
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = () => {
          const mimeType = getSupportedMimeType() || 'audio/wav';
          const blob = new Blob(chunksRef.current, { type: mimeType });
          convertAndSend(blob);
        };
        stopRecording();
        return;
      }
    }
    if (audioBlob) {
      convertAndSend(audioBlob);
    }
  };

  const convertAndSend = (blob) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      onSendVoice(reader.result);
    };
  };

  if (errorMsg) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', padding: '0.4rem 0.9rem', borderRadius: '24px', color: '#f87171', fontSize: '0.82rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MicOff size={16} />
          <span>{errorMsg}</span>
        </div>
        <button onClick={onCancel} style={{ background: 'transparent', color: '#ef4444' }}><X size={18} /></button>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-card)', padding: '0.5rem 1rem', borderRadius: '24px', border: '1px solid var(--border)' }}>
      <button onClick={onCancel} style={{ background: 'transparent', color: '#ef4444', display: 'flex', alignItems: 'center' }} title="Cancel">
        <X size={20} />
      </button>

      <span style={{ fontSize: '0.85rem', color: recording ? '#ef4444' : 'var(--accent)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
        {recording ? '🔴' : '🎵'} {Math.floor(timer / 60)}:{('0' + (timer % 60)).slice(-2)}
      </span>

      <div style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        {recording ? 'Recording voice note...' : 'Recorded! Tap play preview or send'}
      </div>

      {!recording && audioBlob && (
        <button onClick={togglePreview} style={{ background: 'var(--hover-bg)', color: 'var(--text-main)', padding: '6px', borderRadius: '50%', border: '1px solid var(--border)', cursor: 'pointer' }} title={isPlayingPreview ? 'Pause Preview' : 'Play Preview'}>
          {isPlayingPreview ? <Pause size={16} /> : <Play size={16} />}
        </button>
      )}

      {recording ? (
        <button onClick={stopRecording} style={{ background: '#ef4444', color: '#fff', padding: '8px', borderRadius: '50%', cursor: 'pointer', display: 'flex' }} title="Stop Recording">
          <Square size={16} />
        </button>
      ) : null}

      <button onClick={handleSend} style={{ background: 'var(--accent)', color: '#fff', padding: '8px', borderRadius: '50%', cursor: 'pointer', display: 'flex' }} title="Send Voice Note">
        <Send size={16} />
      </button>
    </div>
  );
}

