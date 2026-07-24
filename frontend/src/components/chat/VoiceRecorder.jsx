import React, { useState, useRef } from 'react';
import { Square, Send, X } from 'lucide-react';

export default function VoiceRecorder({ onSendVoice, onCancel }) {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [timer, setTimer] = useState(0);
  const mediaRecorderRef = useRef(null);
  const timerRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
      };

      mediaRecorder.start();
      setRecording(true);
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } catch (err) {
      alert("Microphone access is required to record voice notes.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    clearInterval(timerRef.current);
    setRecording(false);
  };

  const handleSend = () => {
    if (!audioBlob) return;
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = () => {
      onSendVoice(reader.result);
    };
  };

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-card)', padding: '0.5rem 1rem', borderRadius: '24px' }}>
      <button onClick={onCancel} style={{ background: 'transparent', color: '#ef4444' }}><X size={20} /></button>

      <span style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: 600 }}>
        🔴 {Math.floor(timer / 60)}:{('0' + (timer % 60)).slice(-2)}
      </span>

      <div style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        {recording ? 'Recording voice note...' : 'Voice note recorded!'}
      </div>

      {recording ? (
        <button onClick={stopRecording} style={{ background: '#ef4444', color: '#fff', padding: '6px', borderRadius: '50%' }}><Square size={16} /></button>
      ) : (
        <button onClick={handleSend} style={{ background: 'var(--accent)', color: '#fff', padding: '6px', borderRadius: '50%' }}><Send size={16} /></button>
      )}
    </div>
  );
}
