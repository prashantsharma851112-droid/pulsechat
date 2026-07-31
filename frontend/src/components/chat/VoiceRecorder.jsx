import React, { useState, useEffect, useRef } from 'react';
import { Square, Send, X, Play, Pause, RotateCcw } from 'lucide-react';

export default function VoiceRecorder({ onSendVoice, onCancel }) {
  const [status, setStatus] = useState('recording'); // 'recording' | 'recorded' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [timer, setTimer] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const previewAudioRef = useRef(null);

  const getSupportedMimeType = () => {
    if (typeof MediaRecorder === 'undefined') return '';
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/ogg'
    ];
    for (const t of types) {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) return t;
    }
    return '';
  };

  const cleanupStream = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    setStatus('recording');
    setTimer(0);
    setAudioBlob(null);
    setAudioUrl(null);
    setErrorMsg('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      const chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const recordedBlob = new Blob(chunks, { type: mimeType || 'audio/webm' });
        setAudioBlob(recordedBlob);
        const url = URL.createObjectURL(recordedBlob);
        setAudioUrl(url);
        setStatus('recorded');
        cleanupStream();
      };

      mediaRecorder.start(100);
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } catch (err) {
      console.error("Microphone access error:", err);
      setErrorMsg("Microphone permission required to record voice notes.");
      setStatus('error');
      cleanupStream();
    }
  };

  useEffect(() => {
    startRecording();
    return () => {
      cleanupStream();
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
    };
  }, []);

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const togglePreview = () => {
    if (!audioUrl) return;
    if (isPlayingPreview) {
      previewAudioRef.current?.pause();
      setIsPlayingPreview(false);
    } else {
      const audio = new Audio(audioUrl);
      previewAudioRef.current = audio;
      audio.onended = () => setIsPlayingPreview(false);
      audio.onerror = () => setIsPlayingPreview(false);
      audio.play().catch(() => setIsPlayingPreview(false));
      setIsPlayingPreview(true);
    }
  };

  const handleSend = () => {
    if (!audioBlob) return;
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = () => {
      onSendVoice(reader.result);
    };
  };

  const handleCancel = () => {
    cleanupStream();
    if (previewAudioRef.current) previewAudioRef.current.pause();
    onCancel();
  };

  if (status === 'error') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', padding: '0.4rem 0.9rem', borderRadius: '24px', fontSize: '0.8rem', color: '#f87171' }}>
        <span>⚠️ {errorMsg}</span>
        <button onClick={handleCancel} style={{ background: 'transparent', color: '#f87171', cursor: 'pointer' }}><X size={18} /></button>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-card)', padding: '0.4rem 0.9rem', borderRadius: '24px' }}>
      <button onClick={handleCancel} title="Cancel" style={{ background: 'transparent', color: '#ef4444', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
        <X size={18} />
      </button>

      <span style={{ fontSize: '0.82rem', color: '#ef4444', fontWeight: 600, minWidth: '45px' }}>
        {status === 'recording' ? '🔴' : '🎵'} {Math.floor(timer / 60)}:{('0' + (timer % 60)).slice(-2)}
      </span>

      <div style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        {status === 'recording' ? 'Recording voice note...' : 'Voice note ready'}
      </div>

      {status === 'recorded' && (
        <>
          <button onClick={togglePreview} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Preview">
            {isPlayingPreview ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button onClick={startRecording} style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Re-record">
            <RotateCcw size={14} />
          </button>
        </>
      )}

      {status === 'recording' ? (
        <button onClick={stopRecording} style={{ background: '#ef4444', color: '#fff', padding: '7px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Stop Recording">
          <Square size={14} />
        </button>
      ) : (
        <button onClick={handleSend} style={{ background: 'var(--accent)', color: '#fff', padding: '7px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Send Voice Note">
          <Send size={14} />
        </button>
      )}
    </div>
  );
}
