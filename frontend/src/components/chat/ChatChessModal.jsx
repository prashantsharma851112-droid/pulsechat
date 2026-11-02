/**
 * ChatChessModal.jsx
 * Mode B: Real-Time 1v1 Chess Inside PulseChat Conversations
 * Features:
 * - Shared Match Creation & In-Chat Invitations
 * - Synchronized 1v1 Real-Time Multiplayer via authenticated Socket.IO
 * - Authoritative Server Move Enforcement & Monotonic Turn Sync
 * - Reconnection and State Recovery via 'chess_sync'
 * - Resignation, Draw Negotiation & Rematch
 * - In-Game Live Voice Chat (<GameVoiceChat compact={true} />)
 * - Optional Casual vs Computer Mode inside chat
 * - STRICT ISOLATION: Zero calls to /api/zone/score (Casual only)
 */

import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { X, Trophy, Sparkles, Swords, User, Bot, RotateCcw, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { SocketContext } from '../../context/SocketContext';
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

export default function ChatChessModal({
  chatId,
  partnerName = 'Friend',
  partnerAvatar = '',
  partnerId = '',
  onClose
}) {
  const { socket } = useContext(SocketContext);
  const { user } = useContext(AuthContext);

  const currentUserId = String(user?.id || user?._id || '');
  const resolvedPartnerId = partnerId || (chatId && chatId.includes('_')
    ? chatId.split('_').find(id => String(id) !== currentUserId) || ''
    : '');

  // Screen State: 'lobby' | 'playing'
  const [gameMode, setGameMode] = useState('friend'); // 'friend' | 'casual_ai'
  const [activeMatch, setActiveMatch] = useState(null);
  const [inviteSent, setInviteSent] = useState(false);
  const [incomingInvite, setIncomingInvite] = useState(null);
  const [declinedNotice, setDeclinedNotice] = useState(false);
  const [drawOfferedByOpponent, setDrawOfferedByOpponent] = useState(false);
  const [drawDeclinedNotice, setDrawDeclinedNotice] = useState(false);
  const [preferredColor, setPreferredColor] = useState('random'); // 'w' | 'b' | 'random'

  // Chessboard Engine State
  const [chessInstance, setChessInstance] = useState(() => createChessInstance());
  const [boardGrid, setBoardGrid] = useState(() => getBoardGrid(createChessInstance()));
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [capturedPieces, setCapturedPieces] = useState({ white: [], black: [] });
  const [gameStatus, setGameStatus] = useState(() => getGameStatus(createChessInstance()));
  const [moveHistory, setMoveHistory] = useState([]);
  const [pendingPromotion, setPendingPromotion] = useState(null);
  const [isAIThinking, setIsAIThinking] = useState(false);

  // Synchronize board state helper
  const syncFromFen = useCallback((fen, lastMoveObj = null, customStatus = null) => {
    const instance = createChessInstance(fen);
    setChessInstance(instance);
    setBoardGrid(getBoardGrid(instance));
    setCapturedPieces(getCapturedPieces(instance));
    const status = customStatus || getGameStatus(instance);
    setGameStatus(status);
    if (lastMoveObj) setLastMove(lastMoveObj);
    setSelectedSquare(null);
    setLegalMoves([]);
  }, []);

  // 1. Initial Match Check on Mount & Auto-Open broadcast
  useEffect(() => {
    if (!socket || !chatId) return;

    // Check if an existing match is active in this chat room
    socket.emit('chess_sync', { chatId }, (res) => {
      if (res && res.hasActiveMatch && res.match) {
        setActiveMatch(res.match);
        setGameMode('friend');
        syncFromFen(res.match.fen, res.match.history?.[res.match.history.length - 1] || null);
        setMoveHistory((res.match.history || []).map(h => h.san));
      }
    });

    // Notify partner that chess modal was opened
    socket.emit('request_open_chess', {
      chatId,
      receiverId: resolvedPartnerId,
      senderName: user?.displayName || user?.username || 'Player'
    });
  }, [socket, chatId, resolvedPartnerId, user, syncFromFen]);

  // 2. Real-Time Socket Listeners for 1v1 Chess
  useEffect(() => {
    if (!socket) return;

    const handleInvitation = (data) => {
      if (data.chatId !== chatId) return;
      if (String(data.inviter?.id) !== currentUserId) {
        setIncomingInvite(data);
      }
    };

    const handleMatchStarted = ({ chatId: roomChatId, match }) => {
      if (roomChatId !== chatId) return;
      setActiveMatch(match);
      setGameMode('friend');
      setInviteSent(false);
      setIncomingInvite(null);
      setDeclinedNotice(false);
      setDrawOfferedByOpponent(false);
      syncFromFen(match.fen, null);
      setMoveHistory([]);
    };

    const handleDeclined = (data) => {
      if (data.chatId !== chatId) return;
      setInviteSent(false);
      setDeclinedNotice(true);
      setTimeout(() => setDeclinedNotice(false), 5000);
    };

    const handleMoveApplied = (data) => {
      if (activeMatch && data.matchId !== activeMatch.matchId) return;

      setActiveMatch(prev => prev ? {
        ...prev,
        fen: data.fen,
        turn: data.turn,
        moveNumber: data.moveNumber,
        status: data.status,
        statusReason: data.statusReason,
        winner: data.winner,
        inCheck: data.inCheck
      } : null);

      syncFromFen(data.fen, data.move);
      if (data.san) {
        setMoveHistory(prev => [...prev, data.san]);
      }
    };

    const handleGameOver = (data) => {
      if (activeMatch && data.matchId !== activeMatch.matchId) return;

      setActiveMatch(prev => prev ? {
        ...prev,
        status: data.status,
        statusReason: data.statusReason,
        winner: data.winner
      } : null);

      setGameStatus(prev => ({
        ...prev,
        isGameOver: true,
        winner: data.winner,
        statusText: data.status,
        reason: data.statusReason
      }));
    };

    const handleDrawOffered = (data) => {
      if (activeMatch && data.matchId !== activeMatch.matchId) return;
      if (String(data.userId) !== currentUserId) {
        setDrawOfferedByOpponent(true);
      }
    };

    const handleDrawDeclined = (data) => {
      if (activeMatch && data.matchId !== activeMatch.matchId) return;
      setDrawDeclinedNotice(true);
      setTimeout(() => setDrawDeclinedNotice(false), 4000);
    };

    socket.on('chess_invitation', handleInvitation);
    socket.on('chess_invited', handleInvitation);
    socket.on('chess_match_started', handleMatchStarted);
    socket.on('chess_declined', handleDeclined);
    socket.on('chess_move_applied', handleMoveApplied);
    socket.on('chess_game_over', handleGameOver);
    socket.on('chess_draw_offered', handleDrawOffered);
    socket.on('chess_draw_declined', handleDrawDeclined);

    return () => {
      socket.off('chess_invitation', handleInvitation);
      socket.off('chess_invited', handleInvitation);
      socket.off('chess_match_started', handleMatchStarted);
      socket.off('chess_declined', handleDeclined);
      socket.off('chess_move_applied', handleMoveApplied);
      socket.off('chess_game_over', handleGameOver);
      socket.off('chess_draw_offered', handleDrawOffered);
      socket.off('chess_draw_declined', handleDrawDeclined);
    };
  }, [socket, chatId, currentUserId, activeMatch, syncFromFen]);

  // Determine local player's color in multiplayer
  const myColor = activeMatch
    ? (String(activeMatch.whitePlayer.id) === currentUserId ? 'w' : 'b')
    : 'w';

  // 3. User Initiates Match Invitation
  const sendFriendInvite = useCallback(() => {
    if (!socket) return;
    setInviteSent(true);
    setDeclinedNotice(false);

    socket.emit('chess_invite', {
      chatId,
      inviter: {
        id: currentUserId,
        name: user?.displayName || user?.username || 'Player',
        avatar: user?.avatar || ''
      },
      recipient: {
        id: resolvedPartnerId,
        name: partnerName,
        avatar: partnerAvatar
      },
      color: preferredColor
    });
  }, [socket, chatId, currentUserId, user, resolvedPartnerId, partnerName, partnerAvatar, preferredColor]);

  // Accept incoming invite
  const acceptIncomingInvite = useCallback(() => {
    if (!socket || !incomingInvite) return;
    socket.emit('chess_accept', incomingInvite);
    setIncomingInvite(null);
  }, [socket, incomingInvite]);

  // Decline incoming invite
  const declineIncomingInvite = useCallback(() => {
    if (!socket || !incomingInvite) return;
    socket.emit('chess_decline', { chatId });
    setIncomingInvite(null);
  }, [socket, incomingInvite, chatId]);

  // 4. Handle Square Clicks
  const handleSquareClick = useCallback((square) => {
    if (gameStatus.isGameOver || pendingPromotion) return;

    if (gameMode === 'friend') {
      if (!activeMatch) return;
      if (activeMatch.turn !== myColor) return; // Enforce turn

      const piece = chessInstance.get(square);

      if (piece && piece.color === myColor) {
        setSelectedSquare(square);
        const moves = getLegalMovesForSquare(chessInstance, square);
        setLegalMoves(moves);
        return;
      }

      if (selectedSquare) {
        const moveObj = legalMoves.find(m => m.to === square);
        if (moveObj) {
          const isPawn = chessInstance.get(selectedSquare)?.type === 'p';
          const isPromotionRank = (myColor === 'w' && square.endsWith('8')) || (myColor === 'b' && square.endsWith('1'));

          if (isPawn && isPromotionRank) {
            setPendingPromotion({ from: selectedSquare, to: square });
            return;
          }

          executeMultiplayerMove(selectedSquare, square, 'q');
        } else {
          setSelectedSquare(null);
          setLegalMoves([]);
        }
      }
    } else {
      // Casual vs AI inside chat
      if (isAIThinking || gameStatus.turn !== 'w') return;

      const piece = chessInstance.get(square);
      if (piece && piece.color === 'w') {
        setSelectedSquare(square);
        const moves = getLegalMovesForSquare(chessInstance, square);
        setLegalMoves(moves);
        return;
      }

      if (selectedSquare) {
        const moveObj = legalMoves.find(m => m.to === square);
        if (moveObj) {
          const isPawn = chessInstance.get(selectedSquare)?.type === 'p';
          if (isPawn && square.endsWith('8')) {
            setPendingPromotion({ from: selectedSquare, to: square });
            return;
          }
          executeCasualAIMove(selectedSquare, square, 'q');
        } else {
          setSelectedSquare(null);
          setLegalMoves([]);
        }
      }
    }
  }, [gameStatus, pendingPromotion, gameMode, activeMatch, myColor, chessInstance, selectedSquare, legalMoves, isAIThinking]);

  // Execute Real-Time Move via Socket.IO
  const executeMultiplayerMove = useCallback((from, to, promotion = 'q') => {
    if (!socket || !activeMatch) return;

    setPendingPromotion(null);
    setSelectedSquare(null);
    setLegalMoves([]);

    socket.emit('chess_move', {
      matchId: activeMatch.matchId,
      move: { from, to, promotion },
      moveNumber: activeMatch.moveNumber
    }, (ack) => {
      if (ack && !ack.success) {
        console.warn('Chess move rejected by server:', ack.error);
      }
    });
  }, [socket, activeMatch]);

  // Execute Casual AI Move (No zone score updates!)
  const executeCasualAIMove = useCallback(async (from, to, promotion = 'q') => {
    const moveRes = makeMove(chessInstance, from, to, promotion);
    if (!moveRes) return;

    setPendingPromotion(null);
    setMoveHistory(prev => [...prev, moveRes.san]);
    syncFromFen(chessInstance.fen(), { from, to });

    const newStatus = getGameStatus(chessInstance);
    if (newStatus.isGameOver) return;

    // AI Response
    setIsAIThinking(true);
    try {
      const bestMove = await requestAIMove(chessInstance, 3);
      if (bestMove) {
        const aiRes = makeMove(chessInstance, bestMove.from, bestMove.to, bestMove.promotion || 'q');
        if (aiRes) {
          setMoveHistory(prev => [...prev, aiRes.san]);
          syncFromFen(chessInstance.fen(), { from: aiRes.from, to: aiRes.to });
        }
      }
    } catch (_) {}
    setIsAIThinking(false);
  }, [chessInstance, syncFromFen]);

  const handlePromotionSelect = useCallback((pieceType) => {
    if (!pendingPromotion) return;
    if (gameMode === 'friend') {
      executeMultiplayerMove(pendingPromotion.from, pendingPromotion.to, pieceType);
    } else {
      executeCasualAIMove(pendingPromotion.from, pendingPromotion.to, pieceType);
    }
  }, [pendingPromotion, gameMode, executeMultiplayerMove, executeCasualAIMove]);

  // Resignation & Draw Handlers
  const handleResign = useCallback(() => {
    if (gameMode === 'friend' && activeMatch && socket) {
      socket.emit('chess_resign', { matchId: activeMatch.matchId });
    } else {
      setGameStatus(prev => ({
        ...prev,
        isGameOver: true,
        winner: 'b',
        statusText: 'Resigned',
        reason: 'You resigned the game.'
      }));
    }
  }, [gameMode, activeMatch, socket]);

  const handleOfferDraw = useCallback(() => {
    if (gameMode === 'friend' && activeMatch && socket) {
      socket.emit('chess_draw_offer', { matchId: activeMatch.matchId });
    }
  }, [gameMode, activeMatch, socket]);

  const handleAcceptDraw = useCallback(() => {
    if (gameMode === 'friend' && activeMatch && socket) {
      socket.emit('chess_draw_response', { matchId: activeMatch.matchId, accepted: true });
      setDrawOfferedByOpponent(false);
    }
  }, [gameMode, activeMatch, socket]);

  const handleDeclineDraw = useCallback(() => {
    if (gameMode === 'friend' && activeMatch && socket) {
      socket.emit('chess_draw_response', { matchId: activeMatch.matchId, accepted: false });
      setDrawOfferedByOpponent(false);
    }
  }, [gameMode, activeMatch, socket]);

  const handleRematch = useCallback(() => {
    if (gameMode === 'friend' && activeMatch && socket) {
      socket.emit('chess_rematch', { matchId: activeMatch.matchId });
    } else {
      const reset = createChessInstance();
      setChessInstance(reset);
      syncFromFen(reset.fen());
      setMoveHistory([]);
      setIsAIThinking(false);
    }
  }, [gameMode, activeMatch, socket, syncFromFen]);

  const inCheckSquare = gameStatus.inCheck ? getKingSquare(chessInstance, gameStatus.turn) : null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1400,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px'
      }}
    >
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
          background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.98), rgba(30, 27, 75, 0.95))',
          border: '1.5px solid rgba(245, 158, 11, 0.4)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(245, 158, 11, 0.2)',
          color: '#fff'
        }}
      >
        {/* Top Modal Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>♟️</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>PulseChat Chess</div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                {activeMatch ? `Playing with ${partnerName}` : '1v1 Live Match & Casual Play'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ overflowY: 'auto', padding: '12px', flex: 1 }}>
          {/* Incoming Match Invitation Prompt */}
          {incomingInvite && !activeMatch && (
            <div
              style={{
                marginBottom: '16px',
                padding: '16px',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.3))',
                border: '1.5px solid #f59e0b',
                borderRadius: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.5rem' }}>⚔️</span>
                <div>
                  <div style={{ fontWeight: 800, color: '#f59e0b', fontSize: '0.95rem' }}>
                    {incomingInvite.inviter?.name || partnerName} challenged you to Chess!
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                    Would you like to accept this real-time match?
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={declineIncomingInvite}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '10px',
                    padding: '8px 16px',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  Decline
                </button>
                <button
                  type="button"
                  onClick={acceptIncomingInvite}
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '8px 18px',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  Accept & Play
                </button>
              </div>
            </div>
          )}

          {/* Draw Declined Notice */}
          {drawDeclinedNotice && (
            <div
              style={{
                marginBottom: '10px',
                padding: '8px 12px',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid #ef4444',
                borderRadius: '12px',
                fontSize: '0.8rem',
                color: '#fca5a5'
              }}
            >
              Draw offer was declined by opponent.
            </div>
          )}

          {/* Lobby Screen: Choose Play with Friend or Casual AI */}
          {!activeMatch && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '8px 0' }}>
              <div
                style={{
                  padding: '16px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: '18px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
                    <Swords size={18} color="#f59e0b" />
                    <span>Play With {partnerName}</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', background: '#f59e0b', color: '#000', padding: '2px 8px', borderRadius: '10px', fontWeight: 800 }}>
                    1V1 CHAT
                  </span>
                </div>

                <div style={{ fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                  Challenge your friend to a real-time chess duel inside this conversation with in-game voice chat.
                </div>

                {declinedNotice && (
                  <div style={{ fontSize: '0.78rem', color: '#f87171' }}>
                    {partnerName} declined or is busy. You can invite again or play casual bot.
                  </div>
                )}

                {inviteSent ? (
                  <div
                    style={{
                      padding: '10px',
                      background: 'rgba(245, 158, 11, 0.15)',
                      borderRadius: '12px',
                      border: '1px dashed #f59e0b',
                      fontSize: '0.82rem',
                      color: '#fcd34d',
                      textAlign: 'center'
                    }}
                  >
                    Invitation sent! Waiting for {partnerName} to accept...
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={sendFriendInvite}
                    style={{
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '10px 16px',
                      color: '#000',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <Swords size={16} /> Send Chess Challenge
                  </button>
                )}
              </div>

              {/* Casual Bot Play inside Chat option */}
              <div
                style={{
                  padding: '16px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: '18px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
                  <Bot size={18} color="#38bdf8" />
                  <span>Practice vs Casual Bot</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                  Warm up or play a fast casual game without affecting leaderboard scores.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setGameMode('casual_ai');
                    const reset = createChessInstance();
                    setChessInstance(reset);
                    syncFromFen(reset.fen());
                    setMoveHistory([]);
                    setActiveMatch({ matchId: 'casual_bot', whitePlayer: { name: 'You' }, blackPlayer: { name: 'Practice Bot' } });
                  }}
                  style={{
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    borderRadius: '12px',
                    padding: '8px 16px',
                    color: '#38bdf8',
                    fontWeight: 800,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Bot size={16} /> Practice Against Bot
                </button>
              </div>
            </div>
          )}

          {/* Active Chessboard View */}
          {activeMatch && (
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
                color: myColor
              }}
              opponentPlayer={{
                name: gameMode === 'friend' ? partnerName : 'Practice Bot',
                avatar: gameMode === 'friend' ? partnerAvatar : '',
                color: myColor === 'w' ? 'b' : 'w',
                isOnline: true
              }}
              onSquareClick={handleSquareClick}
              onPromotionSelect={handlePromotionSelect}
              pendingPromotion={pendingPromotion}
              onResign={handleResign}
              onOfferDraw={handleOfferDraw}
              drawOfferedByOpponent={drawOfferedByOpponent}
              onAcceptDraw={handleAcceptDraw}
              onDeclineDraw={handleDeclineDraw}
              onRematch={handleRematch}
              onBack={() => {
                setActiveMatch(null);
                setGameMode('friend');
              }}
              gameMode={gameMode === 'friend' ? 'friend' : 'ai'}
              chatId={chatId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
