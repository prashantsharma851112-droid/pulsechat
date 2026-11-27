import React, { useState, useEffect, useRef, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { playSound } from '../../utils/audio';
import GameVoiceChat from '../chat/GameVoiceChat';
import {
  ArrowLeft,
  Heart,
  Sparkles,
  Flame,
  ShieldCheck,
  RotateCw,
  Copy,
  Check,
  Smile,
  Compass,
  Award
} from 'lucide-react';

const DECKS = {
  spark: {
    title: 'First Spark',
    icon: '✨',
    color: '#38bdf8',
    gradient: 'linear-gradient(135deg, #0284c7, #38bdf8)',
    cards: [
      "What was your very first thought when you saw me?",
      "What is your favorite memory of us from our early days?",
      "If we could relive one single day together, which one would it be?",
      "What small quirk of mine secretly makes you smile the most?",
      "What was the moment you realized I was truly special to you?"
    ]
  },
  deep: {
    title: 'Deep Soul',
    icon: '💖',
    color: '#ec4899',
    gradient: 'linear-gradient(135deg, #be185d, #ec4899)',
    cards: [
      "What is something you've never told anyone else, but feel safe telling me?",
      "When do you feel most loved and appreciated by me?",
      "What is a dream for our future that excites you the most?",
      "How have I helped you grow into a better person?",
      "What does true happiness look like for us five years from now?"
    ]
  },
  adventure: {
    title: 'Wild Adventure',
    icon: '🌴',
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #059669, #10b981)',
    cards: [
      "If we packed our bags right now with no budget limit, where are we flying?",
      "Dare: Imitate how I act when I'm hungry or excited for 30 seconds!",
      "What is the wildest or most adventurous thing we should do together?",
      "If we were trapped on a deserted island together, who survives longer?",
      "Dare: Whisper your favorite romantic nickname for me over the mic!"
    ]
  },
  spicy: {
    title: 'Spicy Secrets',
    icon: '🔥',
    color: '#f43f5e',
    gradient: 'linear-gradient(135deg, #e11d48, #f43f5e)',
    cards: [
      "What is your favorite romantic physical gesture I do to you?",
      "What was our most unforgettable kiss, and why?",
      "What is one romantic fantasy you want us to experience together?",
      "What song instantly puts you in a romantic mood with me?",
      "Dare: Give your partner a sweet compliment that makes them blush!"
    ]
  }
};

export default function CoupleDeepHeartsGame({
  roomCode: initialRoomCode = null,
  role: initialRole = 'host',
  partnerData: initialPartner = null,
  onBack
}) {
  const { user } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);

  const [roomCode, setRoomCode] = useState(initialRoomCode || '');
  const [role, setRole] = useState(initialRole || 'host');
  const [partner, setPartner] = useState(initialPartner || null);
  const [copiedCode, setCopiedCode] = useState(false);

  const [activeCategory, setActiveCategory] = useState('spark');
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [syncCount, setSyncCount] = useState(0);

  // Lifecycle
  useEffect(() => {
    if (!socket) return;

    if (!roomCode && initialRole === 'host') {
      const code = 'HEART-' + Math.floor(1000 + Math.random() * 9000);
      socket.emit('couple_room_create', {
        roomCode: code,
        gameType: 'deep_hearts',
        user: {
          id: user?.id || user?._id || 'host',
          name: user?.displayName || user?.username || 'Partner 1',
          avatar: user?.avatar || '',
          color: '#ec4899'
        }
      }, (res) => {
        if (res && res.success) {
          setRoomCode(res.roomCode);
          setRole('host');
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

    const handleActionReceived = ({ actionType, payload }) => {
      if (actionType === 'card_change') {
        setActiveCategory(payload.category);
        setCardIndex(payload.index);
        setIsFlipped(payload.flipped);
        playSound('pop');
      } else if (actionType === 'card_flip') {
        setIsFlipped(payload.flipped);
        playSound('pop');
      }
    };

    const handlePartnerLeft = () => setPartner(null);

    socket.on('couple_room_ready', handleRoomReady);
    socket.on('couple_action_received', handleActionReceived);
    socket.on('couple_partner_left', handlePartnerLeft);

    return () => {
      socket.off('couple_room_ready', handleRoomReady);
      socket.off('couple_action_received', handleActionReceived);
      socket.off('couple_partner_left', handlePartnerLeft);
      if (roomCode) socket.emit('couple_room_leave', { roomCode });
    };
  }, [socket, user, roomCode, role, initialRole]);

  const selectDeck = (deckKey) => {
    setActiveCategory(deckKey);
    setCardIndex(0);
    setIsFlipped(false);
    playSound('pop');
    if (socket && roomCode) {
      socket.emit('couple_action_sync', {
        roomCode,
        actionType: 'card_change',
        payload: { category: deckKey, index: 0, flipped: false }
      });
    }
  };

  const nextCard = () => {
    const deck = DECKS[activeCategory].cards;
    const nextIdx = (cardIndex + 1) % deck.length;
    setCardIndex(nextIdx);
    setIsFlipped(false);
    playSound('pop');
    if (socket && roomCode) {
      socket.emit('couple_action_sync', {
        roomCode,
        actionType: 'card_change',
        payload: { category: activeCategory, index: nextIdx, flipped: false }
      });
    }
  };

  const toggleFlip = () => {
    const next = !isFlipped;
    setIsFlipped(next);
    playSound('pop');
    if (socket && roomCode) {
      socket.emit('couple_action_sync', {
        roomCode,
        actionType: 'card_flip',
        payload: { flipped: next }
      });
    }
  };

  const copyRoomCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    playSound('pop');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const currentDeck = DECKS[activeCategory];
  const currentQuestion = currentDeck.cards[cardIndex];

  return (
    <div style={{
      width: '100%',
      height: '100%',
      minHeight: '520px',
      position: 'relative',
      background: 'linear-gradient(135deg, #090d16 0%, #1e112a 100%)',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
            <button
              onClick={copyRoomCode}
              style={{
                background: 'rgba(244, 63, 94, 0.2)',
                border: '1px solid rgba(244, 63, 94, 0.5)',
                color: '#fbcfe8',
                borderRadius: '10px',
                padding: '6px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                fontWeight: 900
              }}
            >
              <Heart size={13} color="#f43f5e" fill="#f43f5e" />
              {roomCode}
              {copiedCode ? <Check size={13} color="#34d399" /> : <Copy size={12} />}
            </button>
          )}
        </div>

        {/* Free Fire Style Voice Chat HUD */}
        <div>
          {roomCode && (
            <GameVoiceChat
              chatId={`couple_${roomCode}`}
              partnerName={partner?.name || (role === 'host' ? 'Partner 2' : 'Partner 1')}
              partnerId={partner?.id || null}
              compact={true}
            />
          )}
        </div>
      </div>

      {/* 4 Deck Category Tabs */}
      <div style={{
        padding: '10px 14px',
        display: 'flex',
        gap: '6px',
        overflowX: 'auto',
        background: 'rgba(0,0,0,0.2)'
      }}>
        {Object.entries(DECKS).map(([k, d]) => (
          <button
            key={k}
            onClick={() => selectDeck(k)}
            style={{
              flex: 1,
              minWidth: '90px',
              padding: '8px 10px',
              borderRadius: '12px',
              border: activeCategory === k ? `1.5px solid ${d.color}` : '1px solid rgba(255, 255, 255, 0.1)',
              background: activeCategory === k ? d.gradient : 'rgba(255, 255, 255, 0.05)',
              color: '#fff',
              fontWeight: 800,
              fontSize: '0.75rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              boxShadow: activeCategory === k ? `0 4px 14px ${d.color}40` : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <span>{d.icon}</span>
            <span>{d.title}</span>
          </button>
        ))}
      </div>

      {/* Main Interactive Card */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}>
        <div
          onClick={toggleFlip}
          style={{
            width: '100%',
            maxWidth: '380px',
            minHeight: '220px',
            borderRadius: '24px',
            background: isFlipped
              ? currentDeck.gradient
              : 'linear-gradient(145deg, rgba(30, 27, 75, 0.95), rgba(15, 23, 42, 0.95))',
            border: `2px solid ${isFlipped ? '#fff' : currentDeck.color}`,
            boxShadow: `0 15px 40px rgba(0,0,0,0.7), 0 0 25px ${currentDeck.color}35`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            cursor: 'pointer',
            textAlign: 'center',
            position: 'relative',
            transform: 'translateZ(0)',
            transition: 'transform 0.25s ease, background 0.3s ease'
          }}
        >
          <div style={{ position: 'absolute', top: '14px', left: '16px', fontSize: '0.72rem', fontWeight: 800, color: '#fbcfe8' }}>
            Card {cardIndex + 1}/{currentDeck.cards.length}
          </div>
          <div style={{ position: 'absolute', top: '14px', right: '16px', fontSize: '1.2rem' }}>
            {currentDeck.icon}
          </div>

          {!isFlipped ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ fontSize: '2.5rem' }}>💌</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>
                Tap to Reveal
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                Ask your partner over mic
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', lineHeight: 1.45 }}>
              "{currentQuestion}"
            </div>
          )}
        </div>

        {/* Next Card Button */}
        <button
          onClick={nextCard}
          style={{
            marginTop: '20px',
            background: 'linear-gradient(135deg, #f43f5e, #be185d)',
            border: 'none',
            color: '#fff',
            borderRadius: '14px',
            padding: '12px 28px',
            fontWeight: 900,
            fontSize: '0.88rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 18px rgba(244, 63, 94, 0.4)'
          }}
        >
          <RotateCw size={16} /> Next Question
        </button>

        <div style={{ marginTop: '12px', fontSize: '0.68rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <ShieldCheck size={12} color="#10b981" /> 100% Ephemeral & Private (Zero DB Storage)
        </div>
      </div>
    </div>
  );
}
