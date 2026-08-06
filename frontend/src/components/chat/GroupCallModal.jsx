import React, { useEffect, useRef, useState, useContext } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff, Users, Volume2 } from 'lucide-react';
import { SocketContext } from '../../context/SocketContext';
import { AuthContext } from '../../context/AuthContext';

export default function GroupCallModal({ group, isVideo, isCaller, onClose }) {
  const { socket } = useContext(SocketContext);
  const { user: currentUser } = useContext(AuthContext);

  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(!isVideo);
  const [participants, setParticipants] = useState([]);
  const [duration, setDuration] = useState(0);
  const [callStatus, setCallStatus] = useState('Connecting Group Call...');

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map()); // socketId -> RTCPeerConnection
  const remoteStreamsRef = useRef(new Map()); // socketId -> MediaStream
  const remoteVideoRefs = useRef({}); // socketId -> HTMLVideoElement / HTMLAudioElement

  // Timer counter
  useEffect(() => {
    const timer = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  // Setup Local Media Stream & WebRTC Group Signaling
  useEffect(() => {
    let mounted = true;

    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };

    const setupLocalStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: isVideo ? { width: { ideal: 640 }, height: { ideal: 480 } } : false
        });

        if (!mounted) return;
        localStreamRef.current = stream;

        if (localVideoRef.current && !videoOff) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(e => console.warn(e));
        }

        // Join or start group call via socket
        if (socket) {
          if (isCaller) {
            socket.emit('start_group_call', {
              groupId: group.id,
              groupName: group.name || group.displayName,
              isVideo,
              callerId: currentUser.id,
              callerName: currentUser.displayName || currentUser.username,
              callerAvatar: currentUser.avatar,
              memberIds: group.members || []
            });
          } else {
            socket.emit('join_group_call', {
              groupId: group.id,
              userId: currentUser.id,
              displayName: currentUser.displayName || currentUser.username,
              avatar: currentUser.avatar,
              isVideo
            });
          }
        }
      } catch (err) {
        console.error('Failed to get media devices for group call:', err);
        setCallStatus('Audio / Video Device Access Error');
      }
    };

    setupLocalStream();

    // WebRTC Peer Connection Helper
    const createPeerConnection = (targetSocketId) => {
      if (peerConnectionsRef.current.has(targetSocketId)) {
        return peerConnectionsRef.current.get(targetSocketId);
      }

      const pc = new RTCPeerConnection(configuration);
      peerConnectionsRef.current.set(targetSocketId, pc);

      const remoteStream = new MediaStream();
      remoteStreamsRef.current.set(targetSocketId, remoteStream);

      // Add local tracks to peer connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          event.streams[0].getTracks().forEach(track => {
            if (!remoteStream.getTracks().some(t => t.id === track.id)) {
              remoteStream.addTrack(track);
            }
          });
        }
        const mediaElem = remoteVideoRefs.current[targetSocketId];
        if (mediaElem) {
          mediaElem.srcObject = remoteStream;
          mediaElem.play().catch(e => console.warn(e));
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('group_call_peer_signal', {
            toSocketId: targetSocketId,
            fromSocketId: socket.id,
            candidate: event.candidate
          });
        }
      };

      return pc;
    };

    // Socket Event Listeners for Real-Time Group Mesh Signaling
    if (socket) {
      socket.on('group_call_started', ({ participants: pts }) => {
        setParticipants(pts || []);
        setCallStatus('Group Call Active');
      });

      socket.on('group_call_joined', ({ participants: pts }) => {
        setParticipants(pts || []);
        setCallStatus('Group Call Active');
      });

      socket.on('group_call_user_joined', async ({ participant, participants: pts }) => {
        setParticipants(pts || []);
        setCallStatus('Group Call Active');

        // Create WebRTC Offer to newly joined participant
        if (participant.socketId && participant.socketId !== socket.id) {
          try {
            const pc = createPeerConnection(participant.socketId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            socket.emit('group_call_peer_signal', {
              toSocketId: participant.socketId,
              fromSocketId: socket.id,
              signal: offer
            });
          } catch (e) {
            console.error('Error sending offer to new group participant:', e);
          }
        }
      });

      socket.on('group_call_peer_signal', async ({ fromSocketId, signal, candidate }) => {
        const pc = createPeerConnection(fromSocketId);

        if (signal) {
          try {
            if (signal.type === 'offer') {
              await pc.setRemoteDescription(new RTCSessionDescription(signal));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);

              socket.emit('group_call_peer_signal', {
                toSocketId: fromSocketId,
                fromSocketId: socket.id,
                signal: answer
              });
            } else if (signal.type === 'answer') {
              await pc.setRemoteDescription(new RTCSessionDescription(signal));
            }
          } catch (e) {
            console.error('Error handling group call peer signal:', e);
          }
        }

        if (candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error('Error adding group call ICE candidate:', e);
          }
        }
      });

      socket.on('group_call_user_left', ({ socketId, participants: pts }) => {
        setParticipants(pts || []);

        if (peerConnectionsRef.current.has(socketId)) {
          peerConnectionsRef.current.get(socketId).close();
          peerConnectionsRef.current.delete(socketId);
        }
        remoteStreamsRef.current.delete(socketId);
      });
    }

    return () => {
      mounted = false;
      cleanupCall();
      if (socket) {
        socket.off('group_call_started');
        socket.off('group_call_joined');
        socket.off('group_call_user_joined');
        socket.off('group_call_peer_signal');
        socket.off('group_call_user_left');
      }
    };
  }, []);

  const cleanupCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();
    remoteStreamsRef.current.clear();
  };

  const handleLeaveGroupCall = () => {
    if (socket && group?.id) {
      socket.emit('leave_group_call', { groupId: group.id, userId: currentUser.id });
    }
    cleanupCall();
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

  return (
    <div className="call-modal-overlay" style={{ zIndex: 12000 }}>
      <div className="call-modal-container" style={{ maxWidth: '1000px', height: '90vh' }}>
        {/* Header Bar */}
        <div className="call-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src={group?.avatar} alt="Group" className="call-header-avatar" style={{ borderRadius: '14px' }} />
            <div>
              <h3 className="call-header-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {group?.name || group?.displayName}
                <span style={{ fontSize: '0.75rem', background: 'var(--accent)', color: '#fff', padding: '2px 8px', borderRadius: '10px' }}>
                  <Users size={12} style={{ marginRight: '4px' }} /> Group Call
                </span>
              </h3>
              <p className="call-header-status">
                {callStatus} • {formatDuration(duration)}
              </p>
            </div>
          </div>
        </div>

        {/* Participants Grid Area */}
        <div style={{
          flex: 1,
          padding: '1.25rem',
          background: '#020617',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          overflowY: 'auto',
          alignContent: 'center',
          justifyItems: 'center'
        }}>
          {/* Local User Stream Card */}
          <div style={{
            width: '100%',
            height: '200px',
            borderRadius: '20px',
            background: '#1e293b',
            border: '2px solid var(--accent)',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {isVideo && !videoOff ? (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ textAlign: 'center' }}>
                <img
                  src={currentUser.avatar}
                  alt={currentUser.displayName}
                  style={{ width: '64px', height: '64px', borderRadius: '50%', border: '2px solid var(--accent)', marginBottom: '8px' }}
                />
                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#fff' }}>{currentUser.displayName} (You)</h4>
              </div>
            )}
            <div style={{ position: 'absolute', bottom: '10px', left: '12px', background: 'rgba(0,0,0,0.6)', padding: '3px 8px', borderRadius: '8px', fontSize: '0.75rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {muted ? <MicOff size={12} color="#ef4444" /> : <Mic size={12} color="#10b981" />} You
            </div>
          </div>

          {/* Remote Group Participants Stream Cards */}
          {participants.filter(p => p.userId !== currentUser.id).map(p => {
            const remoteStream = remoteStreamsRef.current.get(p.socketId);
            return (
              <div
                key={p.socketId}
                style={{
                  width: '100%',
                  height: '200px',
                  borderRadius: '20px',
                  background: '#1e293b',
                  border: '1px solid rgba(255,255,255,0.12)',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <video
                  ref={el => {
                    if (el) {
                      remoteVideoRefs.current[p.socketId] = el;
                      if (remoteStream) {
                        el.srcObject = remoteStream;
                        el.play().catch(e => console.warn(e));
                      }
                    }
                  }}
                  autoPlay
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: isVideo ? 'block' : 'none' }}
                />

                {!isVideo && (
                  <div style={{ textAlign: 'center' }}>
                    <img
                      src={p.avatar}
                      alt={p.displayName}
                      style={{ width: '64px', height: '64px', borderRadius: '50%', border: '2px solid #10b981', marginBottom: '8px' }}
                    />
                    <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#fff' }}>{p.displayName}</h4>
                    <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '2px' }}>
                      <Volume2 size={12} /> Connected
                    </span>
                  </div>
                )}

                <div style={{ position: 'absolute', bottom: '10px', left: '12px', background: 'rgba(0,0,0,0.6)', padding: '3px 8px', borderRadius: '8px', fontSize: '0.75rem', color: '#fff' }}>
                  {p.displayName}
                </div>
              </div>
            );
          })}
        </div>

        {/* Controls Bar */}
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
              title={videoOff ? 'Camera On' : 'Camera Off'}
            >
              {videoOff ? <VideoOff size={22} /> : <Video size={22} />}
            </button>
          )}

          <button
            onClick={handleLeaveGroupCall}
            className="call-ctrl-btn ctrl-end"
            title="Leave Group Call"
          >
            <PhoneOff size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}
