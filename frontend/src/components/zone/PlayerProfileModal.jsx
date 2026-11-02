import React, { useState, useEffect, useContext, useCallback } from 'react';
import { 
  X, Trophy, Flame, Award, Gamepad2, Sparkles, 
  Target, Zap, Swords, Loader2, Calendar, User, Compass, RefreshCw, ArrowLeft
} from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';
import { AuthContext } from '../../context/AuthContext';
import { useBackHandler } from '../../utils/backNavigation';

export default function PlayerProfileModal({ userId, onClose, onBack, token }) {
  const handleBack = onBack || onClose;

  // Integrate hardware back / popstate dismissal
  useBackHandler(handleBack, true);

  const authCtx = useContext(AuthContext);
  const authToken = token || authCtx?.token;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);

  // Keyboard accessibility: ESC key dismiss to leaderboard
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleBack();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleBack]);

  const fetchProfile = useCallback(async (signal) => {
    if (!userId) {
      setError('Player not found');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/zone/profile/${encodeURIComponent(userId)}`, {
        signal,
        headers: {
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        }
      });

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Player profile not found');
        } else if (res.status === 401) {
          throw new Error('Authentication required');
        } else {
          throw new Error('Failed to load profile');
        }
      }

      const data = await res.json();
      if (data && data.player) {
        setProfile(data.player);
      } else {
        setError('Player data unavailable');
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Error connecting to server');
    } finally {
      setLoading(false);
    }
  }, [userId, authToken]);

  // Fetch when userId or token changes with request cancellation
  useEffect(() => {
    setProfile(null);
    const controller = new AbortController();
    fetchProfile(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchProfile]);

  const joinDate = profile?.memberSince
    ? new Date(profile.memberSince).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : 'Veteran Gamer';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Player Gaming Profile"
      className="player-profile-view animate-fadeIn"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box'
      }}
    >
      {/* Navigation Top Bar */}
      <div className="player-profile-nav">
        <button
          type="button"
          onClick={handleBack}
          className="player-profile-back-btn"
          aria-label="Back to Leaderboard"
        >
          <ArrowLeft size={16} />
          <span>Back to Leaderboard</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="player-profile-pill">Player Profile</span>
          <button
            type="button"
            onClick={onClose}
            className="icon-btn-ghost"
            style={{
              color: 'var(--text-muted, #94a3b8)',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            aria-label="Close Profile"
            title="Close Profile"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <Loader2 className="animate-spin" size={32} color="#818cf8" />
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 600 }}>
            Loading player records & verified statistics...
          </p>
        </div>
      ) : error || !profile ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '18px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}>
            <X size={22} />
          </div>
          <div>
            <p style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f1f5f9' }}>{error || 'Unable to display profile'}</p>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', marginTop: '4px' }}>Please check your network and try again.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={() => fetchProfile()}
              className="btn-primary"
              style={{ padding: '8px 16px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} /> Retry
            </button>
            <button
              type="button"
              onClick={handleBack}
              className="btn-secondary"
              style={{ padding: '8px 16px', fontSize: '0.8rem' }}
            >
              Back to Leaderboard
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Profile Hero Header Card */}
          <div className="player-profile-hero">
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '18px',
                overflow: 'hidden',
                background: '#1e293b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: (profile.hasKingCrown || profile.globalRank === 1)
                  ? '2.5px solid #fbbf24'
                  : (profile.hasSilverCrown || profile.globalRank === 2)
                  ? '2.5px solid #cbd5e1'
                  : '1.5px solid rgba(255, 255, 255, 0.15)',
                boxShadow: (profile.hasKingCrown || profile.globalRank === 1)
                  ? '0 0 16px rgba(251, 191, 36, 0.4)'
                  : (profile.hasSilverCrown || profile.globalRank === 2)
                  ? '0 0 16px rgba(203, 213, 225, 0.35)'
                  : 'none'
              }}>
                <img
                  src={profile.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(profile.displayName || profile.username || 'P')}`}
                  alt={profile.displayName || profile.username}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    e.currentTarget.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(profile.username || 'P')}`;
                  }}
                />
              </div>

              {/* Floating Rank Crown / Badge */}
              {profile.hasKingCrown || profile.globalRank === 1 ? (
                <div
                  style={{
                    position: 'absolute',
                    top: '-10px',
                    right: '-8px',
                    background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                    color: '#000',
                    fontSize: '0.72rem',
                    fontWeight: 900,
                    padding: '2px 7px',
                    borderRadius: '20px',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                    border: '1.5px solid #fef08a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    zIndex: 2
                  }}
                  title="👑 #1 Gold Champion"
                >
                  👑 <span>#1</span>
                </div>
              ) : profile.hasSilverCrown || profile.globalRank === 2 ? (
                <div
                  style={{
                    position: 'absolute',
                    top: '-10px',
                    right: '-8px',
                    background: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)',
                    color: '#000',
                    fontSize: '0.72rem',
                    fontWeight: 900,
                    padding: '2px 7px',
                    borderRadius: '20px',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                    border: '1.5px solid #ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    zIndex: 2
                  }}
                  title="👑 #2 Silver Champion"
                >
                  🥈 <span>#2</span>
                </div>
              ) : profile.globalRank ? (
                <div
                  style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-6px',
                    background: 'rgba(30, 41, 59, 0.95)',
                    color: '#e2e8f0',
                    fontSize: '0.66rem',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    zIndex: 2
                  }}
                >
                  #{profile.globalRank}
                </div>
              ) : null}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{
                  margin: 0,
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%'
                }}>
                  {profile.displayName || profile.username}
                </h3>
                {profile.isPro && (
                  <span style={{
                    padding: '2px 7px',
                    borderRadius: '6px',
                    background: 'linear-gradient(135deg, #f59e0b, #eab308)',
                    color: '#000',
                    fontSize: '0.64rem',
                    fontWeight: 900,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    boxShadow: '0 2px 6px rgba(245, 158, 11, 0.3)'
                  }}>
                    PRO
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-400" style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                @{profile.username}
              </p>

              {profile.bio && (
                <p className="italic" style={{
                  margin: '6px 0 0 0',
                  fontSize: '0.78rem',
                  color: '#cbd5e1',
                  fontStyle: 'italic',
                  wordBreak: 'break-word',
                  overflowWrap: 'anywhere',
                  lineHeight: '1.35',
                  maxHeight: '3.8em',
                  overflow: 'hidden'
                }}>
                  "{profile.bio}"
                </p>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={12} color="#818cf8" /> Joined {joinDate}
                </span>
                {profile.gamingStreakCount > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#fb923c', fontWeight: 700 }}>
                    <Flame size={12} color="#f97316" /> {profile.gamingStreakCount}d Streak
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Core Global Stats Grid */}
          <div className="player-profile-stats-grid">
            <div className="player-profile-stat-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b', marginBottom: '2px' }}>
                <Trophy size={14} />
                <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rank</span>
              </div>
              <div className="text-lg font-black text-white" style={{ fontSize: '1.15rem', fontWeight: 900, color: '#ffffff' }}>
                {profile.globalRank ? `#${profile.globalRank}` : '—'}
              </div>
              <span style={{ fontSize: '0.64rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 600, marginTop: '2px' }}>
                {profile.globalRank === 1 ? '👑 Champion' : profile.globalRank === 2 ? '🥈 Silver' : 'Global'}
              </span>
            </div>

            <div className="player-profile-stat-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#818cf8', marginBottom: '2px' }}>
                <Sparkles size={14} />
                <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Points</span>
              </div>
              <div className="text-lg font-black text-indigo-300" style={{ fontSize: '1.15rem', fontWeight: 900, color: '#a5b4fc' }}>
                {Number(profile.totalScore || 0).toLocaleString()}
              </div>
              <span style={{ fontSize: '0.64rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 600, marginTop: '2px' }}>
                Verified
              </span>
            </div>

            <div className="player-profile-stat-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#34d399', marginBottom: '2px' }}>
                <Gamepad2 size={14} />
                <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Matches</span>
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#6ee7b7' }}>
                {Number(profile.gamesPlayed || 0).toLocaleString()}
              </div>
              <span style={{ fontSize: '0.64rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 600, marginTop: '2px' }}>
                Total Plays
              </span>
            </div>

            <div className="player-profile-stat-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fb923c', marginBottom: '2px' }}>
                <Flame size={14} />
                <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Streak</span>
              </div>
              <div className="text-lg font-black text-orange-300" style={{ fontSize: '1.15rem', fontWeight: 900, color: '#fdba74' }}>
                {profile.gamingStreakCount || 0}d
              </div>
              <span style={{ fontSize: '0.64rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 600, marginTop: '2px' }}>
                {profile.gamingStreakCount >= 7 ? '7-Day Quest' : 'Active'}
              </span>
            </div>
          </div>

          {/* Verified Game Records */}
          <div>
            <div className="player-profile-section-title">
              <Target size={14} color="#818cf8" />
              <span>Game Records & Best Scores</span>
            </div>

            <div className="player-profile-records-grid grid grid-cols-2">
              {/* Temple Run 3D */}
              <div className="player-profile-record-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '4px' }}>
                  <span>🗿 Temple Run 3D</span>
                  {profile.gameStats?.temple?.gamesPlayed ? (
                    <span style={{ fontSize: '0.64rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '1px 6px', borderRadius: '6px' }}>
                      {profile.gameStats.temple.gamesPlayed} runs
                    </span>
                  ) : null}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>Distance</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#34d399' }}>
                    {profile.gameStats?.temple?.bestDistance ? `${Number(profile.gameStats.temple.bestDistance).toLocaleString()}m` : '0m'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '2px' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748b)' }}>Coins / Best</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#fbbf24' }}>
                    {Number(profile.gameStats?.temple?.totalCoins || 0).toLocaleString()} 🪙 • {Number(profile.gameStats?.temple?.bestScore || 0).toLocaleString()} pts
                  </span>
                </div>
              </div>

              {/* Arrow Puzzle */}
              <div className="player-profile-record-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '4px' }}>
                  <span>🎯 Arrow Puzzle</span>
                  {profile.gameStats?.arrow?.gamesPlayed ? (
                    <span style={{ fontSize: '0.64rem', color: '#818cf8', background: 'rgba(99, 102, 241, 0.1)', padding: '1px 6px', borderRadius: '6px' }}>
                      {profile.gameStats.arrow.gamesPlayed} plays
                    </span>
                  ) : null}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>Max Level</span>
                  <span className="text-xs font-bold text-indigo-400" style={{ fontSize: '0.82rem', fontWeight: 800, color: '#818cf8' }}>
                    Lvl {profile.gameStats?.arrow?.maxLevel || profile.arrowLevel || 1}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '2px' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748b)' }}>High Score</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#c7d2fe' }}>
                    {Number(profile.gameStats?.arrow?.bestScore || 0).toLocaleString()} pts
                  </span>
                </div>
              </div>

              {/* Candy Crush */}
              <div className="player-profile-record-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '4px' }}>
                  <span>🍬 Candy Crush</span>
                  {profile.gameStats?.candy?.gamesPlayed ? (
                    <span style={{ fontSize: '0.64rem', color: '#f472b6', background: 'rgba(244, 114, 182, 0.1)', padding: '1px 6px', borderRadius: '6px' }}>
                      {profile.gameStats.candy.gamesPlayed} plays
                    </span>
                  ) : null}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>Level</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f472b6' }}>
                    Lvl {profile.gameStats?.candy?.maxLevel || 1}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '2px' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748b)' }}>Best Match</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#fbcfe8' }}>
                    {Number(profile.gameStats?.candy?.bestScore || 0).toLocaleString()} pts
                  </span>
                </div>
              </div>

              {/* Speed Tapper & AI TicTacToe */}
              <div className="player-profile-record-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '4px' }}>
                  <span>⚡ Tapper & ❌ AI</span>
                  {profile.gameStats?.tapper?.gamesPlayed ? (
                    <span style={{ fontSize: '0.64rem', color: '#facc15', background: 'rgba(250, 204, 21, 0.1)', padding: '1px 6px', borderRadius: '6px' }}>
                      {profile.gameStats.tapper.gamesPlayed} taps
                    </span>
                  ) : null}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>Speed Tap</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#facc15' }}>
                    {Number(profile.gameStats?.tapper?.bestScore || 0).toLocaleString()} pts
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '2px' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748b)' }}>AI Arena</span>
                  <span className="text-cyan-300" style={{ fontSize: '0.7rem', fontWeight: 700, color: '#67e8f9' }}>
                    {profile.gameStats?.tictactoe?.wins || 0}W - {profile.gameStats?.tictactoe?.losses || 0}L
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Achievements Showcase */}
          <div>
            <div className="player-profile-section-title">
              <Award size={14} color="#f59e0b" />
              <span>Unlocked Achievements ({profile.achievements?.length || 0})</span>
            </div>

            {profile.achievements && profile.achievements.length > 0 ? (
              <div className="player-profile-achievements-grid">
                {profile.achievements.map((ach) => (
                  <div key={ach.id} className="player-profile-achievement-card">
                    <span style={{ fontSize: '1.25rem', lineHeight: '1', flexShrink: 0 }}>
                      {ach.icon || '🏅'}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p className="text-amber-200" style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: '#fde68a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ach.title}
                      </p>
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)', lineHeight: '1.3' }}>
                        {ach.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '16px', borderRadius: '14px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted, #94a3b8)' }}>
                  No achievements unlocked yet. Play games to earn trophies!
                </p>
              </div>
            )}
          </div>

          {/* Footer Navigation Action */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', marginTop: '4px' }}>
            <button
              type="button"
              onClick={handleBack}
              className="player-profile-back-btn"
              style={{ fontSize: '0.78rem', padding: '6px 12px' }}
            >
              <ArrowLeft size={14} /> Back to Leaderboard
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-primary"
              style={{ fontSize: '0.78rem', padding: '6px 16px', borderRadius: '10px', cursor: 'pointer' }}
            >
              Done
            </button>
          </div>
        </>
      )}
    </div>
  );
}
