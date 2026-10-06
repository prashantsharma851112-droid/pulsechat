import React, { useState, useEffect, useContext } from 'react';
import { RotateCcw, Trophy, Sparkles, Bot, Zap, Award, Flame, Check } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';

// Web Audio API Synthesizers
const playMoveSound = (isX) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isX ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isX ? 540 : 660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(isX ? 320 : 420, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.14);
  } catch (e) {}
};

const playWinSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.09);
      gain.gain.setValueAtTime(0.22, ctx.currentTime + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + idx * 0.09 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.09);
      osc.stop(ctx.currentTime + idx * 0.09 + 0.3);
    });
  } catch (e) {}
};

const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

const checkWinner = (currentBoard) => {
  for (const combo of WINNING_COMBOS) {
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

// Minimax algorithm for Master AI
const minimax = (tempBoard, isMaximizing) => {
  const result = checkWinner(tempBoard);
  if (result) {
    if (result.winner === 'O') return 10;
    if (result.winner === 'X') return -10;
    if (result.winner === 'draw') return 0;
  }

  if (isMaximizing) {
    let bestScore = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (tempBoard[i] === null) {
        tempBoard[i] = 'O';
        const score = minimax(tempBoard, false);
        tempBoard[i] = null;
        bestScore = Math.max(score, bestScore);
      }
    }
    return bestScore;
  } else {
    let bestScore = Infinity;
    for (let i = 0; i < 9; i++) {
      if (tempBoard[i] === null) {
        tempBoard[i] = 'X';
        const score = minimax(tempBoard, true);
        tempBoard[i] = null;
        bestScore = Math.min(score, bestScore);
      }
    }
    return bestScore;
  }
};

export default function TicTacToeAIGame({ onScoreUpdate }) {
  const { user } = useContext(AuthContext);
  const [board, setBoard] = useState(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);
  const [winnerInfo, setWinnerInfo] = useState(null);
  const [difficulty, setDifficulty] = useState('medium'); // 'easy' | 'medium' | 'hard'
  const [scores, setScores] = useState({ wins: 0, losses: 0, draws: 0 });
  const [isThinking, setIsThinking] = useState(false);
  const [streak, setStreak] = useState(0);

  const getBestMove = (currentBoard, diff) => {
    const available = currentBoard.map((v, i) => (v === null ? i : null)).filter(v => v !== null);
    if (available.length === 0) return null;

    if (diff === 'easy') {
      // 70% random, 30% check for immediate win
      if (Math.random() < 0.3) {
        for (const [a, b, c] of WINNING_COMBOS) {
          const line = [currentBoard[a], currentBoard[b], currentBoard[c]];
          if (line.filter(x => x === 'O').length === 2 && line.includes(null)) {
            return [a, b, c][line.indexOf(null)];
          }
        }
      }
      return available[Math.floor(Math.random() * available.length)];
    }

    if (diff === 'medium') {
      // Win if possible
      for (const [a, b, c] of WINNING_COMBOS) {
        const line = [currentBoard[a], currentBoard[b], currentBoard[c]];
        if (line.filter(x => x === 'O').length === 2 && line.includes(null)) {
          return [a, b, c][line.indexOf(null)];
        }
      }
      // Block X
      for (const [a, b, c] of WINNING_COMBOS) {
        const line = [currentBoard[a], currentBoard[b], currentBoard[c]];
        if (line.filter(x => x === 'X').length === 2 && line.includes(null)) {
          return [a, b, c][line.indexOf(null)];
        }
      }
      // Take Center
      if (currentBoard[4] === null) return 4;
      // Random corner or edge
      return available[Math.floor(Math.random() * available.length)];
    }

    // Hard / Master: Minimax
    let bestScore = -Infinity;
    let move = available[0];
    for (let i = 0; i < 9; i++) {
      if (currentBoard[i] === null) {
        currentBoard[i] = 'O';
        const score = minimax(currentBoard, false);
        currentBoard[i] = null;
        if (score > bestScore) {
          bestScore = score;
          move = i;
        }
      }
    }
    return move;
  };

  const makeAIMove = (currentBoard) => {
    setIsThinking(true);
    setTimeout(() => {
      const bestIdx = getBestMove(currentBoard, difficulty);
      if (bestIdx !== null && bestIdx !== undefined) {
        const nextBoard = [...currentBoard];
        nextBoard[bestIdx] = 'O';
        setBoard(nextBoard);
        playMoveSound(false);

        const result = checkWinner(nextBoard);
        if (result) {
          setWinnerInfo(result);
          if (result.winner === 'O') {
            setScores(s => ({ ...s, losses: s.losses + 1 }));
            setStreak(0);
          } else if (result.winner === 'draw') {
            setScores(s => ({ ...s, draws: s.draws + 1 }));
          }
        } else {
          setIsXNext(true);
        }
      }
      setIsThinking(false);
    }, 450);
  };

  const handleCellClick = (index) => {
    if (board[index] || winnerInfo || isThinking || !isXNext) return;

    const nextBoard = [...board];
    nextBoard[index] = 'X';
    setBoard(nextBoard);
    playMoveSound(true);

    const result = checkWinner(nextBoard);
    if (result) {
      setWinnerInfo(result);
      if (result.winner === 'X') {
        const newStreak = streak + 1;
        setStreak(newStreak);
        setScores(s => ({ ...s, wins: s.wins + 1 }));
        playWinSound();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('pulsechat_trigger_emoji_burst', {
            detail: { emoji: '👑', count: 22 }
          }));
        }
        if (onScoreUpdate) {
          const pts = difficulty === 'hard' ? 25 : (difficulty === 'medium' ? 15 : 10);
          onScoreUpdate('tictactoe', pts, newStreak);
        }
      } else if (result.winner === 'draw') {
        setScores(s => ({ ...s, draws: s.draws + 1 }));
      }
      return;
    }

    setIsXNext(false);
    makeAIMove(nextBoard);
  };

  const handleReset = () => {
    setBoard(Array(9).fill(null));
    setIsXNext(true);
    setWinnerInfo(null);
    setIsThinking(false);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(30, 27, 75, 0.9))',
      borderRadius: '24px',
      border: '1.5px solid rgba(168, 85, 247, 0.4)',
      boxShadow: '0 16px 40px rgba(0, 0, 0, 0.7), 0 0 24px rgba(168, 85, 247, 0.2)',
      padding: '20px',
      maxWidth: '460px',
      margin: '0 auto',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {/* Title & Streak Badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #a855f7, #6366f1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
            boxShadow: '0 4px 12px rgba(168, 85, 247, 0.4)'
          }}>
            🎮
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc' }}>
              Tic-Tac-Toe AI Arena
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Play & Earn Pulse Sparks</span>
          </div>
        </div>

        {streak > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(245, 158, 11, 0.2)',
            border: '1px solid rgba(245, 158, 11, 0.5)',
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '0.76rem',
            fontWeight: 800,
            color: '#fbbf24'
          }}>
            <Flame size={14} color="#f59e0b" /> {streak} Streak!
          </div>
        )}
      </div>

      {/* Difficulty Switcher */}
      <div style={{
        display: 'flex',
        background: 'rgba(0,0,0,0.35)',
        padding: '3px',
        borderRadius: '14px',
        border: '1px solid rgba(255,255,255,0.08)',
        width: '100%',
        marginBottom: '14px'
      }}>
        {[
          { key: 'easy', label: 'Casual', color: '#10b981' },
          { key: 'medium', label: 'Smart AI', color: '#38bdf8' },
          { key: 'hard', label: 'Master AI', color: '#ec4899' }
        ].map(diff => (
          <button
            key={diff.key}
            type="button"
            onClick={() => { setDifficulty(diff.key); handleReset(); }}
            style={{
              flex: 1,
              padding: '6px 4px',
              borderRadius: '11px',
              border: 'none',
              background: difficulty === diff.key ? `linear-gradient(135deg, ${diff.color}, #6366f1)` : 'transparent',
              color: '#fff',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {diff.label}
          </button>
        ))}
      </div>

      {/* Scoreboard */}
      <div style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        background: 'rgba(0,0,0,0.25)',
        padding: '8px 12px',
        borderRadius: '14px',
        marginBottom: '14px',
        border: '1px solid rgba(255,255,255,0.06)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '0.74rem', color: '#38bdf8', fontWeight: 800 }}>X (You)</span>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#f8fafc' }}>{scores.wins}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>Ties</span>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#cbd5e1' }}>{scores.draws}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '0.74rem', color: '#f43f5e', fontWeight: 800 }}>O (Computer)</span>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#f8fafc' }}>{scores.losses}</div>
        </div>
      </div>

      {/* Status Banner */}
      <div style={{ marginBottom: '16px', minHeight: '34px', display: 'flex', alignItems: 'center' }}>
        {winnerInfo ? (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '20px',
            background: winnerInfo.winner === 'X' ? 'rgba(56, 189, 248, 0.25)' : (winnerInfo.winner === 'O' ? 'rgba(244, 63, 94, 0.25)' : 'rgba(255,255,255,0.1)'),
            border: `1.5px solid ${winnerInfo.winner === 'X' ? '#38bdf8' : (winnerInfo.winner === 'O' ? '#f43f5e' : '#94a3b8')}`,
            fontSize: '0.86rem',
            fontWeight: 800,
            color: '#fff'
          }}>
            {winnerInfo.winner === 'X' && `🎉 You Beat Computer! (+${difficulty === 'hard' ? 25 : (difficulty === 'medium' ? 15 : 10)} Sparks)`}
            {winnerInfo.winner === 'O' && '🤖 Computer Won! Try again!'}
            {winnerInfo.winner === 'draw' && '🤝 Good match! It\'s a Draw!'}
          </div>
        ) : (
          <div style={{
            fontSize: '0.84rem',
            fontWeight: 700,
            color: isXNext ? '#38bdf8' : '#f43f5e',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            {isXNext ? (
              <span>Your Turn (X) — Tap a cell</span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Bot size={15} /> Computer is thinking...
              </span>
            )}
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
        aspectRatio: '1',
        marginBottom: '16px'
      }}>
        {board.map((cell, idx) => {
          const isWinningCell = winnerInfo?.line?.includes(idx);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleCellClick(idx)}
              disabled={!!cell || !!winnerInfo || isThinking}
              style={{
                background: isWinningCell
                  ? (winnerInfo.winner === 'X' ? 'rgba(56, 189, 248, 0.35)' : 'rgba(244, 63, 94, 0.35)')
                  : (cell ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)'),
                border: isWinningCell
                  ? `2px solid ${winnerInfo.winner === 'X' ? '#38bdf8' : '#f43f5e'}`
                  : '1.5px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '16px',
                fontSize: '2.4rem',
                fontWeight: 900,
                color: cell === 'X' ? '#38bdf8' : '#f43f5e',
                cursor: (cell || winnerInfo || isThinking) ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
                boxShadow: isWinningCell ? '0 0 16px rgba(168, 85, 247, 0.5)' : 'none',
                userSelect: 'none'
              }}
            >
              {cell}
            </button>
          );
        })}
      </div>

      {/* Action Buttons */}
      <button
        type="button"
        onClick={handleReset}
        style={{
          width: '100%',
          maxWidth: '300px',
          padding: '10px',
          borderRadius: '14px',
          background: winnerInfo ? 'linear-gradient(135deg, #a855f7, #6366f1)' : 'rgba(255,255,255,0.08)',
          border: winnerInfo ? 'none' : '1px solid rgba(255,255,255,0.15)',
          color: '#fff',
          fontWeight: 800,
          fontSize: '0.86rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          boxShadow: winnerInfo ? '0 4px 16px rgba(168, 85, 247, 0.4)' : 'none'
        }}
      >
        <RotateCcw size={16} />
        <span>{winnerInfo ? 'Play Next Round' : 'Restart Game'}</span>
      </button>
    </div>
  );
}
