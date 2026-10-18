import React, { useState, useEffect, useContext, useRef } from 'react';
import { X, RotateCcw, Trophy, Sparkles, Award, Play } from 'lucide-react';
import { SocketContext } from '../../context/SocketContext';
import { AuthContext } from '../../context/AuthContext';
import { playSound, getSharedAudioContext } from '../../utils/audio';
import GameVoiceChat from './GameVoiceChat';

// Web Audio API Sound Synthesizers for high performance native audio
const playMoveSound = (isX) => {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
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
    const ctx = getSharedAudioContext();
    if (!ctx) return;
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

const playLoseSound = () => {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.35);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {}
};

const WINNING_COMBINATIONS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
  [0, 4, 8], [2, 4, 6]             // Diagonals
];

export default function TicTacToeModal({ chatId, partnerName, hostId, onClose, onOpenSparksWallet }) {
  const { socket } = useContext(SocketContext);
  const { user } = useContext(AuthContext);

  const currentUserId = user?.id || user?._id || '';
  const [resolvedHostId, setResolvedHostId] = useState(() => {
    if (hostId) return hostId;
    if (chatId && chatId.includes('_')) return chatId.split('_')[0];
    return null;
  });

  // Host is assigned 'X' (goes first), Guest is assigned 'O'
  const isHost = resolvedHostId ? String(currentUserId) === String(resolvedHostId) : true;
  const mySymbol = isHost ? 'X' : 'O';
  const partnerSymbol = isHost ? 'O' : 'X';

  const [board, setBoard] = useState(Array(9).fill(null));
  const [turn, setTurn] = useState('X'); // 'X' always starts
  const [winnerInfo, setWinnerInfo] = useState(null); // { winner: 'X' | 'O' | 'draw', line: [] }
  const [scores, setScores] = useState({ x: 0, o: 0, draws: 0 });
  const [sparksEarned, setSparksEarned] = useState(0);

  // Refs for state sync
  const boardRef = useRef(board);
  boardRef.current = board;
  const turnRef = useRef(turn);
  turnRef.current = turn;
  const winnerInfoRef = useRef(winnerInfo);
  winnerInfoRef.current = winnerInfo;
  const scoresRef = useRef(scores);
  scoresRef.current = scores;

  const isMyTurn = turn === mySymbol && !winnerInfo;

  // Check winner algorithm
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

  // Socket sync for real-time multiplayer
  useEffect(() => {
    if (!socket || !chatId) return;

    // Join room & announce presence to sync state if partner already started
    socket.emit('tictactoe_join', { chatId, userId: currentUserId, hostId: resolvedHostId });

    const handleRemoteJoin = (payload) => {
      if (!payload || payload.chatId !== chatId) return;
      if (payload.userId === currentUserId) return;
      // Partner joined, sync existing match state to them
      socket.emit('tictactoe_state', {
        chatId,
        board: boardRef.current,
        turn: turnRef.current,
        winnerInfo: winnerInfoRef.current,
        scores: scoresRef.current,
        hostId: resolvedHostId
      });
    };

    const handleRemoteState = (payload) => {
      if (!payload || payload.chatId !== chatId) return;
      if (payload.hostId && !hostId) {
        setResolvedHostId(payload.hostId);
      }
      if (payload.board) setBoard(payload.board);
      if (payload.turn) setTurn(payload.turn);
      if (payload.winnerInfo) setWinnerInfo(payload.winnerInfo);
      if (payload.scores) setScores(payload.scores);
    };

    const handleRemoteMove = (payload) => {
      if (!payload || payload.chatId !== chatId) return;
      const { nextBoard, turn: nextTurn, result, scores: newScores, hostId: remoteHostId } = payload;
      
      if (remoteHostId && !hostId) {
        setResolvedHostId(remoteHostId);
      }

      setBoard(nextBoard);
      setTurn(nextTurn);
      playMoveSound(nextTurn !== 'X');

      if (newScores) {
        setScores(newScores);
      }

      if (result) {
        setWinnerInfo(result);
        if (result.winner === mySymbol) {
          setSparksEarned(prev => prev + 10);
          playWinSound();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('pulsechat_trigger_emoji_burst', {
              detail: { emoji: '🏆', count: 20 }
            }));
          }
        } else if (result.winner === partnerSymbol) {
          playLoseSound();
        }
      }
    };

    const handleRemoteReset = (payload) => {
      if (!payload || payload.chatId !== chatId) return;
      setBoard(Array(9).fill(null));
      setTurn('X');
      setWinnerInfo(null);
      if (payload.scores) {
        setScores(payload.scores);
      }
    };

    socket.on('tictactoe_join', handleRemoteJoin);
    socket.on('tictactoe_state', handleRemoteState);
    socket.on('tictactoe_move', handleRemoteMove);
    socket.on('tictactoe_reset', handleRemoteReset);

    return () => {
      socket.off('tictactoe_join', handleRemoteJoin);
      socket.off('tictactoe_state', handleRemoteState);
      socket.off('tictactoe_move', handleRemoteMove);
      socket.off('tictactoe_reset', handleRemoteReset);
    };
  }, [socket, chatId, currentUserId, resolvedHostId, hostId, mySymbol, partnerSymbol]);

  const makeMove = (index, mark) => {
    if (board[index] || winnerInfo || !isMyTurn) return;

    const nextBoard = [...board];
    nextBoard[index] = mark;
    setBoard(nextBoard);
    playMoveSound(mark === 'X');

    const result = checkWinner(nextBoard);
    const nextTurn = mark === 'X' ? 'O' : 'X';
    setTurn(nextTurn);

    let updatedScores = { ...scores };

    if (result) {
      setWinnerInfo(result);
      if (result.winner === 'X') {
        updatedScores.x += 1;
      } else if (result.winner === 'O') {
        updatedScores.o += 1;
      } else if (result.winner === 'draw') {
        updatedScores.draws += 1;
      }
      setScores(updatedScores);

      if (result.winner === mySymbol) {
        setSparksEarned(prev => prev + 10);
        playWinSound();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('pulsechat_trigger_emoji_burst', {
            detail: { emoji: '🏆', count: 20 }
          }));
        }
      } else if (result.winner === partnerSymbol) {
        playLoseSound();
      }

      if (socket) {
        socket.emit('tictactoe_move', {
          chatId,
          nextBoard,
          turn: nextTurn,
          result,
          scores: updatedScores,
          movedBy: currentUserId,
          hostId: resolvedHostId
        });
      }
      return;
    }

    if (socket) {
      socket.emit('tictactoe_move', {
        chatId,
        nextBoard,
        turn: nextTurn,
        result: null,
        scores: updatedScores,
        movedBy: currentUserId,
        hostId: resolvedHostId
      });
    }
  };

  const handleCellClick = (index) => {
    if (board[index] || winnerInfo || !isMyTurn) return;
    makeMove(index, mySymbol);
  };

  const handleReset = () => {
    setBoard(Array(9).fill(null));
    setTurn('X');
    setWinnerInfo(null);
    if (socket) {
      socket.emit('tictactoe_reset', { chatId, scores, hostId: resolvedHostId });
    }
  };

  // Dynamic Scoreboard for accurate player perspective
  const myWins = mySymbol === 'X' ? scores.x : scores.o;
  const partnerWins = mySymbol === 'X' ? scores.o : scores.x;
  const myColor = mySymbol === 'X' ? '#38bdf8' : '#f43f5e';
  const partnerColor = partnerSymbol === 'X' ? '#38bdf8' : '#f43f5e';

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
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>🎮</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                Tic-Tac-Toe Arena
              </h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8' }}>
                You are <strong style={{ color: myColor }}>{mySymbol}</strong> • Partner is <strong style={{ color: partnerColor }}>{partnerSymbol}</strong>
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

        {/* Live In-Game Voice Chat */}
        {chatId && (
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
            <GameVoiceChat chatId={chatId} partnerName={partnerName || 'Friend'} compact={false} />
          </div>
        )}

        {/* Scoreboard */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-around', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '16px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.74rem', color: myColor, fontWeight: 800 }}>You ({mySymbol})</span>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#f8fafc' }}>{myWins}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>Ties</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#cbd5e1' }}>{scores.draws}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.74rem', color: partnerColor, fontWeight: 800 }}>{partnerName || 'Friend'} ({partnerSymbol})</span>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#f8fafc' }}>{partnerWins}</div>
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
              background: winnerInfo.winner === mySymbol
                ? 'rgba(16, 185, 129, 0.22)'
                : (winnerInfo.winner === partnerSymbol ? 'rgba(244, 63, 94, 0.22)' : 'rgba(251, 191, 36, 0.2)'),
              border: `1.5px solid ${winnerInfo.winner === mySymbol ? '#10b981' : (winnerInfo.winner === partnerSymbol ? '#f43f5e' : '#fbbf24')}`,
              fontSize: '0.88rem',
              fontWeight: 800,
              color: '#fff'
            }}>
              {winnerInfo.winner === mySymbol ? (
                '🎉 You Won! (+10 Sparks)'
              ) : winnerInfo.winner === partnerSymbol ? (
                `👑 ${partnerName || 'Friend'} Won! (You Lost)`
              ) : (
                '🤝 It\'s a Draw / Tie!'
              )}
            </div>
          ) : (
            <div style={{
              fontSize: '0.84rem',
              fontWeight: 700,
              color: isMyTurn ? myColor : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}>
              <span>Turn:</span>
              <span style={{ fontSize: '0.96rem', fontWeight: 900, color: isMyTurn ? myColor : '#cbd5e1' }}>
                {isMyTurn
                  ? `🎯 Your Turn (${mySymbol})`
                  : `⏳ Waiting for ${partnerName || 'Friend'} (${partnerSymbol})...`}
              </span>
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
            const cellColor = cell === 'X' ? '#38bdf8' : '#f43f5e';
            const canClick = !cell && !winnerInfo && isMyTurn;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleCellClick(idx)}
                style={{
                  background: isWinningCell
                    ? (cell === mySymbol ? 'rgba(16, 185, 129, 0.35)' : 'rgba(244, 63, 94, 0.35)')
                    : 'rgba(30, 41, 59, 0.75)',
                  border: isWinningCell
                    ? (cell === mySymbol ? '2px solid #10b981' : '2px solid #f43f5e')
                    : '1.5px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2.5rem',
                  fontWeight: 900,
                  cursor: canClick ? 'pointer' : 'default',
                  opacity: (!cell && !winnerInfo && !isMyTurn) ? 0.7 : 1,
                  color: cellColor,
                  boxShadow: isWinningCell ? `0 0 16px ${cellColor}` : '0 4px 10px rgba(0,0,0,0.3)',
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
