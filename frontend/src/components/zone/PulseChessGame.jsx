/**
 * PulseChessGame.jsx
 * Mode A: Play Against Computer in Pulse Zone (Ranked/Arcade)
 * Features:
 * - Progressive Difficulty Levels (Level 1 Easy to Level 10+ Master)
 * - 3D Three.js Staunton Chessboard with instant 2D fallback
 * - Asynchronous Non-blocking Web Worker AI
 * - Score and level progression awarded to PulseZone Competitive Leaderboard
 * - 100% Offline Single-player playable once cached
 */

import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { Trophy, Award, Zap, Bot, ArrowLeft, RefreshCw, ChevronRight, CheckCircle2 } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import ChessGameView from '../chess/ChessGameView';
import {
  createChessInstance,
  makeMove,
  getLegalMovesForSquare,
  getBoardGrid,
  getCapturedPieces,
  getGameStatus,
  getKingSquare
} from '../../utils/chess/chessEngine';
import { requestAIMove, cancelAIMove } from '../../utils/chess/aiWorkerManager';

const AI_LEVEL_METADATA = [
  { level: 1, title: 'Novice Bot', difficulty: 'Easy', depth: 1, desc: 'Randomized legal moves & material captures' },
  { level: 2, title: 'Apprentice Bot', difficulty: 'Easy', depth: 1, desc: 'Prioritizes piece defense and captures' },
  { level: 3, title: 'Club Player', difficulty: 'Easy', depth: 2, desc: 'Basic center control and king safety' },
  { level: 4, title: 'Tactician Bot', difficulty: 'Normal', depth: 2, desc: 'MVV-LVA captures & Piece-Square positional values' },
  { level: 5, title: 'Strategist', difficulty: 'Normal', depth: 3, desc: 'Positional awareness, pins, and pawn structure' },
  { level: 6, title: 'Expert Bot', difficulty: 'Normal', depth: 3, desc: 'Quiescence search for sharp capture sequences' },
  { level: 7, title: 'Master Bot', difficulty: 'Advanced', depth: 4, desc: 'Alpha-Beta pruning with deep tactical search' },
  { level: 8, title: 'Candidate Master', difficulty: 'Advanced', depth: 4, desc: 'Endgame table & king pressure calculations' },
  { level: 9, title: 'Grandmaster Bot', difficulty: 'Advanced', depth: 5, desc: 'Deep positional foresight and defensive solidity' },
  { level: 10, title: 'Super GM Alpha', difficulty: 'Master', depth: 5, desc: 'Full-depth minimax search with zero tactical blunders' }
];

export default function PulseChessGame({ onScoreUpdate, onBack }) {
  const { user } = useContext(AuthContext);

  const [currentLevel, setCurrentLevel] = useState(1);
  const [maxUnlockedLevel, setMaxUnlockedLevel] = useState(() => {
    try {
      const saved = localStorage.getItem('pulsechat_chess_max_level');
      return saved ? Math.max(1, parseInt(saved, 10)) : 1;
    } catch {
      return 1;
    }
  });

  const [chessInstance, setChessInstance] = useState(() => createChessInstance());
  const [boardGrid, setBoardGrid] = useState(() => getBoardGrid(createChessInstance()));
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [capturedPieces, setCapturedPieces] = useState({ white: [], black: [] });
  const [gameStatus, setGameStatus] = useState(() => getGameStatus(createChessInstance()));
  const [moveHistory, setMoveHistory] = useState([]);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [pendingPromotion, setPendingPromotion] = useState(null);
  const [historyStack, setHistoryStack] = useState([]); // for undo

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cancelAIMove();
    };
  }, []);

  const refreshBoardState = useCallback((chess, lastMoveObj = null) => {
    setBoardGrid(getBoardGrid(chess));
    setCapturedPieces(getCapturedPieces(chess));
    const status = getGameStatus(chess);
    setGameStatus(status);
    if (lastMoveObj) setLastMove(lastMoveObj);
    setSelectedSquare(null);
    setLegalMoves([]);
  }, []);

  // Reset or Start New Match at given level
  const startNewMatch = useCallback((level = currentLevel) => {
    cancelAIMove();
    const newChess = createChessInstance();
    setChessInstance(newChess);
    setBoardGrid(getBoardGrid(newChess));
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setCapturedPieces({ white: [], black: [] });
    setGameStatus(getGameStatus(newChess));
    setMoveHistory([]);
    setPendingPromotion(null);
    setIsAIThinking(false);
    setHistoryStack([]);
  }, [currentLevel]);

  // Execute AI Response
  const triggerAIMove = useCallback(async (chess, currentLvl) => {
    if (chess.isGameOver()) return;
    setIsAIThinking(true);

    try {
      const bestMove = await requestAIMove(chess, currentLvl);
      if (!isMountedRef.current) return;

      if (bestMove) {
        const moveRes = makeMove(chess, bestMove.from, bestMove.to, bestMove.promotion || 'q');
        if (moveRes) {
          setMoveHistory(prev => [...prev, moveRes.san]);
          refreshBoardState(chess, { from: moveRes.from, to: moveRes.to });

          const newStatus = getGameStatus(chess);
          if (newStatus.isGameOver) {
            if (newStatus.isCheckmate && newStatus.winner === 'b') {
              // AI won
              if (onScoreUpdate) {
                onScoreUpdate('3D Chess', 0, currentLvl, { outcome: 'loss' });
              }
            } else if (newStatus.isDraw) {
              if (onScoreUpdate) {
                onScoreUpdate('3D Chess', 25, currentLvl, { outcome: 'draw' });
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('AI Move calculation interrupted or failed:', err);
    } finally {
      if (isMountedRef.current) {
        setIsAIThinking(false);
      }
    }
  }, [onScoreUpdate, refreshBoardState]);

  // Handle User Click on Square
  const handleSquareClick = useCallback((square) => {
    if (isAIThinking || gameStatus.isGameOver || pendingPromotion) return;
    if (gameStatus.turn !== 'w') return; // User is White

    const piece = chessInstance.get(square);

    // If clicking own piece, select it and show legal moves
    if (piece && piece.color === 'w') {
      setSelectedSquare(square);
      const moves = getLegalMovesForSquare(chessInstance, square);
      setLegalMoves(moves);
      return;
    }

    // If a square was already selected and user clicks target square
    if (selectedSquare) {
      const moveObj = legalMoves.find(m => m.to === square);
      if (moveObj) {
        // Check if pawn promotion
        const isPawn = chessInstance.get(selectedSquare)?.type === 'p';
        const isPromotionRank = square.endsWith('8');

        if (isPawn && isPromotionRank) {
          setPendingPromotion({ from: selectedSquare, to: square });
          return;
        }

        // Execute user move
        executeUserMove(selectedSquare, square, 'q');
      } else {
        setSelectedSquare(null);
        setLegalMoves([]);
      }
    }
  }, [isAIThinking, gameStatus, pendingPromotion, chessInstance, selectedSquare, legalMoves]);

  const executeUserMove = useCallback((from, to, promotion = 'q') => {
    // Save history for undo
    setHistoryStack(prev => [...prev, chessInstance.fen()]);

    const moveRes = makeMove(chessInstance, from, to, promotion);
    if (!moveRes) return;

    setPendingPromotion(null);
    setMoveHistory(prev => [...prev, moveRes.san]);
    refreshBoardState(chessInstance, { from, to });

    const newStatus = getGameStatus(chessInstance);

    if (newStatus.isGameOver) {
      if (newStatus.isCheckmate && newStatus.winner === 'w') {
        // User won against Computer!
        const earnedPoints = currentLevel * 100;
        const nextLvl = currentLevel + 1;
        const newMax = Math.max(maxUnlockedLevel, nextLvl);
        setMaxUnlockedLevel(newMax);
        try {
          localStorage.setItem('pulsechat_chess_max_level', String(newMax));
        } catch (_) {}

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('pulsechat_trigger_emoji_burst', {
            detail: { emoji: '👑', count: 25 }
          }));
        }

        if (onScoreUpdate) {
          onScoreUpdate('3D Chess', earnedPoints, currentLevel, { outcome: 'win' });
        }
      } else if (newStatus.isDraw) {
        if (onScoreUpdate) {
          onScoreUpdate('3D Chess', 25, currentLevel, { outcome: 'draw' });
        }
      }
      return;
    }

    // Trigger AI response
    triggerAIMove(chessInstance, currentLevel);
  }, [chessInstance, currentLevel, maxUnlockedLevel, onScoreUpdate, refreshBoardState, triggerAIMove]);

  const handlePromotionSelect = useCallback((pieceType) => {
    if (!pendingPromotion) return;
    executeUserMove(pendingPromotion.from, pendingPromotion.to, pieceType);
  }, [pendingPromotion, executeUserMove]);

  const handleUndo = useCallback(() => {
    if (historyStack.length === 0 || isAIThinking) return;
    cancelAIMove();
    const previousFen = historyStack[historyStack.length - 1];
    setHistoryStack(prev => prev.slice(0, -1));

    const restored = createChessInstance(previousFen);
    setChessInstance(restored);
    refreshBoardState(restored, null);
    setMoveHistory(prev => prev.slice(0, -2)); // Remove both AI and user move
    setIsAIThinking(false);
  }, [historyStack, isAIThinking, refreshBoardState]);

  const handleResign = useCallback(() => {
    if (gameStatus.isGameOver) return;
    cancelAIMove();
    setGameStatus(prev => ({
      ...prev,
      isGameOver: true,
      winner: 'b',
      statusText: 'Resigned',
      reason: 'You resigned the game.'
    }));
    if (onScoreUpdate) {
      onScoreUpdate('3D Chess', 0, currentLevel, { outcome: 'loss' });
    }
  }, [gameStatus.isGameOver, currentLevel, onScoreUpdate]);

  const inCheckSquare = gameStatus.inCheck ? getKingSquare(chessInstance, gameStatus.turn) : null;
  const currentLvlMeta = AI_LEVEL_METADATA.find(m => m.level === currentLevel) || AI_LEVEL_METADATA[0];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        minHeight: '100%',
        boxSizing: 'border-box'
      }}
    >
      {/* Level Selector Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '16px',
          marginBottom: '8px',
          overflowX: 'auto',
          scrollbarWidth: 'none'
        }}
      >
        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f59e0b', whiteSpace: 'nowrap' }}>
          LEVEL:
        </span>
        {AI_LEVEL_METADATA.map((lvl) => {
          const isUnlocked = lvl.level <= maxUnlockedLevel;
          const isSelected = lvl.level === currentLevel;
          return (
            <button
              key={lvl.level}
              type="button"
              disabled={!isUnlocked}
              onClick={() => {
                if (lvl.level !== currentLevel) {
                  setCurrentLevel(lvl.level);
                  startNewMatch(lvl.level);
                }
              }}
              style={{
                background: isSelected
                  ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                  : isUnlocked
                  ? 'rgba(255, 255, 255, 0.08)'
                  : 'rgba(255, 255, 255, 0.02)',
                color: isSelected ? '#000' : isUnlocked ? '#fff' : '#64748b',
                border: isSelected
                  ? '1.5px solid #fbbf24'
                  : isUnlocked
                  ? '1px solid rgba(255, 255, 255, 0.15)'
                  : '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '10px',
                padding: '4px 10px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: isUnlocked ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>L{lvl.level}</span>
              {lvl.level < maxUnlockedLevel && <CheckCircle2 size={12} color={isSelected ? '#000' : '#10b981'} />}
            </button>
          );
        })}
      </div>

      {/* Main Unified Chessboard View */}
      <ChessGameView
        boardGrid={boardGrid}
        selectedSquare={selectedSquare}
        legalMoves={legalMoves}
        lastMove={lastMove}
        inCheckSquare={inCheckSquare}
        gameStatus={gameStatus}
        capturedPieces={capturedPieces}
        moveHistory={moveHistory}
        isAIThinking={isAIThinking}
        myPlayer={{
          name: user?.displayName || user?.username || 'You',
          avatar: user?.avatar || '',
          color: 'w'
        }}
        opponentPlayer={{
          name: `${currentLvlMeta.title} (${currentLvlMeta.difficulty})`,
          avatar: '',
          color: 'b',
          isOnline: true
        }}
        onSquareClick={handleSquareClick}
        onPromotionSelect={handlePromotionSelect}
        pendingPromotion={pendingPromotion}
        onUndo={handleUndo}
        canUndo={historyStack.length > 0 && !isAIThinking && !gameStatus.isGameOver}
        onResign={handleResign}
        onRematch={() => startNewMatch(currentLevel)}
        onBack={onBack}
        gameMode="ai"
        aiLevel={currentLevel}
      />

      {/* Level Win Banner & Advance Button */}
      {gameStatus.isGameOver && gameStatus.winner === 'w' && currentLevel < 10 && (
        <div
          style={{
            marginTop: '12px',
            padding: '12px 16px',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.3))',
            border: '1.5px solid #10b981',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <div>
            <div style={{ fontWeight: 800, color: '#10b981', fontSize: '0.95rem' }}>
              Level {currentLevel} Conquered! (+{currentLevel * 100} pts)
            </div>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)' }}>
              Next Opponent: {AI_LEVEL_METADATA[currentLevel]?.title} ({AI_LEVEL_METADATA[currentLevel]?.difficulty})
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = currentLevel + 1;
              setCurrentLevel(next);
              startNewMatch(next);
            }}
            style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              border: 'none',
              borderRadius: '12px',
              padding: '8px 16px',
              color: '#fff',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Play Level {currentLevel + 1} <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
