import React, { useState, useEffect, useContext } from 'react';
import { X, RotateCcw, Trophy, Sparkles, Bot, Users, Award, Play } from 'lucide-react';
import { SocketContext } from '../../context/SocketContext';
import { AuthContext } from '../../context/AuthContext';
import { playSound } from '../../utils/audio';

// Web Audio API Sound Synthesizer for high performance native audio
const playMoveSound = (isX) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isX ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isX ? 520 : 680, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(isX ? 320 : 440, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {}
};

const playWinSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);
      gain.gain.setValueAtTime(0.25, ctx.currentTime + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + idx * 0.1 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.1);
      osc.stop(ctx.currentTime + idx * 0.1 + 0.35);
    });
  } catch (e) {}
};

const WINNING_COMBINATIONS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
  [0, 4, 8], [2, 4, 6]             // Diagonals
];

export default function TicTacToeModal({ chatId, partnerName, onClose, onOpenSparksWallet }) {
  const { socket } = useContext(SocketContext);
  const { user } = useContext(AuthContext);

  const [board, setBoard] = useState(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);
  const [winnerInfo, setWinnerInfo] = useState(null); // { winner: 'X' | 'O' | 'draw', line: [] }
  const [scores, setScores] = useState({ x: 0, o: 0, draws: 0 });
  const [sparksEarned, setSparksEarned] = useState(0);

  // Check winner
  const checkWinner = (currentBoard) => {
    for (const combo of WINNING_COMBINATIONS) {
      const [a, b, c] = combo;
      if (currentBoard[a] && currentBoard[a] === currentBoard[b] && currentBoard[a] === currentBoard[c]) {
        return { winner: currentBoard[a], line: combo };
      }
    }
    if (currentBoard.every(cell => cell !== null)) {
      return { winner: 'draw', line: [] };
    }
    return null;
  };

  // Socket sync for friend multiplayer
  useEffect(() => {
    if (!socket) return;

    const handleRemoteMove = ({ chatId: incomingChatId, nextBoard, turn, result }) => {
      if (incomingChatId === chatId) {
        setBoard(nextBoard);
        setIsXNext(turn === 'X');
        if (result) {
          setWinnerInfo(result);
          if (result.winner === 'X') setScores(s => ({ ...s, x: s.x + 1 }));
          else if (result.winner === 'O') setScores(s => ({ ...s, o: s.o + 1 }));
          else if (result.winner === 'draw') setScores(s => ({ ...s, draws: s.draws + 1 }));
        }
      }
    };

    const handleRemoteReset = ({ chatId: incomingChatId }) => {
      if (incomingChatId === chatId) {
        setBoard(Array(9).fill(null));
        setIsXNext(true);
        setWinnerInfo(null);
      }
    };

    socket.on('tictactoe_move', handleRemoteMove);
    socket.on('tictactoe_reset', handleRemoteReset);

    return () => {
      socket.off('tictactoe_move', handleRemoteMove);
      socket.off('tictactoe_reset', handleRemoteReset);
    };
  }, [socket, chatId]);

  const makeMove = (index, mark, baseBoard = board) => {
    if (baseBoard[index] || winnerInfo) return;

    const nextBoard = [...baseBoard];
    nextBoard[index] = mark;
    setBoard(nextBoard);
    playMoveSound(mark === 'X');

    const result = checkWinner(nextBoard);
    if (result) {
      setWinnerInfo(result);
      if (result.winner === 'X') {
        setScores(s => ({ ...s, x: s.x + 1 }));
        setSparksEarned(prev => prev + 10);
        playWinSound();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('pulsechat_trigger_emoji_burst', {
            detail: { emoji: '🏆', count: 20 }
          }));
        }
      } else if (result.winner === 'O') {
        setScores(s => ({ ...s, o: s.o + 1 }));
      } else {
        setScores(s => ({ ...s, draws: s.draws + 1 }));
      }

      if (socket) {
        socket.emit('tictactoe_move', {
          chatId,
          nextBoard,
          turn: mark === 'X' ? 'O' : 'X',
          result
        });
      }
      return;
    }

    const nextTurn = mark === 'X' ? 'O' : 'X';
    setIsXNext(nextTurn === 'X');

    if (socket) {
      socket.emit('tictactoe_move', {
        chatId,
        nextBoard,
        turn: nextTurn,
        result: null
      });
    }
  };

  const handleCellClick = (index) => {
    if (board[index] || winnerInfo) return;
    const currentMark = isXNext ? 'X' : 'O';
    makeMove(index, currentMark);
  };

  const handleReset = () => {
    setBoard(Array(9).fill(null));
    setIsXNext(true);
    setWinnerInfo(null);
    if (socket) {
      socket.emit('tictactoe_reset', { chatId });
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(7, 11, 22, 0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '380px',
          background: 'linear-gradient(145deg, #0f172a 0%, #1e1b4b 100%)',
          borderRadius: '24px',
          border: '1.5px solid rgba(168, 85, 247, 0.35)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(168, 85, 247, 0.25)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative'
        }}
      >
        {/* Header */}
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>🎮</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                Tic-Tac-Toe Arena
              </h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8' }}>
                Playing live with {partnerName || 'Friend'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="icon-btn-ghost"
            style={{ width: '32px', height: '32px', borderRadius: '50%', color: '#94a3b8' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scoreboard */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-around', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '16px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.74rem', color: '#38bdf8', fontWeight: 800 }}>X (You)</span>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#f8fafc' }}>{scores.x}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>Ties</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#cbd5e1' }}>{scores.draws}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.74rem', color: '#f43f5e', fontWeight: 800 }}>O ({partnerName || 'Friend'})</span>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#f8fafc' }}>{scores.o}</div>
          </div>
        </div>

        {/* Turn / Winner Status Banner */}
        <div style={{ marginBottom: '16px', textAlign: 'center' }}>
          {winnerInfo ? (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '20px',
              background: winnerInfo.winner === 'X' ? 'rgba(56, 189, 248, 0.2)' : (winnerInfo.winner === 'O' ? 'rgba(244, 63, 94, 0.2)' : 'rgba(255,255,255,0.1)'),
              border: `1.5px solid ${winnerInfo.winner === 'X' ? '#38bdf8' : (winnerInfo.winner === 'O' ? '#f43f5e' : '#94a3b8')}`,
              fontSize: '0.88rem',
              fontWeight: 800,
              color: '#fff'
            }}>
              {winnerInfo.winner === 'X' ? '🎉 You Won! (+10 Sparks)' : (winnerInfo.winner === 'O' ? `👑 ${partnerName || 'Friend'} Won!` : '🤝 It\'s a Draw!')}
            </div>
          ) : (
            <div style={{
              fontSize: '0.84rem',
              fontWeight: 700,
              color: isXNext ? '#38bdf8' : '#f43f5e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}>
              <span>Turn:</span>
              <span style={{ fontSize: '1rem', fontWeight: 900 }}>{isXNext ? 'X (Your Turn)' : `O (${partnerName || 'Friend'}'s Turn)`}</span>
            </div>
          )}
        </div>

        {/* 3x3 Grid Board */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          width: '100%',
          maxWidth: '300px',
          aspectRatio: '1 / 1',
          marginBottom: '18px'
        }}>
          {board.map((cell, idx) => {
            const isWinningCell = winnerInfo?.line?.includes(idx);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleCellClick(idx)}
                style={{
                  background: isWinningCell
                    ? (cell === 'X' ? 'rgba(56, 189, 248, 0.35)' : 'rgba(244, 63, 94, 0.35)')
                    : 'rgba(30, 41, 59, 0.75)',
                  border: isWinningCell
                    ? (cell === 'X' ? '2px solid #38bdf8' : '2px solid #f43f5e')
                    : '1.5px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2.5rem',
                  fontWeight: 900,
                  cursor: (cell || winnerInfo) ? 'default' : 'pointer',
                  color: cell === 'X' ? '#38bdf8' : '#f43f5e',
                  boxShadow: isWinningCell ? `0 0 16px ${cell === 'X' ? '#38bdf8' : '#f43f5e'}` : '0 4px 10px rgba(0,0,0,0.3)',
                  transition: 'all 0.15s ease'
                }}
              >
                {cell}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
          <button
            type="button"
            onClick={handleReset}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #a855f7, #6366f1)',
              border: 'none',
              color: '#fff',
              fontSize: '0.88rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(168, 85, 247, 0.35)'
            }}
          >
            <RotateCcw size={16} /> Play Again
          </button>
        </div>
      </div>
    </div>
  );
}
