import React, { useState, useEffect, useRef, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { X, Palette, Eraser, Trash2, RotateCcw, Sparkles, Send, Award, RefreshCw, Layers } from 'lucide-react';
import { playSound } from '../../utils/audio';

const WORD_BANK = [
  { word: 'Rocket', emoji: '🚀', hint: 'Spacecraft' },
  { word: 'Pizza', emoji: '🍕', hint: 'Cheesy food' },
  { word: 'Cat', emoji: '🐱', hint: 'Cute pet' },
  { word: 'Castle', emoji: '🏰', hint: 'Royal building' },
  { word: 'Guitar', emoji: '🎸', hint: 'Musical instrument' },
  { word: 'Car', emoji: '🚗', hint: '4-wheel vehicle' },
  { word: 'Burger', emoji: '🍔', hint: 'Fast food' },
  { word: 'Crown', emoji: '👑', hint: 'King/Queen hat' },
  { word: 'Diamond', emoji: '💎', hint: 'Precious gem' },
  { word: 'Balloon', emoji: '🎈', hint: 'Party decoration' },
  { word: 'Ice Cream', emoji: '🍦', hint: 'Sweet cold treat' },
  { word: 'Phone', emoji: '📱', hint: 'Mobile device' },
  { word: 'Sun', emoji: '☀️', hint: 'Bright star in sky' },
  { word: 'Cake', emoji: '🎂', hint: 'Birthday dessert' },
  { word: 'Star', emoji: '⭐', hint: 'Night sky light' }
];

const COLORS = [
  '#ffffff', '#ef4444', '#f59e0b', '#10b981', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#000000'
];

export default function LiveDrawGameModal({ activeChat, onClose }) {
  const { user, updateUserProfile } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);

  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  const [mode, setMode] = useState('free'); // 'free' | 'game'
  const [currentColor, setCurrentColor] = useState('#3b82f6');
  const [brushSize, setBrushSize] = useState(4);
  const [isEraser, setIsEraser] = useState(false);

  // Game state
  const [role, setRole] = useState('drawer'); // 'drawer' | 'guesser'
  const [currentWordObj, setCurrentWordObj] = useState(WORD_BANK[0]);
  const [guessInput, setGuessInput] = useState('');
  const [gameResult, setGameResult] = useState(null);
  const [chatLogs, setChatLogs] = useState([]);

  const chatId = activeChat?.id;
  const myId = user?.id || user?._id || 'local';

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const resizeCanvas = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Listen to incoming socket drawing & game events
  useEffect(() => {
    if (!socket || !chatId) return;

    socket.emit('join_chat', chatId);

    const handleStroke = (data) => {
      if (data.senderId === myId) return;
      drawStrokeOnCanvas(data.stroke);
    };

    const handleClear = () => {
      clearCanvasLocal();
    };

    const handleGameStart = (data) => {
      if (data.drawerId === myId) {
        setRole('drawer');
      } else {
        setRole('guesser');
      }
      setCurrentWordObj({ word: data.word, emoji: data.emoji, hint: data.hint });
      setGameResult(null);
      clearCanvasLocal();
    };

    const handleGuessUpdate = (data) => {
      setChatLogs(prev => [...prev.slice(-15), data]);
      if (data.isCorrect) {
        playSound('success');
        setGameResult({ winnerName: data.senderName, word: data.word });

        // Reward +50 Sparks to guesser
        const currentSparks = user?.pulseSparks || 100;
        if (updateUserProfile && data.senderId === myId) {
          updateUserProfile({ ...user, pulseSparks: currentSparks + 50 });
        }
      }
    };

    socket.on('draw_stroke', handleStroke);
    socket.on('draw_clear', handleClear);
    socket.on('draw_game_start', handleGameStart);
    socket.on('draw_guess', handleGuessUpdate);

    return () => {
      socket.off('draw_stroke', handleStroke);
      socket.off('draw_clear', handleClear);
      socket.off('draw_game_start', handleGameStart);
      socket.off('draw_guess', handleGuessUpdate);
    };
  }, [socket, chatId, myId, user]);

  const drawStrokeOnCanvas = ({ x0, y0, x1, y1, color, size, isEraserMode }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.beginPath();
    ctx.moveTo(x0 * w, y0 * h);
    ctx.lineTo(x1 * w, y1 * h);

    if (isEraserMode) {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = size * 2.5;
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const clearCanvasLocal = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleClearCanvas = () => {
    clearCanvasLocal();
    playSound('pop');
    if (socket && chatId) {
      socket.emit('draw_clear', { chatId, senderId: myId });
    }
  };

  // Touch & Mouse Event Handlers
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height
    };
  };

  const startDrawing = (e) => {
    if (mode === 'game' && role === 'guesser') return;
    isDrawingRef.current = true;
    lastPosRef.current = getCanvasCoords(e);
  };

  const draw = (e) => {
    if (!isDrawingRef.current) return;
    if (mode === 'game' && role === 'guesser') return;

    const currentPos = getCanvasCoords(e);
    const strokeData = {
      x0: lastPosRef.current.x,
      y0: lastPosRef.current.y,
      x1: currentPos.x,
      y1: currentPos.y,
      color: currentColor,
      size: brushSize,
      isEraserMode: isEraser
    };

    drawStrokeOnCanvas(strokeData);

    if (socket && chatId) {
      socket.emit('draw_stroke', { chatId, stroke: strokeData, senderId: myId });
    }

    lastPosRef.current = currentPos;
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const startNewGame = () => {
    const randomWord = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
    setCurrentWordObj(randomWord);
    setRole('drawer');
    setGameResult(null);
    clearCanvasLocal();

    if (socket && chatId) {
      socket.emit('draw_game_start', {
        chatId,
        drawerId: myId,
        word: randomWord.word,
        emoji: randomWord.emoji,
        hint: randomWord.hint
      });
    }
  };

  const handleSendGuess = (e) => {
    e.preventDefault();
    if (!guessInput.trim()) return;

    const trimmed = guessInput.trim();
    const isCorrect = trimmed.toLowerCase() === currentWordObj.word.toLowerCase();
    const senderName = user?.displayName || user?.username || 'Player';

    if (socket && chatId) {
      socket.emit('draw_guess', {
        chatId,
        senderId: myId,
        senderName,
        guess: trimmed,
        isCorrect,
        word: currentWordObj.word
      });
    }

    setGuessInput('');
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1350 }}>
      <div
        className="modal-card modal-responsive"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '560px',
          width: '100%',
          maxHeight: '94dvh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '24px',
          overflow: 'hidden',
          background: 'var(--bg-card)',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 30px rgba(99, 102, 241, 0.2)'
        }}
      >
        {/* Banner Header */}
        <div style={{
          padding: '16px 18px 12px 18px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#fff',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 15px rgba(236, 72, 153, 0.4)'
              }}>
                <Palette size={20} color="#fff" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Live Canvas & Draw Game <span style={{ color: '#fbbf24' }}>🎨</span>
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.75)' }}>
                  Real-Time Shared Whiteboard with {activeChat?.displayName || 'Chat Partner'}
                </span>
              </div>
            </div>
            <button className="icon-btn-ghost" onClick={onClose} style={{ color: '#fff', background: 'rgba(0,0,0,0.3)', borderRadius: '50%' }}>
              <X size={18} />
            </button>
          </div>

          {/* Mode Tabs */}
          <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.35)', padding: '4px', borderRadius: '12px' }}>
            <button
              onClick={() => setMode('free')}
              style={{
                flex: 1,
                padding: '6px',
                borderRadius: '8px',
                border: 'none',
                background: mode === 'free' ? 'linear-gradient(90deg, #3b82f6, #6366f1)' : 'transparent',
                color: mode === 'free' ? '#fff' : 'rgba(255,255,255,0.7)',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              🖌️ Shared Whiteboard
            </button>
            <button
              onClick={() => { setMode('game'); startNewGame(); }}
              style={{
                flex: 1,
                padding: '6px',
                borderRadius: '8px',
                border: 'none',
                background: mode === 'game' ? 'linear-gradient(90deg, #ec4899, #f43f5e)' : 'transparent',
                color: mode === 'game' ? '#fff' : 'rgba(255,255,255,0.7)',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              🎮 Draw & Guess (+50⚡)
            </button>
          </div>
        </div>

        {/* Game Header Bar if in Draw & Guess Game Mode */}
        {mode === 'game' && (
          <div style={{
            padding: '10px 16px',
            background: 'rgba(15, 23, 42, 0.95)',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.82rem',
            fontWeight: 800,
            color: '#fff'
          }}>
            {role === 'drawer' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b' }}>
                <Sparkles size={16} />
                <span>Draw: <strong>{currentWordObj.word} {currentWordObj.emoji}</strong></span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8' }}>
                <Sparkles size={16} />
                <span>Hint: <strong>{currentWordObj.hint} ({currentWordObj.word.length} letters)</strong></span>
              </div>
            )}
            <button
              onClick={startNewGame}
              style={{
                background: 'rgba(255,255,255,0.15)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '4px 10px',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <RefreshCw size={12} /> Next Round
            </button>
          </div>
        )}

        {/* Main Canvas Body */}
        <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
          
          {/* Canvas Wrapper */}
          <div style={{
            position: 'relative',
            height: '280px',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '1.5px solid rgba(255,255,255,0.15)',
            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)',
            background: '#0f172a',
            touchAction: 'none'
          }}>
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              style={{ width: '100%', height: '100%', cursor: isEraser ? 'crosshair' : 'pointer' }}
            />

            {/* Game Winner Overlay */}
            {gameResult && (
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.88)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                color: '#fff',
                animation: 'fadeIn 0.2s ease-out'
              }}>
                <Award size={40} color="#f59e0b" />
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#10b981', fontWeight: 900 }}>
                  🎉 Correct Guess by {gameResult.winnerName}!
                </h3>
                <p style={{ margin: 0, fontSize: '0.86rem', color: '#fbbf24', fontWeight: 700 }}>
                  Word was: <strong>{gameResult.word}</strong> (+50 Sparks Credited!)
                </p>
                <button
                  onClick={startNewGame}
                  className="btn-primary"
                  style={{ marginTop: '8px', padding: '8px 20px', borderRadius: '12px', fontWeight: 800 }}
                >
                  Play Next Round 🚀
                </button>
              </div>
            )}
          </div>

          {/* Toolbar (Colors, Brush Size, Eraser, Clear) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            background: 'rgba(0,0,0,0.3)',
            padding: '8px 12px',
            borderRadius: '14px',
            border: '1px solid var(--border)'
          }}>
            {/* Color Palette */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setCurrentColor(c); setIsEraser(false); }}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: c,
                    border: currentColor === c && !isEraser ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                />
              ))}
            </div>

            {/* Tools */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setIsEraser(prev => !prev)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '10px',
                  border: isEraser ? '1.5px solid #ec4899' : '1px solid var(--border)',
                  background: isEraser ? 'rgba(236, 72, 153, 0.2)' : 'var(--bg-card)',
                  color: isEraser ? '#ec4899' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Eraser size={14} /> Eraser
              </button>

              <button
                type="button"
                onClick={handleClearCanvas}
                style={{
                  padding: '6px 10px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: '#ef4444',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Trash2 size={14} /> Clear
              </button>
            </div>
          </div>

          {/* Live Guessing Chat Box if in Draw & Guess Mode */}
          {mode === 'game' && (
            <form onSubmit={handleSendGuess} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder={role === 'guesser' ? "Type your guess here..." : "You are drawing! Let friends guess..."}
                disabled={role === 'drawer'}
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 14px',
                  borderRadius: '12px',
                  background: 'var(--hover-bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-main)',
                  fontSize: '0.84rem',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                disabled={role === 'drawer' || !guessInput.trim()}
                className="btn-primary"
                style={{ padding: '8px 16px', borderRadius: '12px', fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Send size={14} /> Guess
              </button>
            </form>
          )}

          {/* Chat / Guess Feed */}
          {chatLogs.length > 0 && (
            <div style={{
              maxHeight: '70px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              padding: '6px 10px',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '10px',
              fontSize: '0.74rem'
            }}>
              {chatLogs.map((log, i) => (
                <div key={i} style={{ color: log.isCorrect ? '#10b981' : 'var(--text-muted)', fontWeight: log.isCorrect ? 800 : 500 }}>
                  <strong>{log.senderName}:</strong> {log.guess} {log.isCorrect ? '🎉 (CORRECT!)' : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
