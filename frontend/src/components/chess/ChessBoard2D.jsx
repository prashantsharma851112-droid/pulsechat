/**
 * ChessBoard2D.jsx
 * Responsive Vector 2D Chessboard with Move Highlights,
 * Selection Rings, Check Warnings, and Smooth Touch/Click Controls.
 * Serves as both an instant toggle option and graceful low-spec fallback.
 */

import React, { useMemo } from 'react';

// Standard Chess Vector Piece Icons (SVG)
export const CHESS_PIECE_SVGS = {
  // White Pieces (Ivory with subtle golden/slate trim)
  wp: (
    <svg viewBox="0 0 45 45" width="100%" height="100%">
      <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#f8fafc" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  wn: (
    <svg viewBox="0 0 45 45" width="100%" height="100%">
      <path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill="#f8fafc" stroke="#334155" strokeWidth="1.5" />
      <path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3" fill="#f8fafc" stroke="#334155" strokeWidth="1.5" />
      <circle cx="16" cy="15" r="1.2" fill="#334155" />
    </svg>
  ),
  wb: (
    <svg viewBox="0 0 45 45" width="100%" height="100%">
      <g fill="#f8fafc" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2zM15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2zM25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z" />
        <path d="M17.5 26h10M22.5 21v10M20 15h5" />
      </g>
    </svg>
  ),
  wr: (
    <svg viewBox="0 0 45 45" width="100%" height="100%">
      <g fill="#f8fafc" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5" />
        <path d="M34 14l-3 3H14l-3-3" />
        <path d="M31 17v12.5H14V17" />
        <path d="M31 29.5l1.5 2.5h-20l1.5-2.5" />
        <path d="M11 14h23" />
      </g>
    </svg>
  ),
  wq: (
    <svg viewBox="0 0 45 45" width="100%" height="100%">
      <g fill="#f8fafc" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM24.5 7.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM41 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM16 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM33 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0z" />
        <path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-14V25L7 14l2 12z" />
        <path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 2-1 .5-2.5 0 0 0-1.5-1.5-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" />
        <path d="M11 38.5h23" />
      </g>
    </svg>
  ),
  wk: (
    <svg viewBox="0 0 45 45" width="100%" height="100%">
      <g fill="#f8fafc" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22.5 11.63V6M20 8h5" strokeLinejoin="miter" />
        <path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" />
        <path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V23v-1.5C19 14 9.5 11 5.5 17.5c-3 6 6 10.5 6 10.5v9z" />
        <path d="M11.5 30c5.5-3 15.5-3 21 0M11.5 33.5c5.5-3 15.5-3 21 0M11.5 37c5.5-3 15.5-3 21 0" />
      </g>
    </svg>
  ),

  // Black Pieces (Obsidian with dark borders)
  bp: (
    <svg viewBox="0 0 45 45" width="100%" height="100%">
      <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#1e293b" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  bn: (
    <svg viewBox="0 0 45 45" width="100%" height="100%">
      <path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill="#1e293b" stroke="#e2e8f0" strokeWidth="1.5" />
      <path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3" fill="#1e293b" stroke="#e2e8f0" strokeWidth="1.5" />
      <circle cx="16" cy="15" r="1.2" fill="#e2e8f0" />
    </svg>
  ),
  bb: (
    <svg viewBox="0 0 45 45" width="100%" height="100%">
      <g fill="#1e293b" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2zM15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2zM25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z" />
        <path d="M17.5 26h10M22.5 21v10M20 15h5" stroke="#e2e8f0" />
      </g>
    </svg>
  ),
  br: (
    <svg viewBox="0 0 45 45" width="100%" height="100%">
      <g fill="#1e293b" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5" />
        <path d="M34 14l-3 3H14l-3-3" />
        <path d="M31 17v12.5H14V17" />
        <path d="M31 29.5l1.5 2.5h-20l1.5-2.5" />
        <path d="M11 14h23" stroke="#e2e8f0" />
      </g>
    </svg>
  ),
  bq: (
    <svg viewBox="0 0 45 45" width="100%" height="100%">
      <g fill="#1e293b" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM24.5 7.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM41 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM16 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM33 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0z" />
        <path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-14V25L7 14l2 12z" />
        <path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 2-1 .5-2.5 0 0 0-1.5-1.5-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" />
        <path d="M11 38.5h23" stroke="#e2e8f0" />
      </g>
    </svg>
  ),
  bk: (
    <svg viewBox="0 0 45 45" width="100%" height="100%">
      <g fill="#1e293b" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22.5 11.63V6M20 8h5" strokeLinejoin="miter" stroke="#e2e8f0" />
        <path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" />
        <path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V23v-1.5C19 14 9.5 11 5.5 17.5c-3 6 6 10.5 6 10.5v9z" />
        <path d="M11.5 30c5.5-3 15.5-3 21 0M11.5 33.5c5.5-3 15.5-3 21 0M11.5 37c5.5-3 15.5-3 21 0" stroke="#e2e8f0" />
      </g>
    </svg>
  )
};

export default function ChessBoard2D({
  boardGrid,
  selectedSquare,
  legalMoves = [],
  lastMove = null,
  inCheckSquare = null,
  isFlipped = false, // false: White at bottom; true: Black at bottom
  onSquareClick,
  disabled = false
}) {
  // Destination squares for legal moves from selected piece
  const legalDestinations = useMemo(() => {
    const map = new Map();
    legalMoves.forEach(m => {
      map.set(m.to, m);
    });
    return map;
  }, [legalMoves]);

  // Coordinates array based on orientation
  const files = useMemo(() => {
    const arr = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    return isFlipped ? arr.slice().reverse() : arr;
  }, [isFlipped]);

  const ranks = useMemo(() => {
    const arr = [8, 7, 6, 5, 4, 3, 2, 1];
    return isFlipped ? arr.slice().reverse() : arr;
  }, [isFlipped]);

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '520px',
        aspectRatio: '1 / 1',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
        border: '3px solid rgba(255, 255, 255, 0.12)',
        background: '#1e293b'
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gridTemplateRows: 'repeat(8, 1fr)',
          width: '100%',
          height: '100%'
        }}
      >
        {ranks.map((rank, rankIdx) => {
          return files.map((file, fileIdx) => {
            const square = `${file}${rank}`;
            const fileNum = file.charCodeAt(0) - 'a'.charCodeAt(0);
            const rankNum = rank;
            const isLight = (fileNum + rankNum) % 2 !== 0;

            // Piece on this square
            const actualRankIdx = 8 - rank;
            const piece = boardGrid && boardGrid[actualRankIdx] ? boardGrid[actualRankIdx][fileNum] : null;
            const pieceKey = piece ? `${piece.color}${piece.type}` : null;

            const isSelected = selectedSquare === square;
            const isLegalDest = legalDestinations.has(square);
            const destMove = legalDestinations.get(square);
            const isCapture = Boolean(destMove && (destMove.captured || (piece && isLegalDest)));
            const isLastMove = lastMove && (lastMove.from === square || lastMove.to === square);
            const isCheckSquare = inCheckSquare === square;

            // Tile background coloring
            let tileBg = isLight ? '#ebecd0' : '#739552';
            if (isLastMove) {
              tileBg = isLight ? '#f5f682' : '#baca44';
            }
            if (isSelected) {
              tileBg = '#facc15';
            }

            return (
              <div
                key={square}
                onClick={() => !disabled && onSquareClick && onSquareClick(square)}
                style={{
                  position: 'relative',
                  background: tileBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: disabled ? 'default' : (piece || isLegalDest ? 'pointer' : 'default'),
                  transition: 'background-color 0.15s ease'
                }}
              >
                {/* Coordinates Label */}
                {fileIdx === 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '2px',
                      left: '3px',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      color: isLight ? '#739552' : '#ebecd0',
                      pointerEvents: 'none'
                    }}
                  >
                    {rank}
                  </span>
                )}
                {rankIdx === 7 && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '1px',
                      right: '3px',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      color: isLight ? '#739552' : '#ebecd0',
                      pointerEvents: 'none'
                    }}
                  >
                    {file}
                  </span>
                )}

                {/* Check Warning Aura on King */}
                {isCheckSquare && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'radial-gradient(circle, rgba(239, 68, 68, 0.85) 0%, rgba(220, 38, 38, 0.2) 75%, transparent 100%)',
                      pointerEvents: 'none',
                      animation: 'pulseCheck 1.2s infinite ease-in-out'
                    }}
                  />
                )}

                {/* Piece SVG */}
                {pieceKey && CHESS_PIECE_SVGS[pieceKey] && (
                  <div
                    style={{
                      width: '84%',
                      height: '84%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 2,
                      transform: isSelected ? 'scale(1.12)' : 'scale(1)',
                      transition: 'transform 0.12s cubic-bezier(0.2, 0, 0, 1)',
                      filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.28))'
                    }}
                  >
                    {CHESS_PIECE_SVGS[pieceKey]}
                  </div>
                )}

                {/* Legal Move Marker */}
                {isLegalDest && !isCapture && (
                  <div
                    style={{
                      position: 'absolute',
                      width: '28%',
                      height: '28%',
                      borderRadius: '50%',
                      background: 'rgba(0, 0, 0, 0.24)',
                      zIndex: 3,
                      pointerEvents: 'none'
                    }}
                  />
                )}

                {/* Legal Capture Target Ring */}
                {isLegalDest && isCapture && (
                  <div
                    style={{
                      position: 'absolute',
                      width: '85%',
                      height: '85%',
                      borderRadius: '50%',
                      border: '4px solid rgba(239, 68, 68, 0.65)',
                      boxSizing: 'border-box',
                      zIndex: 3,
                      pointerEvents: 'none'
                    }}
                  />
                )}
              </div>
            );
          });
        })}
      </div>
      <style>{`
        @keyframes pulseCheck {
          0%, 100% { opacity: 0.85; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.96); }
        }
      `}</style>
    </div>
  );
}
