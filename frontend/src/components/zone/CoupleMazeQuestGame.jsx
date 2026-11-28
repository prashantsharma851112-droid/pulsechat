import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { playSound } from '../../utils/audio';
import GameVoiceChat from '../chat/GameVoiceChat';
import {
  ArrowLeft,
  Heart,
  Sparkles,
  ShieldCheck,
  Key,
  Compass,
  Smile,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Flame,
  Award,
  Share2,
  MessageSquare,
  Maximize2,
  Minimize2
} from 'lucide-react';

export default function CoupleMazeQuestGame({
  roomCode: initialRoomCode = null,
  role: initialRole = 'host',
  partnerData: initialPartner = null,
  onBack
}) {
  const { user } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);

  const canvasRef = useRef(null);

  // Ephemeral Room State (Zero DB Persistence)
  const [roomCode, setRoomCode] = useState(initialRoomCode || '');
  const [role, setRole] = useState(initialRole || 'host');
  const [partner, setPartner] = useState(initialPartner || null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Game state
  const [keysCollected, setKeysCollected] = useState(0);
  const [gatesUnlocked, setGatesUnlocked] = useState(0);
  const [hasEscaped, setHasEscaped] = useState(false);
  const [partnerNear, setPartnerNear] = useState(false);

  // Position refs (Grid coords: 15x15 maze)
  const localPosRef = useRef({ x: 1.5, y: 1.5, targetX: 1.5, targetY: 1.5 });
  const remotePosRef = useRef({ x: 13.5, y: 13.5, targetX: 13.5, targetY: 13.5 });
  const lastSyncRef = useRef(0);
  const roomCodeRef = useRef(roomCode);

  useEffect(() => {
    roomCodeRef.current = roomCode;
  }, [roomCode]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const getShareUrl = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}?coupleRoom=${roomCode}`;
  };

  const handleShareLink = async () => {
    if (!roomCode) return;
    const url = getShareUrl();
    const text = `🎮 Join my Couple Maze Quest on PulseChat!\nRoom Code: ${roomCode}\n👉 ${url}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'PulseChat Couple Maze Quest', text, url });
        showToast('Shared successfully!');
      } catch (e) {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(url);
          showToast('Direct link copied to clipboard!');
        }
      }
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      showToast('Direct link copied to clipboard!');
    }
  };

  const handleShareInChat = () => {
    if (!roomCode) return;
    const url = getShareUrl();
    const inviteMsg = `🎮 Join my Couple Maze Quest in PulseChat!\nRoom Code: ${roomCode}\n👉 ${url}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(inviteMsg);
      showToast('Chat invitation copied! Paste in any chat 💬');
    }
  };

  const toggleFullscreen = () => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // 15x15 Procedural Labyrinth Layout
  // 1: Wall, 0: Path, 2: Gate, 3: Key, 4: Center Sanctuary
  const MAZE = useRef([
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,1,0,0,0,0,0,1,0,0,0,1],
    [1,0,1,0,1,0,1,1,1,0,1,0,1,0,1],
    [1,0,1,0,0,0,0,3,1,0,0,0,1,0,1],
    [1,0,1,1,1,1,0,1,1,1,1,0,1,0,1],
    [1,0,0,0,0,1,0,0,0,0,1,0,0,0,1],
    [1,1,1,0,1,1,0,1,1,0,1,1,0,1,1],
    [1,3,0,0,2,0,0,4,0,0,2,0,0,3,1],
    [1,1,1,0,1,1,0,1,1,0,1,1,0,1,1],
    [1,0,0,0,0,1,0,0,0,0,1,0,0,0,1],
    [1,0,1,1,1,1,0,1,1,1,1,0,1,0,1],
    [1,0,1,0,0,0,0,3,1,0,0,0,1,0,1],
    [1,0,1,0,1,0,1,1,1,0,1,0,1,0,1],
    [1,0,0,0,1,0,0,0,0,0,1,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ]).current;

  // Lifecycle & Socket room binding
  useEffect(() => {
    if (!socket) return;

    const myUser = {
      id: user?.id || user?._id || (initialRole === 'host' ? 'host' : 'partner'),
      name: user?.displayName || user?.username || (initialRole === 'host' ? 'Partner 1' : 'Partner 2'),
      avatar: user?.avatar || '',
      color: initialRole === 'host' ? '#38bdf8' : '#ec4899'
    };

    const targetCode = roomCode || initialRoomCode || ('MAZE-' + Math.floor(1000 + Math.random() * 9000));
    setRoomCode(targetCode);

    if (initialRole === 'host') {
      socket.emit('couple_room_create', {
        roomCode: targetCode,
        gameType: 'maze',
        user: myUser
      }, (res) => {
        if (res && res.success) {
          setRoomCode(res.roomCode);
          setRole('host');
          if (res.roomData?.partner) setPartner(res.roomData.partner);
        }
      });
    } else {
      socket.emit('couple_room_join', {
        roomCode: targetCode,
        user: myUser
      }, (res) => {
        if (res && res.success) {
          setRoomCode(res.roomCode);
          setRole('partner');
          if (res.roomData?.host) setPartner(res.roomData.host);
          playSound('success');
        }
      });
    }

    const handleRoomReady = (data) => {
      if (data.host && data.partner) {
        if (role === 'host') setPartner(data.partner);
        else setPartner(data.host);
        playSound('success');
      }
    };

    const handlePlayerUpdated = ({ senderRole, playerState }) => {
      if (playerState) {
        remotePosRef.current.targetX = playerState.x;
        remotePosRef.current.targetY = playerState.y;
        setPartner(prev => prev || {
          id: senderRole === 'host' ? 'host' : 'partner',
          name: senderRole === 'host' ? 'Partner 1' : 'Partner 2'
        });
      }
    };

    const handleActionReceived = ({ actionType, payload }) => {
      if (actionType === 'key_collect') {
        setKeysCollected(payload.count);
        playSound('pop');
      } else if (actionType === 'escape_success') {
        setHasEscaped(true);
        playSound('success');
      }
    };

    const handlePartnerLeft = () => setPartner(null);

    socket.on('couple_room_ready', handleRoomReady);
    socket.on('couple_player_updated', handlePlayerUpdated);
    socket.on('couple_action_received', handleActionReceived);
    socket.on('couple_partner_left', handlePartnerLeft);

    return () => {
      socket.off('couple_room_ready', handleRoomReady);
      socket.off('couple_player_updated', handlePlayerUpdated);
      socket.off('couple_action_received', handleActionReceived);
      socket.off('couple_partner_left', handlePartnerLeft);
    };
  }, [socket, initialRole]);

  // Clean unmount-only room leave
  useEffect(() => {
    return () => {
      if (socket && roomCodeRef.current) {
        socket.emit('couple_room_leave', { roomCode: roomCodeRef.current });
      }
    };
  }, [socket]);

  // Join Room
  const handleJoinByCode = () => {
    if (!socket || !inputCode.trim()) return;
    setIsConnecting(true);
    setConnectionError('');

    socket.emit('couple_room_join', {
      roomCode: inputCode.trim(),
      user: {
        id: user?.id || user?._id || 'partner',
        name: user?.displayName || user?.username || 'Partner 2',
        avatar: user?.avatar || '',
        color: '#ec4899'
      }
    }, (res) => {
      setIsConnecting(false);
      if (res && res.success) {
        setRoomCode(res.roomCode);
        setRole('partner');
        setPartner(res.roomData?.host || null);
        playSound('success');
      } else {
        setConnectionError(res?.message || 'Could not join room.');
        playSound('error');
      }
    });
  };

  const copyRoomCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    playSound('pop');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      const k = e.key.toLowerCase();
      let dx = 0;
      let dy = 0;
      if (k === 'w' || k === 'arrowup') dy = -1;
      if (k === 's' || k === 'arrowdown') dy = 1;
      if (k === 'a' || k === 'arrowleft') dx = -1;
      if (k === 'd' || k === 'arrowright') dx = 1;

      if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        const cur = localPosRef.current;
        const targetX = Math.round(cur.x + dx);
        const targetY = Math.round(cur.y + dy);

        if (targetX >= 0 && targetX < 15 && targetY >= 0 && targetY < 15) {
          const cell = MAZE[targetY][targetX];
          if (cell !== 1) { // Not wall
            cur.targetX = targetX + 0.5;
            cur.targetY = targetY + 0.5;

            // Check key pickup
            if (cell === 3) {
              MAZE[targetY][targetX] = 0;
              setKeysCollected(prev => {
                const next = prev + 1;
                if (socket && roomCode) {
                  socket.emit('couple_action_sync', {
                    roomCode,
                    actionType: 'key_collect',
                    payload: { count: next }
                  });
                }
                return next;
              });
            }

            // Sync with remote player (Throttled)
            const now = performance.now();
            if (socket && roomCode && now - lastSyncRef.current > 40) {
              lastSyncRef.current = now;
              socket.emit('couple_player_sync', {
                roomCode,
                playerState: { x: cur.targetX, y: cur.targetY }
              });
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [MAZE, socket, roomCode]);

  // Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId = null;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Smooth position interpolation
      localPosRef.current.x += (localPosRef.current.targetX - localPosRef.current.x) * 0.25;
      localPosRef.current.y += (localPosRef.current.targetY - localPosRef.current.y) * 0.25;
      remotePosRef.current.x += (remotePosRef.current.targetX - remotePosRef.current.x) * 0.25;
      remotePosRef.current.y += (remotePosRef.current.targetY - remotePosRef.current.y) * 0.25;

      const cellSize = Math.min(width, height) / 15;
      const offsetX = (width - cellSize * 15) / 2;
      const offsetY = (height - cellSize * 15) / 2;

      // Draw Maze Grid
      for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 15; c++) {
          const type = MAZE[r][c];
          const px = offsetX + c * cellSize;
          const py = offsetY + r * cellSize;

          if (type === 1) {
            // Stylized Wall
            ctx.fillStyle = '#1e1b4b';
            ctx.fillRect(px, py, cellSize, cellSize);
            ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
            ctx.strokeRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
          } else if (type === 4) {
            // Heart Sanctuary Portal
            ctx.fillStyle = 'rgba(244, 63, 94, 0.25)';
            ctx.fillRect(px, py, cellSize, cellSize);
            ctx.fillStyle = '#f43f5e';
            ctx.font = `${cellSize * 0.6}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('💖', px + cellSize / 2, py + cellSize / 2);
          } else if (type === 3) {
            // Collectible Key
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(px, py, cellSize, cellSize);
            ctx.fillStyle = '#fbbf24';
            ctx.font = `${cellSize * 0.55}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🗝️', px + cellSize / 2, py + cellSize / 2);
          } else {
            // Floor
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(px, py, cellSize, cellSize);
          }
        }
      }

      // Check distance between players
      const dist = Math.hypot(localPosRef.current.x - remotePosRef.current.x, localPosRef.current.y - remotePosRef.current.y);
      const isNear = dist < 2.0;
      setPartnerNear(isNear);

      // Check Escape Condition (Both at center sanctuary 7,7)
      const dLocalCenter = Math.hypot(localPosRef.current.x - 7.5, localPosRef.current.y - 7.5);
      const dRemoteCenter = Math.hypot(remotePosRef.current.x - 7.5, remotePosRef.current.y - 7.5);
      if (dLocalCenter < 1.0 && dRemoteCenter < 1.0 && !hasEscaped) {
        setHasEscaped(true);
        if (socket && roomCode) {
          socket.emit('couple_action_sync', {
            roomCode,
            actionType: 'escape_success',
            payload: { escaped: true }
          });
        }
        playSound('success');
      }

      // If near each other, draw glowing love beam tether between avatars!
      if (isNear) {
        ctx.beginPath();
        ctx.moveTo(offsetX + localPosRef.current.x * cellSize, offsetY + localPosRef.current.y * cellSize);
        ctx.lineTo(offsetX + remotePosRef.current.x * cellSize, offsetY + remotePosRef.current.y * cellSize);
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 15;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Draw Local Player Avatar
      const localPx = offsetX + localPosRef.current.x * cellSize;
      const localPy = offsetY + localPosRef.current.y * cellSize;
      ctx.beginPath();
      ctx.arc(localPx, localPy, cellSize * 0.38, 0, Math.PI * 2);
      ctx.fillStyle = role === 'host' ? '#38bdf8' : '#ec4899';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Draw Remote Partner Avatar
      const remotePx = offsetX + remotePosRef.current.x * cellSize;
      const remotePy = offsetY + remotePosRef.current.y * cellSize;
      ctx.beginPath();
      ctx.arc(remotePx, remotePy, cellSize * 0.38, 0, Math.PI * 2);
      ctx.fillStyle = role === 'host' ? '#ec4899' : '#38bdf8';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [MAZE, role, socket, roomCode, hasEscaped]);

  // Touch Directional Pad Helper
  const handleMoveDir = (dx, dy) => {
    const cur = localPosRef.current;
    const targetX = Math.round(cur.x + dx);
    const targetY = Math.round(cur.y + dy);

    if (targetX >= 0 && targetX < 15 && targetY >= 0 && targetY < 15) {
      if (MAZE[targetY][targetX] !== 1) {
        cur.targetX = targetX + 0.5;
        cur.targetY = targetY + 0.5;
        if (MAZE[targetY][targetX] === 3) {
          MAZE[targetY][targetX] = 0;
          setKeysCollected(p => p + 1);
        }
        if (socket && roomCode) {
          socket.emit('couple_player_sync', {
            roomCode,
            playerState: { x: cur.targetX, y: cur.targetY }
          });
        }
      }
    }
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      minHeight: '520px',
      position: 'relative',
      background: 'linear-gradient(135deg, #090d16 0%, #17112c 100%)',
      borderRadius: '20px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Top Header */}
      <div style={{
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(15, 23, 42, 0.9)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={onBack}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#fff',
              borderRadius: '10px',
              padding: '6px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem',
              fontWeight: 800
            }}
          >
            <ArrowLeft size={16} /> Exit
          </button>
          {roomCode && (
            <>
              <button
                onClick={copyRoomCode}
                title="Tap to copy Room Code"
                style={{
                  background: 'rgba(244, 63, 94, 0.2)',
                  border: '1px solid rgba(244, 63, 94, 0.5)',
                  color: '#fbcfe8',
                  borderRadius: '10px',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '0.75rem',
                  fontWeight: 900
                }}
              >
                <Heart size={13} color="#f43f5e" fill="#f43f5e" />
                {roomCode}
                {copiedCode ? <Check size={13} color="#34d399" /> : <Copy size={12} />}
              </button>

              <button
                onClick={handleShareLink}
                title="Share Direct Link"
                style={{
                  background: 'rgba(56, 189, 248, 0.2)',
                  border: '1px solid rgba(56, 189, 248, 0.5)',
                  color: '#38bdf8',
                  borderRadius: '10px',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 800
                }}
              >
                <Share2 size={13} />
                <span>Link</span>
              </button>

              <button
                onClick={handleShareInChat}
                title="Copy Chat Invitation"
                style={{
                  background: 'rgba(168, 85, 247, 0.2)',
                  border: '1px solid rgba(168, 85, 247, 0.5)',
                  color: '#c084fc',
                  borderRadius: '10px',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 800
                }}
              >
                <MessageSquare size={13} />
                <span>Chat</span>
              </button>
            </>
          )}

          <button
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#fff',
              borderRadius: '10px',
              padding: '6px 9px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>

        {/* Live Free Fire Style Voice Chat HUD */}
        <div>
          {roomCode && (
            <GameVoiceChat
              chatId={`couple_${roomCode}`}
              partnerName={partner?.name || (role === 'host' ? 'Partner 2' : 'Partner 1')}
              partnerId={partner?.id || null}
              iconOnly={true}
            />
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'absolute',
          top: '56px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #059669, #10b981)',
          color: '#fff',
          padding: '6px 18px',
          borderRadius: '20px',
          fontWeight: 800,
          fontSize: '0.8rem',
          zIndex: 100,
          boxShadow: '0 8px 20px rgba(16, 185, 129, 0.5)',
          pointerEvents: 'none',
          whiteSpace: 'nowrap'
        }}>
          {toastMessage}
        </div>
      )}

      {/* Quest Objective Ribbon */}
      <div style={{
        padding: '8px 16px',
        background: 'rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.78rem',
        color: '#cbd5e1',
        fontWeight: 700
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={14} color="#f59e0b" />
          <span>Find each other & meet at Sanctuary (💖)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🗝️ Keys: <b style={{ color: '#fbbf24' }}>{keysCollected}/4</b></span>
          <span>{partnerNear ? '💖 Close Together!' : '🧭 Exploring...'}</span>
        </div>
      </div>

      {/* 2D Canvas Area */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px' }}>
        <canvas
          ref={canvasRef}
          width={420}
          height={420}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            borderRadius: '16px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
            border: '1.5px solid rgba(99, 102, 241, 0.4)'
          }}
        />
      </div>

      {/* D-Pad Controls for Mobile Users */}
      <div style={{
        padding: '10px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '6px',
        background: 'rgba(15, 23, 42, 0.6)'
      }}>
        <button onClick={() => handleMoveDir(-1, 0)} style={dpadBtnStyle}>◀</button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button onClick={() => handleMoveDir(0, -1)} style={dpadBtnStyle}>▲</button>
          <button onClick={() => handleMoveDir(0, 1)} style={dpadBtnStyle}>▼</button>
        </div>
        <button onClick={() => handleMoveDir(1, 0)} style={dpadBtnStyle}>▶</button>
      </div>

      {/* Escape Victory Modal */}
      {hasEscaped && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.95)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          zIndex: 70
        }}>
          <div style={{ fontSize: '3rem' }}>🎉💖🎉</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff' }}>
            Couples Unity Restored!
          </div>
          <div style={{ fontSize: '0.85rem', color: '#fbcfe8', maxWidth: '280px', textAlign: 'center' }}>
            You and your partner navigated the mystical labyrinth together!
          </div>
          <button
            onClick={onBack}
            style={{
              marginTop: '10px',
              background: 'linear-gradient(135deg, #f43f5e, #be185d)',
              border: 'none',
              color: '#fff',
              borderRadius: '12px',
              padding: '10px 24px',
              fontWeight: 900,
              cursor: 'pointer'
            }}
          >
            Play More Adventures
          </button>
        </div>
      )}
    </div>
  );
}

const dpadBtnStyle = {
  width: '42px',
  height: '42px',
  borderRadius: '10px',
  background: 'rgba(255, 255, 255, 0.12)',
  border: '1px solid rgba(255, 255, 255, 0.25)',
  color: '#fff',
  fontSize: '1rem',
  fontWeight: 900,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};
