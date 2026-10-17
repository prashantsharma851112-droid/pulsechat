import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Radio, Sparkles } from 'lucide-react';
import { SocketContext } from '../../context/SocketContext';
import { AuthContext } from '../../context/AuthContext';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelay',
      credential: 'openrelay'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelay',
      credential: 'openrelay'
    }
  ],
  iceCandidatePoolSize: 10
};

export default function GameVoiceChat({ chatId, partnerName = 'Partner', compact = false }) {
  const { socket } = useContext(SocketContext);
  const { user } = useContext(AuthContext);

  const [isMicOn, setIsMicOn] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPartnerSpeaking, setIsPartnerSpeaking] = useState(false);
  const [partnerVoiceState, setPartnerVoiceState] = useState({ isConnected: false, isMuted: true, isDeafened: false });
  const [voiceConnected, setVoiceConnected] = useState(false);

  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const pcRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const vadIntervalRef = useRef(null);
  const remoteVadIntervalRef = useRef(null);
  const isInitiatorRef = useRef(false);

  const myUserId = String(user?.id || user?._id || 'user');
  const myUserName = user?.displayName || user?.username || 'Player';

  // 1. Initialize PeerConnection
  const createPeerConnection = useCallback((targetPeerId) => {
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (e) {}
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && socket && targetPeerId) {
        socket.emit('game_voice_signal', {
          chatId,
          toUserId: targetPeerId,
          fromUserId: myUserId,
          signal: event.candidate,
          type: 'candidate'
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        remoteStreamRef.current = event.streams[0];
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.play().catch(() => {});
        }
        setupRemoteVAD(event.streams[0]);
        setVoiceConnected(true);
        setPartnerVoiceState(prev => ({ ...prev, isConnected: true }));
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setVoiceConnected(true);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setVoiceConnected(false);
      }
    };

    // Add local tracks if stream already active
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    return pc;
  }, [chatId, myUserId, socket]);

  // Voice Activity Detection (VAD) for glowing soundwave ring
  const setupLocalVAD = (stream) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      if (vadIntervalRef.current) clearInterval(vadIntervalRef.current);

      vadIntervalRef.current = setInterval(() => {
        if (!analyserRef.current || !localStreamRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setIsSpeaking(avg > 18);
      }, 120);
    } catch (e) {}
  };

  const setupRemoteVAD = (stream) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      if (remoteVadIntervalRef.current) clearInterval(remoteVadIntervalRef.current);

      remoteVadIntervalRef.current = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setIsPartnerSpeaking(avg > 18);
      }, 120);
    } catch (e) {}
  };

  // 2. Start Microphone Audio Capture
  const startMicAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      localStreamRef.current = stream;
      setupLocalVAD(stream);

      // Add tracks to PeerConnection if active
      if (pcRef.current) {
        stream.getTracks().forEach(track => {
          pcRef.current.addTrack(track, stream);
        });
      }

      setIsMicOn(true);
      if (socket && chatId) {
        socket.emit('game_voice_state', {
          chatId,
          userId: myUserId,
          isMuted: false,
          isDeafened
        });
      }
      return stream;
    } catch (err) {
      console.warn('Microphone permission blocked or unavailable:', err);
      setIsMicOn(false);
      return null;
    }
  };

  // 3. Toggle Mic ON / Mute (Free Fire Style One-Tap Control)
  const toggleMic = async () => {
    if (!isMicOn) {
      if (!localStreamRef.current) {
        await startMicAudio();
      } else {
        localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = true; });
        setIsMicOn(true);
        if (socket && chatId) {
          socket.emit('game_voice_state', { chatId, userId: myUserId, isMuted: false, isDeafened });
        }
      }
    } else {
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = false; });
      }
      setIsMicOn(false);
      setIsSpeaking(false);
      if (socket && chatId) {
        socket.emit('game_voice_state', { chatId, userId: myUserId, isMuted: true, isDeafened });
      }
    }
  };

  // 4. Toggle Deafen / Speaker (Mute Partner's Voice)
  const toggleDeafen = () => {
    const next = !isDeafened;
    setIsDeafened(next);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = next;
    }
    if (socket && chatId) {
      socket.emit('game_voice_state', { chatId, userId: myUserId, isMuted: !isMicOn, isDeafened: next });
    }
  };

  // 5. Socket Signaling Lifecycle for Voice Chat
  useEffect(() => {
    if (!socket || !chatId) return;

    // Join Game Voice Room
    socket.emit('game_voice_join', {
      chatId,
      userId: myUserId,
      userName: myUserName,
      userAvatar: user?.avatar
    });

    // When another peer enters the game voice chat
    const handlePeerJoined = async ({ userId, userName }) => {
      setPartnerVoiceState(prev => ({ ...prev, isConnected: true }));
      isInitiatorRef.current = true;
      const pc = createPeerConnection(userId);

      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true });
        await pc.setLocalDescription(offer);
        socket.emit('game_voice_signal', {
          chatId,
          toUserId: userId,
          fromUserId: myUserId,
          signal: offer,
          type: 'offer'
        });
      } catch (e) {
        console.warn('Game voice offer error:', e);
      }
    };

    // When receiving WebRTC signals (offer / answer / candidate)
    const handleSignal = async ({ fromUserId, signal, type }) => {
      try {
        if (type === 'offer') {
          const pc = createPeerConnection(fromUserId);
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('game_voice_signal', {
            chatId,
            toUserId: fromUserId,
            fromUserId: myUserId,
            signal: answer,
            type: 'answer'
          });
        } else if (type === 'answer') {
          if (pcRef.current) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(signal));
          }
        } else if (type === 'candidate') {
          if (pcRef.current && signal) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(signal));
          }
        }
      } catch (e) {
        console.warn('Game voice signaling error:', e);
      }
    };

    const handleStateChanged = ({ userId, isMuted, isDeafened }) => {
      if (String(userId) !== myUserId) {
        setPartnerVoiceState(prev => ({ ...prev, isMuted, isDeafened }));
      }
    };

    const handlePeerLeft = ({ userId }) => {
      if (String(userId) !== myUserId) {
        setPartnerVoiceState({ isConnected: false, isMuted: true, isDeafened: false });
        setIsPartnerSpeaking(false);
        setVoiceConnected(false);
      }
    };

    socket.on('game_voice_peer_joined', handlePeerJoined);
    socket.on('game_voice_signal', handleSignal);
    socket.on('game_voice_state_changed', handleStateChanged);
    socket.on('game_voice_peer_left', handlePeerLeft);

    return () => {
      socket.off('game_voice_peer_joined', handlePeerJoined);
      socket.off('game_voice_signal', handleSignal);
      socket.off('game_voice_state_changed', handleStateChanged);
      socket.off('game_voice_peer_left', handlePeerLeft);

      socket.emit('game_voice_leave', { chatId, userId: myUserId });

      if (vadIntervalRef.current) clearInterval(vadIntervalRef.current);
      if (remoteVadIntervalRef.current) clearInterval(remoteVadIntervalRef.current);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (pcRef.current) {
        try { pcRef.current.close(); } catch (e) {}
      }
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch (e) {}
      }
    };
  }, [chatId, myUserId, myUserName, socket, user?.avatar, createPeerConnection]);

  return (
    <>
      {/* Hidden WebRTC Remote Audio Player */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

      <style>{`
        @keyframes voicePulseRing {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        @keyframes voiceEqualizerBar {
          0% { height: 4px; }
          50% { height: 16px; }
          100% { height: 4px; }
        }
      `}</style>

      {/* Free Fire / Discord Tactical Voice Bar */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? '6px' : '10px',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)',
        border: isMicOn ? '1.5px solid #10b981' : '1.5px solid rgba(255, 255, 255, 0.16)',
        borderRadius: compact ? '22px' : '26px',
        padding: compact ? '4px 8px' : '5px 14px',
        boxShadow: isMicOn ? '0 0 16px rgba(16, 185, 129, 0.4), 0 4px 15px rgba(0,0,0,0.6)' : '0 4px 12px rgba(0,0,0,0.5)',
        transition: 'all 0.25s ease',
        userSelect: 'none'
      }}>
        {/* MIC TOGGLE BUTTON (FREE FIRE STYLE TACTICAL MIC) */}
        <button
          type="button"
          onClick={toggleMic}
          title={isMicOn ? 'Tap to Mute Mic' : 'Tap to Turn Mic ON'}
          style={{
            background: isMicOn
              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
              : 'rgba(239, 68, 68, 0.22)',
            border: isMicOn ? '2px solid #34d399' : '1.5px solid rgba(239, 68, 68, 0.6)',
            color: isMicOn ? '#ffffff' : '#fca5a5',
            borderRadius: '50%',
            width: compact ? '32px' : '36px',
            height: compact ? '32px' : '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            animation: (isMicOn && isSpeaking) ? 'voicePulseRing 1.1s infinite' : 'none',
            boxShadow: isMicOn ? '0 0 12px rgba(16, 185, 129, 0.7)' : 'none',
            transition: 'all 0.2s ease',
            flexShrink: 0
          }}
        >
          {isMicOn ? <Mic size={compact ? 16 : 18} /> : <MicOff size={compact ? 16 : 18} />}
        </button>

        {/* SPEAKER / DEAFEN TOGGLE BUTTON */}
        <button
          type="button"
          onClick={toggleDeafen}
          title={isDeafened ? 'Tap to Unmute Friend' : 'Tap to Deafen Friend'}
          style={{
            background: isDeafened ? 'rgba(239, 68, 68, 0.22)' : 'rgba(56, 189, 248, 0.18)',
            border: isDeafened ? '1.5px solid rgba(239, 68, 68, 0.6)' : '1.5px solid rgba(56, 189, 248, 0.5)',
            color: isDeafened ? '#fca5a5' : '#38bdf8',
            borderRadius: '50%',
            width: compact ? '28px' : '32px',
            height: compact ? '28px' : '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            flexShrink: 0
          }}
        >
          {isDeafened ? <VolumeX size={compact ? 14 : 16} /> : <Volume2 size={compact ? 14 : 16} />}
        </button>

        {/* Real-time Status / Voice Indicator */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: compact ? '68px' : '88px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: isMicOn ? '#10b981' : (voiceConnected ? '#38bdf8' : '#64748b'),
              boxShadow: isMicOn ? '0 0 6px #10b981' : 'none'
            }} />
            <span style={{
              fontSize: compact ? '0.7rem' : '0.74rem',
              fontWeight: 900,
              color: isMicOn ? '#34d399' : '#cbd5e1',
              letterSpacing: '0.4px',
              textTransform: 'uppercase'
            }}>
              {isMicOn ? (isSpeaking ? 'Talking...' : 'Mic ON') : 'Mic OFF'}
            </span>
          </div>

          {/* Partner voice activity readout */}
          {isPartnerSpeaking ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '1px' }}>
              <div style={{ width: '3px', height: '10px', background: '#38bdf8', borderRadius: '2px', animation: 'voiceEqualizerBar 0.4s infinite alternate' }} />
              <div style={{ width: '3px', height: '14px', background: '#38bdf8', borderRadius: '2px', animation: 'voiceEqualizerBar 0.3s infinite alternate 0.1s' }} />
              <div style={{ width: '3px', height: '8px', background: '#38bdf8', borderRadius: '2px', animation: 'voiceEqualizerBar 0.5s infinite alternate 0.2s' }} />
              <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#38bdf8', marginLeft: '2px' }}>
                {partnerName} Talking
              </span>
            </div>
          ) : (
            <span style={{ fontSize: '0.62rem', color: '#94a3b8', fontWeight: 700 }}>
              {partnerVoiceState.isMuted ? `${partnerName}: Muted` : `${partnerName}: In Game`}
            </span>
          )}
        </div>
      </div>
    </>
  );
}
