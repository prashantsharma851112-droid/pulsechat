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

function GameVoiceChat({ chatId, partnerName = 'Partner', compact = false }) {
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
  const isSpeakingRef = useRef(false);
  const isPartnerSpeakingRef = useRef(false);
  const isInitiatorRef = useRef(false);
  const pendingCandidatesRef = useRef([]);

  const myUserId = String(user?.id || user?._id || 'user');
  const myUserName = user?.displayName || user?.username || 'Player';
  const partnerUserId = String(chatId).includes('_')
    ? String(chatId).split('_').find(id => String(id) !== myUserId)
    : null;
  const targetPeerIdRef = useRef(partnerUserId || null);
  const targetSocketIdRef = useRef(null);

  // Ensure Audio Playback (Bypasses mobile autoplay blocks)
  const ensureAudioPlayback = useCallback(() => {
    if (remoteAudioRef.current) {
      if (remoteStreamRef.current && remoteAudioRef.current.srcObject !== remoteStreamRef.current) {
        remoteAudioRef.current.srcObject = remoteStreamRef.current;
      }
      remoteAudioRef.current.muted = isDeafened;
      remoteAudioRef.current.volume = 1.0;
      remoteAudioRef.current.play().catch(() => {});
    }
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
  }, [isDeafened]);

  // 1. Initialize PeerConnection with Pre-allocated Audio Transceiver & Candidate Queuing
  const createPeerConnection = useCallback((targetPeerId) => {
    if (targetPeerId) {
      targetPeerIdRef.current = targetPeerId;
    }
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (e) {}
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;
    pendingCandidatesRef.current = [];

    // Pre-allocate bidirectional audio channel in SDP
    try {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
    } catch (e) {}

    // If local microphone track is already active, attach it immediately
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        const senders = pc.getSenders();
        const audioSender = senders.find(s => s.track && s.track.kind === 'audio') || senders.find(s => !s.track);
        if (audioSender) {
          audioSender.replaceTrack(audioTrack).catch(() => {});
        } else {
          try { pc.addTrack(audioTrack, localStreamRef.current); } catch (e) {}
        }
      }
    }

    pc.onicecandidate = (event) => {
      const toId = targetPeerId || targetPeerIdRef.current;
      if (event.candidate && socket && (toId || targetSocketIdRef.current)) {
        socket.emit('game_voice_signal', {
          chatId,
          toUserId: toId,
          toSocketId: targetSocketIdRef.current,
          fromUserId: myUserId,
          signal: event.candidate,
          type: 'candidate'
        });
      }
    };

    pc.ontrack = (event) => {
      const track = event.track;
      const stream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([track]);
      remoteStreamRef.current = stream;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.muted = isDeafened;
        remoteAudioRef.current.volume = 1.0;
        const p = remoteAudioRef.current.play();
        if (p !== undefined) p.catch(() => {});
      }
      track.onunmute = () => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.muted = isDeafened;
          remoteAudioRef.current.volume = 1.0;
          const p = remoteAudioRef.current.play();
          if (p !== undefined) p.catch(() => {});
        }
      };
      setupRemoteVAD(stream);
      setVoiceConnected(true);
      setPartnerVoiceState(prev => ({ ...prev, isConnected: true }));
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setVoiceConnected(true);
        if (remoteAudioRef.current && remoteStreamRef.current) {
          remoteAudioRef.current.srcObject = remoteStreamRef.current;
          const p = remoteAudioRef.current.play();
          if (p !== undefined) p.catch(() => {});
        }
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setVoiceConnected(false);
      }
    };

    return pc;
  }, [chatId, myUserId, socket, isDeafened]);

  // Voice Activity Detection (VAD) for glowing soundwave ring
  const setupLocalVAD = (stream) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
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
        const nextSpeaking = avg > 20;
        if (nextSpeaking !== isSpeakingRef.current) {
          isSpeakingRef.current = nextSpeaking;
          setIsSpeaking(nextSpeaking);
        }
      }, 150);
    } catch (e) {}
  };

  const setupRemoteVAD = (stream) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      if (remoteVadIntervalRef.current) clearInterval(remoteVadIntervalRef.current);

      remoteVadIntervalRef.current = setInterval(() => {
        try {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const nextPartnerSpeaking = avg > 20;
          if (nextPartnerSpeaking !== isPartnerSpeakingRef.current) {
            isPartnerSpeakingRef.current = nextPartnerSpeaking;
            setIsPartnerSpeaking(nextPartnerSpeaking);
          }
        } catch (e) {}
      }, 150);
    } catch (e) {}
  };

  const sendVoiceOffer = useCallback(async (targetId, targetSock) => {
    const pc = pcRef.current;
    const toId = targetId || targetPeerIdRef.current;
    if (!pc || !socket || !chatId) return;
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      socket.emit('game_voice_signal', {
        chatId,
        toUserId: toId,
        toSocketId: targetSock || targetSocketIdRef.current,
        fromUserId: myUserId,
        signal: offer,
        type: 'offer'
      });
    } catch (e) {
      console.warn('Game voice sendVoiceOffer error:', e);
    }
  }, [chatId, myUserId, socket]);

  // 2. Start Microphone Audio Capture
  const startMicAudio = async () => {
    try {
      ensureAudioPlayback();
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

      // Attach audio track to PeerConnection via replaceTrack or addTrack
      if (pcRef.current) {
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          const senders = pcRef.current.getSenders();
          const audioSender = senders.find(s => s.track && s.track.kind === 'audio') || senders.find(s => !s.track);
          if (audioSender) {
            await audioSender.replaceTrack(audioTrack);
          } else {
            pcRef.current.addTrack(audioTrack, stream);
          }
          await sendVoiceOffer();
        }
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
    ensureAudioPlayback();
    if (!isMicOn) {
      if (!localStreamRef.current) {
        await startMicAudio();
      } else {
        localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = true; });
        if (pcRef.current) {
          const audioTrack = localStreamRef.current.getAudioTracks()[0];
          const senders = pcRef.current.getSenders();
          const audioSender = senders.find(s => s.track && s.track.kind === 'audio') || senders.find(s => !s.track);
          if (audioSender && audioTrack) {
            audioSender.replaceTrack(audioTrack).catch(() => {});
          }
          await sendVoiceOffer();
        }
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
      if (!next) {
        remoteAudioRef.current.play().catch(() => {});
      }
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

    // When another peer enters the game voice chat, this peer initiates the WebRTC offer
    const handlePeerJoined = async ({ userId, userName, socketId }) => {
      targetPeerIdRef.current = userId;
      if (socketId) targetSocketIdRef.current = socketId;
      setPartnerVoiceState(prev => ({ ...prev, isConnected: true }));
      isInitiatorRef.current = true;
      const pc = createPeerConnection(userId);
      await sendVoiceOffer(userId, socketId);
    };

    // When joining user discovers existing peers in room, do NOT send conflicting offer (prevents SDP glare collision)
    const handleRoomUsers = ({ peers }) => {
      if (!Array.isArray(peers) || peers.length === 0) return;
      const partner = peers[0];
      if (partner && partner.userId !== myUserId) {
        targetPeerIdRef.current = partner.userId;
        if (partner.socketId) targetSocketIdRef.current = partner.socketId;
        setPartnerVoiceState(prev => ({ ...prev, isConnected: true }));
        // Ensure PeerConnection is ready to receive partner's incoming offer
        if (!pcRef.current) {
          createPeerConnection(partner.userId);
        }
      }
    };

    // When receiving WebRTC signals (offer / answer / candidate) with Polite-Peer Glare Resolution
    const handleSignal = async ({ fromUserId, fromSocketId, signal, type }) => {
      if (String(fromUserId) === myUserId) return;
      if (fromUserId) targetPeerIdRef.current = fromUserId;
      if (fromSocketId) targetSocketIdRef.current = fromSocketId;
      try {
        if (type === 'offer') {
          let pc = pcRef.current;
          const isPolite = myUserId.localeCompare(String(fromUserId)) > 0;
          if (pc && pc.signalingState !== 'stable') {
            if (!isPolite) {
              return; // Ignore glare offer on impolite peer
            }
            try {
              await Promise.all([
                pc.setLocalDescription({ type: 'rollback' }),
                pc.setRemoteDescription(new RTCSessionDescription(signal))
              ]);
            } catch (e) {
              pc = createPeerConnection(fromUserId);
              await pc.setRemoteDescription(new RTCSessionDescription(signal));
            }
          } else {
            pc = createPeerConnection(fromUserId);
            await pc.setRemoteDescription(new RTCSessionDescription(signal));
          }

          // Drain queued ICE candidates
          for (const cand of pendingCandidatesRef.current) {
            try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (e) {}
          }
          pendingCandidatesRef.current = [];

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('game_voice_signal', {
            chatId,
            toUserId: fromUserId,
            toSocketId: fromSocketId,
            fromUserId: myUserId,
            signal: answer,
            type: 'answer'
          });
          ensureAudioPlayback();
        } else if (type === 'answer') {
          if (pcRef.current && (pcRef.current.signalingState === 'have-local-offer' || pcRef.current.signalingState === 'have-remote-pranswer')) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(signal));
            // Drain queued ICE candidates
            for (const cand of pendingCandidatesRef.current) {
              try { await pcRef.current.addIceCandidate(new RTCIceCandidate(cand)); } catch (e) {}
            }
            pendingCandidatesRef.current = [];
            ensureAudioPlayback();
          }
        } else if (type === 'candidate') {
          if (pcRef.current && pcRef.current.remoteDescription && pcRef.current.remoteDescription.type) {
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(signal));
            } catch (e) {}
          } else {
            pendingCandidatesRef.current.push(signal);
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
    socket.on('game_voice_room_users', handleRoomUsers);
    socket.on('game_voice_signal', handleSignal);
    socket.on('game_voice_state_changed', handleStateChanged);
    socket.on('game_voice_peer_left', handlePeerLeft);

    return () => {
      socket.off('game_voice_peer_joined', handlePeerJoined);
      socket.off('game_voice_room_users', handleRoomUsers);
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
  }, [chatId, myUserId, myUserName, socket, user?.avatar, createPeerConnection, ensureAudioPlayback, sendVoiceOffer]);

  // Global Audio Autoplay Unblocker: Unlocks remote voice audio on first touch/tap in game
  useEffect(() => {
    const handleUserInteraction = () => {
      ensureAudioPlayback();
    };
    window.addEventListener('click', handleUserInteraction);
    window.addEventListener('touchstart', handleUserInteraction, { passive: true });
    window.addEventListener('pointerdown', handleUserInteraction, { passive: true });
    return () => {
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('pointerdown', handleUserInteraction);
    };
  }, [ensureAudioPlayback]);

  return (
    <>
      {/* WebRTC Remote Audio Player - Off-screen active audio element (Never display: none) */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          width: '1px',
          height: '1px',
          opacity: 0.001,
          pointerEvents: 'none',
          zIndex: -1
        }}
      />

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

        {/* Status / Voice Indicator */}
        {!compact ? (
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: '85px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: isMicOn ? '#10b981' : (voiceConnected ? '#38bdf8' : '#64748b'),
                boxShadow: isMicOn ? '0 0 6px #10b981' : 'none'
              }} />
              <span style={{
                fontSize: '0.74rem',
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
        ) : (
          isPartnerSpeaking ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '0 4px' }} title={`${partnerName} is talking`}>
              <div style={{ width: '2.5px', height: '9px', background: '#38bdf8', borderRadius: '2px', animation: 'voiceEqualizerBar 0.4s infinite alternate' }} />
              <div style={{ width: '2.5px', height: '13px', background: '#38bdf8', borderRadius: '2px', animation: 'voiceEqualizerBar 0.3s infinite alternate 0.1s' }} />
              <div style={{ width: '2.5px', height: '7px', background: '#38bdf8', borderRadius: '2px', animation: 'voiceEqualizerBar 0.5s infinite alternate 0.2s' }} />
            </div>
          ) : null
        )}
      </div>
    </>
  );
}

export default React.memo(GameVoiceChat);
