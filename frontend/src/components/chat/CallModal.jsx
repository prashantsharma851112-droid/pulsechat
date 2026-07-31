import React, { useEffect, useRef, useState, useContext } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff, Monitor, Maximize2, Minimize2 } from 'lucide-react';
import { SocketContext } from '../../context/SocketContext';
import { AuthContext } from '../../context/AuthContext';

export default function CallModal({ targetUser, isVideo, isCaller, incomingSignal, onClose }) {
  const { socket } = useContext(SocketContext);
  const { user: currentUser } = useContext(AuthContext);

  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(!isVideo);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callStatus, setCallStatus] = useState(isCaller ? 'Calling...' : 'Connecting...');
  const [duration, setDuration] = useState(0);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  // Timer counter
  useEffect(() => {
    let timer;
    if (callStatus === 'Connected') {
      timer = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [callStatus]);

  useEffect(() => {
    let mounted = true;

    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(configuration);
    pcRef.current = pc;

    // Remote Track Handler
    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setCallStatus('Connected');
      }
    };

    // ICE Candidate Handler
    pc.onicecandidate = (event) => {
      if (event.candidate && socket && targetUser?.id) {
        socket.emit('ice_candidate', {
          to: targetUser.id,
          candidate: event.candidate
        });
      }
    };

    // Get User Media Stream
    navigator.mediaDevices.getUserMedia({
      audio: true,
      video: isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false
    }).then(async (stream) => {
      if (!mounted) return;
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      if (isCaller) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit('call_user', {
          userToCall: targetUser.id,
          signalData: offer,
          from: currentUser.id,
          callerName: currentUser.displayName,
          callerAvatar: currentUser.avatar,
          isVideo
        });
      } else if (incomingSignal) {
        await pc.setRemoteDescription(new RTCSessionDescription(incomingSignal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('answer_call', {
          to: targetUser.id,
          signal: answer
        });
      }
    }).catch(err => {
      console.error('Failed to get media devices:', err);
      setCallStatus('Media Device Error');
    });

    // Socket Listeners
    if (socket) {
      socket.on('call_accepted', async (signal) => {
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(signal));
          setCallStatus('Connected');
        }
      });

      socket.on('ice_candidate', async ({ candidate }) => {
        if (pcRef.current && candidate) {
          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error('Error adding ICE candidate:', e);
          }
        }
      });

      socket.on('call_rejected', () => {
        setCallStatus('Call Declined');
        setTimeout(() => handleEndCall(), 1200);
      });

      socket.on('call_ended', () => {
        handleEndCall();
      });
    }

    return () => {
      mounted = false;
      cleanupMedia();
      if (socket) {
        socket.off('call_accepted');
        socket.off('ice_candidate');
        socket.off('call_rejected');
        socket.off('call_ended');
      }
    };
  }, []);

  const cleanupMedia = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (pcRef.current) {
      pcRef.current.close();
    }
  };

  const handleEndCall = () => {
    if (socket && targetUser?.id) {
      socket.emit('end_call', { to: targetUser.id });
    }
    cleanupMedia();
    onClose();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoOff(!videoTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!pcRef.current) return;
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        const sender = pcRef.current.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack);
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        screenTrack.onended = () => {
          stopScreenShare();
        };

        setIsScreenSharing(true);
      } else {
        stopScreenShare();
      }
    } catch (err) {
      console.error('Screen sharing error:', err);
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
    }
    if (localStreamRef.current && pcRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      const sender = pcRef.current.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender && videoTrack) {
        sender.replaceTrack(videoTrack);
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    }
    setIsScreenSharing(false);
  };

  const formatDuration = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  return (
    <div className="call-modal-overlay">
      <div className="call-modal-container">
        {/* Call Info Header */}
        <div className="call-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src={targetUser?.avatar} alt="User" className="call-header-avatar" />
            <div>
              <h3 className="call-header-name">{targetUser?.displayName || 'Pulse User'}</h3>
              <p className="call-header-status">
                {callStatus} {callStatus === 'Connected' && `(${formatDuration(duration)})`}
              </p>
            </div>
          </div>
        </div>

        {/* Video Area */}
        <div className="call-video-grid">
          {/* Remote Video Stream */}
          <div className="remote-video-container">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="remote-video-element"
            />
            {(!remoteVideoRef.current?.srcObject || !isVideo) && (
              <div className="call-audio-avatar-wrapper">
                <img src={targetUser?.avatar} alt="Avatar" className="call-audio-avatar" />
                <h4>{targetUser?.displayName}</h4>
                <span>{callStatus}</span>
              </div>
            )}
          </div>

          {/* Local PIP Video */}
          <div className="local-video-container">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="local-video-element"
            />
          </div>
        </div>

        {/* Controls */}
        <div className="call-controls-bar">
          <button
            onClick={toggleMute}
            className={`call-ctrl-btn ${muted ? 'ctrl-danger' : 'ctrl-active'}`}
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>

          {isVideo && (
            <button
              onClick={toggleVideo}
              className={`call-ctrl-btn ${videoOff ? 'ctrl-danger' : 'ctrl-active'}`}
              title={videoOff ? 'Turn Camera On' : 'Turn Camera Off'}
            >
              {videoOff ? <VideoOff size={22} /> : <Video size={22} />}
            </button>
          )}

          {isVideo && (
            <button
              onClick={toggleScreenShare}
              className={`call-ctrl-btn ${isScreenSharing ? 'ctrl-brand' : 'ctrl-active'}`}
              title="Share Screen"
            >
              <Monitor size={22} />
            </button>
          )}

          <button
            onClick={handleEndCall}
            className="call-ctrl-btn ctrl-end"
            title="End Call"
          >
            <PhoneOff size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}
