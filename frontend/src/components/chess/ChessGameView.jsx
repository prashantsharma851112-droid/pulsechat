/**
 * ChessGameView.jsx
 * Unified UI Container for both 3D & 2D Chessboard Modes.
 * Features Player Panels with Avatars, Captured Pieces, Turn Indicators,
 * Move History (SAN), Pawn Promotion Selector, 2D/3D Mode Toggle,
 * Board Flip, Rematch, Draw, Resignation, and In-Game Voice Chat.
 */

import React, { useState, useMemo } from 'react';
import { RotateCw, Undo2, Flag, Handshake, Box, Layers, Volume2, ShieldAlert, Award, ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import ChessBoard3D from './ChessBoard3D';
import ChessBoard2D from './ChessBoard2D';
import { CHESS_PIECE_SVGS } from './ChessBoard2D';
import GameVoiceChat from '../chat/GameVoiceChat';

export default function ChessGameView({
  // Game state
  boardGrid,
  selectedSquare,
  legalMoves,
  lastMove,
  inCheckSquare,
  gameStatus,
  capturedPieces = { white: [], black: [] },
  moveHistory = [], // array of SAN strings or move objects
  isAIThinking = false,
  
  // Players metadata
  myPlayer = { name: 'You', avatar: '', color: 'w' },
  opponentPlayer = { name: 'Computer', avatar: '', color: 'b', isOnline: true },
  
  // Actions
  onSquareClick,
  onPromotionSelect,
  pendingPromotion = null, // { from, to } if waiting for promotion choice
  onUndo,
  canUndo = false,
  onResign,
  onOfferDraw,
  drawOfferedByOpponent = false,
  onAcceptDraw,
  onDeclineDraw,
  onRematch,
  rematchRequested = false,
  onBack,
  
  // Mode info
  gameMode = 'ai', // 'ai' | 'friend'
  aiLevel = 1,
  chatId = null,
  disabled = false
}) {
  const [use3D, setUse3D] = useState(true);
  const [isFlipped, setIsFlipped] = useState(() => myPlayer.color === 'b');
  const [showVoiceChat, setShowVoiceChat] = useState(false);

  // Determine whose turn it is
  const isMyTurn = gameStatus?.turn === myPlayer.color && !gameStatus?.isGameOver;

  // Render captured pieces tray
  const renderCapturedTray = (pieceTypes, colorPrefix) => {
    if (!pieceTypes || pieceTypes.length === 0) return null;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
        {pieceTypes.map((type, idx) => {
          const key = `${colorPrefix}${type}`;
          return (
            <div key={idx} style={{ width: '18px', height: '18px', opacity: 0.85 }}>
              {CHESS_PIECE_SVGS[key]}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: '560px',
        margin: '0 auto',
        padding: '8px 12px',
        boxSizing: 'border-box',
        color: '#fff',
        userSelect: 'none'
      }}
    >
      {/* 1. Header Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
          padding: '4px 6px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                color: '#fff',
                padding: '6px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.8rem',
                fontWeight: 700
              }}
            >
              <ArrowLeft size={16} /> Exit
            </button>
          )}

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main, #fff)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ♟️ 3D Chess {gameMode === 'ai' ? `(Level ${aiLevel})` : '• 1v1 Arena'}
            </span>
            <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>
              {gameMode === 'ai'
                ? (aiLevel <= 3 ? 'Easy AI' : (aiLevel <= 6 ? 'Normal AI' : (aiLevel <= 9 ? 'Advanced AI' : 'Master AI')))
                : `Playing vs ${opponentPlayer.name}`}
            </span>
          </div>
        </div>

        {/* View Controls: 2D/3D & Flip Board */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {chatId && (
            <button
              type="button"
              onClick={() => setShowVoiceChat(prev => !prev)}
              title="Toggle In-Game Mic"
              style={{
                background: showVoiceChat ? 'rgba(56, 189, 248, 0.22)' : 'rgba(255, 255, 255, 0.08)',
                border: showVoiceChat ? '1.5px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                color: showVoiceChat ? '#38bdf8' : '#fff',
                padding: '6px 9px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.74rem',
                fontWeight: 700
              }}
            >
              <Volume2 size={15} />
            </button>
          )}

          <button
            type="button"
            onClick={() => setUse3D(prev => !prev)}
            title="Switch 3D / 2D View"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '12px',
              color: '#fff',
              padding: '6px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.74rem',
              fontWeight: 700
            }}
          >
            {use3D ? <Box size={14} color="#38bdf8" /> : <Layers size={14} color="#facc15" />}
            {use3D ? '3D' : '2D'}
          </button>

          <button
            type="button"
            onClick={() => setIsFlipped(prev => !prev)}
            title="Rotate Board Perspective"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '12px',
              color: '#fff',
              padding: '6px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <RotateCw size={15} />
          </button>
        </div>
      </div>

      {/* Voice Chat Component Drawer if enabled */}
      {showVoiceChat && chatId && (
        <div style={{ marginBottom: '8px' }}>
          <GameVoiceChat chatId={chatId} partnerName={opponentPlayer.name} compact={true} />
        </div>
      )}

      {/* 2. Opponent Player Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: !isMyTurn && !gameStatus?.isGameOver
            ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.18), rgba(99, 102, 241, 0.12))'
            : 'rgba(255, 255, 255, 0.04)',
          border: !isMyTurn && !gameStatus?.isGameOver
            ? '1.5px solid rgba(56, 189, 248, 0.45)'
            : '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: '8px 12px',
          marginBottom: '6px',
          transition: 'all 0.2s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          {/* Avatar / Symbol */}
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: opponentPlayer.color === 'w' ? '#f8fafc' : '#1e293b',
              border: '2px solid rgba(255, 255, 255, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
              overflow: 'hidden'
            }}
          >
            {opponentPlayer.avatar ? (
              <img src={opponentPlayer.avatar} alt="Opponent" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              opponentPlayer.color === 'w' ? '♔' : '♚'
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 800 }}>{opponentPlayer.name}</span>
              <span
                style={{
                  fontSize: '0.62rem',
                  padding: '1px 6px',
                  borderRadius: '6px',
                  background: opponentPlayer.color === 'w' ? '#f8fafc' : '#334155',
                  color: opponentPlayer.color === 'w' ? '#0f172a' : '#fff',
                  fontWeight: 800
                }}
              >
                {opponentPlayer.color === 'w' ? 'White' : 'Black'}
              </span>
            </div>
            {renderCapturedTray(
              opponentPlayer.color === 'w' ? capturedPieces.white : capturedPieces.black,
              opponentPlayer.color === 'w' ? 'b' : 'w'
            )}
          </div>
        </div>

        {/* Turn indicator / Thinking state */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isAIThinking && (
            <span style={{ fontSize: '0.74rem', color: '#38bdf8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Loader2 size={13} className="animate-spin" /> Thinking...
            </span>
          )}
          {!isMyTurn && !isAIThinking && !gameStatus?.isGameOver && (
            <span style={{ fontSize: '0.74rem', color: '#38bdf8', fontWeight: 700 }}>
              Turn
            </span>
          )}
        </div>
      </div>

      {/* 3. The Chessboard (3D or 2D) */}
      <div style={{ position: 'relative', width: '100%', marginBottom: '6px' }}>
        {use3D ? (
          <ChessBoard3D
            boardGrid={boardGrid}
            selectedSquare={selectedSquare}
            legalMoves={legalMoves}
            lastMove={lastMove}
            inCheckSquare={inCheckSquare}
            isFlipped={isFlipped}
            onSquareClick={onSquareClick}
            disabled={disabled || !isMyTurn || isAIThinking}
          />
        ) : (
          <ChessBoard2D
            boardGrid={boardGrid}
            selectedSquare={selectedSquare}
            legalMoves={legalMoves}
            lastMove={lastMove}
            inCheckSquare={inCheckSquare}
            isFlipped={isFlipped}
            onSquareClick={onSquareClick}
            disabled={disabled || !isMyTurn || isAIThinking}
          />
        )}

        {/* Pawn Promotion Modal Overlay */}
        {pendingPromotion && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.88)',
              backdropFilter: 'blur(8px)',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 30,
              padding: '16px'
            }}
          >
            <span style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '14px', color: '#facc15' }}>
              👑 Choose Promotion Piece
            </span>
            <div style={{ display: 'flex', gap: '14px' }}>
              {[
                { type: 'q', name: 'Queen' },
                { type: 'r', name: 'Rook' },
                { type: 'b', name: 'Bishop' },
                { type: 'n', name: 'Knight' }
              ].map(p => {
                const pKey = `${myPlayer.color}${p.type}`;
                return (
                  <button
                    key={p.type}
                    type="button"
                    onClick={() => onPromotionSelect && onPromotionSelect(p.type)}
                    style={{
                      width: '64px',
                      height: '74px',
                      borderRadius: '14px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '2px solid rgba(250, 204, 21, 0.5)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      transition: 'transform 0.14s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <div style={{ width: '42px', height: '42px' }}>
                      {CHESS_PIECE_SVGS[pKey]}
                    </div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#fff' }}>{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Draw Offered by Opponent Banner */}
        {drawOfferedByOpponent && !gameStatus?.isGameOver && (
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              right: '12px',
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))',
              border: '2px solid #38bdf8',
              borderRadius: '14px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              zIndex: 25,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
            }}
          >
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0' }}>
              🤝 {opponentPlayer.name} offered a Draw!
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={onAcceptDraw}
                style={{
                  background: '#22c55e',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  padding: '5px 10px',
                  fontWeight: 800,
                  fontSize: '0.74rem',
                  cursor: 'pointer'
                }}
              >
                Accept
              </button>
              <button
                type="button"
                onClick={onDeclineDraw}
                style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  padding: '5px 10px',
                  fontWeight: 800,
                  fontSize: '0.74rem',
                  cursor: 'pointer'
                }}
              >
                Decline
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. My Player Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: isMyTurn && !gameStatus?.isGameOver
            ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.18), rgba(56, 189, 248, 0.12))'
            : 'rgba(255, 255, 255, 0.04)',
          border: isMyTurn && !gameStatus?.isGameOver
            ? '1.5px solid rgba(34, 197, 94, 0.45)'
            : '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: '8px 12px',
          marginBottom: '8px',
          transition: 'all 0.2s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: myPlayer.color === 'w' ? '#f8fafc' : '#1e293b',
              border: '2px solid rgba(255, 255, 255, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
              overflow: 'hidden'
            }}
          >
            {myPlayer.avatar ? (
              <img src={myPlayer.avatar} alt="You" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              myPlayer.color === 'w' ? '♔' : '♚'
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 800 }}>{myPlayer.name} (You)</span>
              <span
                style={{
                  fontSize: '0.62rem',
                  padding: '1px 6px',
                  borderRadius: '6px',
                  background: myPlayer.color === 'w' ? '#f8fafc' : '#334155',
                  color: myPlayer.color === 'w' ? '#0f172a' : '#fff',
                  fontWeight: 800
                }}
              >
                {myPlayer.color === 'w' ? 'White' : 'Black'}
              </span>
            </div>
            {renderCapturedTray(
              myPlayer.color === 'w' ? capturedPieces.white : capturedPieces.black,
              myPlayer.color === 'w' ? 'b' : 'w'
            )}
          </div>
        </div>

        {/* Turn state */}
        <div>
          {isMyTurn && !gameStatus?.isGameOver && (
            <span style={{ fontSize: '0.74rem', color: '#22c55e', fontWeight: 800 }}>
              Your Turn
            </span>
          )}
        </div>
      </div>

      {/* 5. Game Status & Result Notifications */}
      {gameStatus && (gameStatus.inCheck || gameStatus.isGameOver) && (
        <div
          style={{
            background: gameStatus.isCheckmate
              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(245, 158, 11, 0.25))'
              : (gameStatus.inCheck
                ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.15))'
                : 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(99, 102, 241, 0.15))'),
            border: gameStatus.isCheckmate
              ? '2px solid #ef4444'
              : (gameStatus.inCheck ? '1.5px solid #ef4444' : '1.5px solid #38bdf8'),
            borderRadius: '12px',
            padding: '8px 12px',
            textAlign: 'center',
            marginBottom: '8px',
            fontSize: '0.85rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          {gameStatus.isCheckmate ? '🏆 ' : (gameStatus.inCheck ? '⚠️ ' : '🤝 ')}
          <span>{gameStatus.reason || gameStatus.statusText}</span>
        </div>
      )}

      {/* 6. Action Controls Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          padding: '4px 0'
        }}
      >
        {/* Undo button (Allowed in AI practice mode) */}
        {gameMode === 'ai' && canUndo && !gameStatus?.isGameOver && (
          <button
            type="button"
            onClick={onUndo}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              borderRadius: '10px',
              color: '#fff',
              padding: '6px 12px',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Undo2 size={14} /> Undo
          </button>
        )}

        {/* Offer Draw (Friend mode) */}
        {gameMode === 'friend' && !gameStatus?.isGameOver && (
          <button
            type="button"
            onClick={onOfferDraw}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              borderRadius: '10px',
              color: '#fff',
              padding: '6px 12px',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Handshake size={14} /> Offer Draw
          </button>
        )}

        {/* Resign Button */}
        {!gameStatus?.isGameOver && (
          <button
            type="button"
            onClick={onResign}
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '10px',
              color: '#ef4444',
              padding: '6px 12px',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Flag size={14} /> Resign
          </button>
        )}

        {/* Rematch Button (when game is over) */}
        {gameStatus?.isGameOver && (
          <button
            type="button"
            onClick={onRematch}
            style={{
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              padding: '8px 18px',
              fontSize: '0.84rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)'
            }}
          >
            <RefreshCw size={15} /> Play Again / Rematch
          </button>
        )}
      </div>

      {/* 7. Move History Strip (SAN) */}
      {moveHistory && moveHistory.length > 0 && (
        <div
          style={{
            marginTop: '8px',
            background: 'rgba(0, 0, 0, 0.25)',
            borderRadius: '10px',
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            fontSize: '0.72rem',
            color: '#94a3b8'
          }}
        >
          <span style={{ fontWeight: 800, color: '#cbd5e1' }}>Moves:</span>
          {moveHistory.slice(-12).map((m, idx) => (
            <span key={idx} style={{ color: idx === moveHistory.length - 1 ? '#facc15' : '#cbd5e1', fontWeight: 600 }}>
              {typeof m === 'string' ? m : m.san || `${m.from}-${m.to}`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
