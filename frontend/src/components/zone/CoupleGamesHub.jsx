import React, { useState, useEffect } from 'react';
import { Heart, Sparkles, ShieldCheck, Play, Users, Compass, Flame, Key, Radio } from 'lucide-react';
import CoupleIsland3DGame from './CoupleIsland3DGame';
import CoupleMazeQuestGame from './CoupleMazeQuestGame';
import CoupleDeepHeartsGame from './CoupleDeepHeartsGame';

export default function CoupleGamesHub({ onGameActiveChange }) {
  const [selectedGame, setSelectedGame] = useState(null); // 'island' | 'maze' | 'hearts'
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [role, setRole] = useState('host');

  // Notify parent modal of active game status for edge-to-edge mobile fullscreen
  useEffect(() => {
    if (onGameActiveChange) {
      onGameActiveChange(Boolean(selectedGame));
    }
  }, [selectedGame, onGameActiveChange]);

  // Handle auto-join from URL deep links (?coupleRoom=CODE)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.__pendingCoupleRoomCode) {
      const code = String(window.__pendingCoupleRoomCode).trim().toUpperCase();
      window.__pendingCoupleRoomCode = null;
      if (code) {
        if (code.startsWith('MAZE')) {
          launchGame('maze', 'partner', code);
        } else if (code.startsWith('HEART')) {
          launchGame('hearts', 'partner', code);
        } else {
          launchGame('island', 'partner', code);
        }
      }
    }
  }, []);

  const launchGame = (gameId, asRole = 'host', customCode = '') => {
    // Trigger automatic fullscreen & landscape lock on user touch gesture
    try {
      if (typeof document !== 'undefined' && !document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      if (typeof screen !== 'undefined' && screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    } catch (_) {}

    setSelectedGame(gameId);
    setRole(asRole);
    if (customCode) {
      setRoomCode(customCode);
    } else {
      setRoomCode('LOVE-' + Math.floor(1000 + Math.random() * 9000));
    }
  };

  const handleJoinWithCode = () => {
    if (!inputCode.trim()) return;
    const cleanCode = inputCode.trim().toUpperCase();
    if (cleanCode.startsWith('MAZE')) {
      launchGame('maze', 'partner', cleanCode);
    } else if (cleanCode.startsWith('HEART')) {
      launchGame('hearts', 'partner', cleanCode);
    } else {
      launchGame('island', 'partner', cleanCode);
    }
  };

  if (selectedGame === 'island') {
    return (
      <CoupleIsland3DGame
        roomCode={roomCode}
        role={role}
        onBack={() => setSelectedGame(null)}
      />
    );
  }

  if (selectedGame === 'maze') {
    return (
      <CoupleMazeQuestGame
        roomCode={roomCode}
        role={role}
        onBack={() => setSelectedGame(null)}
      />
    );
  }

  if (selectedGame === 'hearts') {
    return (
      <CoupleDeepHeartsGame
        roomCode={roomCode}
        role={role}
        onBack={() => setSelectedGame(null)}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Romantic Couples Zone Hero Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.22) 0%, rgba(168, 85, 247, 0.18) 50%, rgba(56, 189, 248, 0.15) 100%)',
        border: '1.5px solid rgba(244, 63, 94, 0.45)',
        borderRadius: '20px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: '0 8px 25px rgba(244, 63, 94, 0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '13px',
              background: 'linear-gradient(135deg, #f43f5e, #ec4899)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(244, 63, 94, 0.5)'
            }}>
              <Heart size={22} color="#fff" fill="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Couples Adventure Zone <span style={{ color: '#f43f5e' }}>💖</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#fbcfe8', fontWeight: 600 }}>
                Explore, hold hands & talk live with Free Fire Mic
              </div>
            </div>
          </div>
          <span style={{
            fontSize: '0.68rem',
            fontWeight: 900,
            color: '#10b981',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            padding: '3px 8px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <ShieldCheck size={12} /> 100% Ephemeral
          </span>
        </div>

        {/* Quick Join Partner's Room Bar */}
        <div style={{
          display: 'flex',
          gap: '8px',
          background: 'rgba(0,0,0,0.3)',
          padding: '6px',
          borderRadius: '14px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <input
            type="text"
            placeholder="Enter Partner's Room Code (e.g. LOVE-1234)..."
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.toUpperCase())}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              padding: '6px 10px',
              color: '#fff',
              fontSize: '0.82rem',
              fontWeight: 700
            }}
          />
          <button
            onClick={handleJoinWithCode}
            disabled={!inputCode.trim()}
            style={{
              background: inputCode.trim() ? 'linear-gradient(135deg, #f43f5e, #be185d)' : 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#fff',
              borderRadius: '10px',
              padding: '6px 16px',
              fontWeight: 900,
              fontSize: '0.8rem',
              cursor: inputCode.trim() ? 'pointer' : 'default',
              transition: 'all 0.2s ease'
            }}
          >
            Join Room
          </button>
        </div>
      </div>

      {/* Couple Game Launcher Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Game 1: 3D Couple Island Adventure */}
        <div
          onClick={() => launchGame('island')}
          className="interactive-tap cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.18) 0%, rgba(244, 63, 94, 0.15) 100%)',
            border: '1.5px solid rgba(56, 189, 248, 0.5)',
            borderRadius: '18px',
            padding: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            boxShadow: '0 6px 20px rgba(56, 189, 248, 0.15)',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
              flexShrink: 0
            }}>
              🏝️
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '0.96rem', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Couple Island Adventure 3D
                <span style={{ fontSize: '0.62rem', background: '#38bdf8', color: '#0f172a', padding: '1px 6px', borderRadius: '6px', fontWeight: 900 }}>REAL 3D</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#cbd5e1', marginTop: '2px', lineHeight: 1.3 }}>
                Co-op 3D tropical island! Walk together, hold hands, collect love crystals & chat via Free Fire Mic.
              </div>
            </div>
          </div>
          <button
            style={{
              background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
              border: 'none',
              borderRadius: '12px',
              padding: '8px 16px',
              color: '#fff',
              fontWeight: 900,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)'
            }}
          >
            <Play size={14} fill="#fff" /> PLAY
          </button>
        </div>

        {/* Game 2: Mystic Maze Quest */}
        <div
          onClick={() => launchGame('maze')}
          className="interactive-tap cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.18) 0%, rgba(236, 72, 153, 0.15) 100%)',
            border: '1.5px solid rgba(99, 102, 241, 0.5)',
            borderRadius: '18px',
            padding: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            boxShadow: '0 6px 20px rgba(99, 102, 241, 0.15)',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
              flexShrink: 0
            }}>
              🏰
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '0.96rem', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Escape the Mystic Maze
                <span style={{ fontSize: '0.62rem', background: '#a855f7', color: '#fff', padding: '1px 6px', borderRadius: '6px', fontWeight: 900 }}>CO-OP</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#cbd5e1', marginTop: '2px', lineHeight: 1.3 }}>
                You start separated! Find each other in the mystical labyrinth, collect golden keys & meet at the Sanctuary.
              </div>
            </div>
          </div>
          <button
            style={{
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              border: 'none',
              borderRadius: '12px',
              padding: '8px 16px',
              color: '#fff',
              fontWeight: 900,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
            }}
          >
            <Play size={14} fill="#fff" /> PLAY
          </button>
        </div>

        {/* Game 3: Deep Hearts Journey */}
        <div
          onClick={() => launchGame('hearts')}
          className="interactive-tap cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.18) 0%, rgba(251, 191, 36, 0.12) 100%)',
            border: '1.5px solid rgba(244, 63, 94, 0.5)',
            borderRadius: '18px',
            padding: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            boxShadow: '0 6px 20px rgba(244, 63, 94, 0.15)',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #f43f5e, #fbbf24)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              boxShadow: '0 4px 14px rgba(244, 63, 94, 0.4)',
              flexShrink: 0
            }}>
              💌
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '0.96rem', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Deep Hearts: Romantic Cards
                <span style={{ fontSize: '0.62rem', background: '#f43f5e', color: '#fff', padding: '1px 6px', borderRadius: '6px', fontWeight: 900 }}>INTIMACY</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#cbd5e1', marginTop: '2px', lineHeight: 1.3 }}>
                4 interactive romantic card decks: First Spark, Deep Soul, Wild Adventure & Spicy Secrets.
              </div>
            </div>
          </div>
          <button
            style={{
              background: 'linear-gradient(135deg, #f43f5e, #fbbf24)',
              border: 'none',
              borderRadius: '12px',
              padding: '8px 16px',
              color: '#fff',
              fontWeight: 900,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(244, 63, 94, 0.4)'
            }}
          >
            <Play size={14} fill="#fff" /> PLAY
          </button>
        </div>
      </div>

      {/* Safety Guarantee Footnote */}
      <div style={{
        marginTop: '6px',
        padding: '10px 14px',
        borderRadius: '14px',
        background: 'rgba(0,0,0,0.25)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '0.7rem',
        color: '#94a3b8'
      }}>
        <ShieldCheck size={16} color="#10b981" style={{ flexShrink: 0 }} />
        <span>
          <b>Zero Permanent Database Footprint:</b> All couple rooms, voice chats, and quest interactions run strictly in ephemeral memory and are never saved to MongoDB.
        </span>
      </div>
    </div>
  );
}
