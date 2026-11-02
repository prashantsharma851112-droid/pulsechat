import React, { useState, useEffect } from 'react';
import { 
  X, Trophy, Flame, Award, Gamepad2, Sparkles, 
  ShieldCheck, Target, Zap, Swords, Loader2, Calendar, User, Compass
} from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';
import { useBackHandler } from '../../utils/backNavigation';

export default function PlayerProfileModal({ userId, onClose, token }) {
  useBackHandler(onClose, true);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchProfile() {
      if (!userId) {
        setError('Player not found');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`${BACKEND_URL}/api/zone/profile/${encodeURIComponent(userId)}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!res.ok) {
          throw new Error(res.status === 404 ? 'Player profile not found' : 'Failed to load profile');
        }

        const data = await res.json();
        if (isMounted) {
          if (data && data.player) {
            setProfile(data.player);
          } else {
            setError('Player data unavailable');
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Error connecting to server');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [userId, token]);

  const joinDate = profile?.memberSince
    ? new Date(profile.memberSince).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : 'Veteran Gamer';

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Player Gaming Profile"
    >
      <div
        className="relative w-full max-w-md max-h-[90vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-[#121622] text-white"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(99, 102, 241, 0.15)'
        }}
      >
        {/* Modal Header */}
        <div className="relative p-5 pb-4 flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900/60">
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-indigo-400" />
            <span className="text-sm font-bold uppercase tracking-wider text-indigo-300">Player Card</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 text-gray-300 hover:text-white transition-all cursor-pointer"
            aria-label="Close Profile"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-xs text-gray-400 font-medium">Loading player stats & records...</p>
            </div>
          ) : error || !profile ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <X className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-gray-200">{error || 'Unable to display profile'}</p>
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-gray-300 font-medium"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Profile Top Hero Card */}
              <div className="relative p-4 rounded-2xl bg-gradient-to-br from-indigo-900/30 via-slate-800/40 to-purple-900/20 border border-white/10 flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden ring-2 ring-indigo-500/30 bg-slate-800 flex items-center justify-center">
                    {profile.avatar ? (
                      <img
                        src={profile.avatar}
                        alt={profile.displayName || profile.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold text-xl">
                        {(profile.displayName || profile.username || 'P').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  {/* Floating Rank Crown / Badge */}
                  {profile.hasKingCrown ? (
                    <div className="absolute -top-2 -right-2 bg-amber-500 text-black text-xs font-black px-1.5 py-0.5 rounded-full shadow-lg flex items-center gap-0.5 border border-amber-300">
                      👑 <span>#1</span>
                    </div>
                  ) : profile.hasSilverCrown ? (
                    <div className="absolute -top-2 -right-2 bg-slate-300 text-black text-xs font-black px-1.5 py-0.5 rounded-full shadow-lg flex items-center gap-0.5 border border-white">
                      🥈 <span>#2</span>
                    </div>
                  ) : profile.globalRank ? (
                    <div className="absolute -top-2 -right-2 bg-slate-700 text-gray-200 text-[10px] font-black px-1.5 py-0.5 rounded-full shadow border border-slate-500">
                      #{profile.globalRank}
                    </div>
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-bold text-base text-white truncate">
                      {profile.displayName || profile.username}
                    </h3>
                    {profile.isPro && (
                      <span className="px-1.5 py-0.5 rounded bg-gradient-to-r from-amber-500 to-yellow-500 text-[10px] font-black uppercase text-black tracking-wide">
                        PRO
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">@{profile.username}</p>
                  
                  {profile.bio && (
                    <p className="text-xs text-gray-300 mt-1 line-clamp-2 italic">
                      "{profile.bio}"
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-indigo-400" /> Joined {joinDate}
                    </span>
                  </div>
                </div>
              </div>

              {/* Core Global Stats Row */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/5 flex flex-col items-center justify-center text-center">
                  <div className="flex items-center gap-1 text-amber-400 mb-1">
                    <Trophy className="w-4 h-4" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">Rank</span>
                  </div>
                  <div className="text-lg font-black text-white">
                    {profile.globalRank ? `#${profile.globalRank}` : '—'}
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium">Global</span>
                </div>

                <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/5 flex flex-col items-center justify-center text-center">
                  <div className="flex items-center gap-1 text-indigo-400 mb-1">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">Points</span>
                  </div>
                  <div className="text-lg font-black text-indigo-300">
                    {Number(profile.totalScore || 0).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium">Verified</span>
                </div>

                <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/5 flex flex-col items-center justify-center text-center">
                  <div className="flex items-center gap-1 text-orange-400 mb-1">
                    <Flame className="w-4 h-4" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">Streak</span>
                  </div>
                  <div className="text-lg font-black text-orange-300">
                    {profile.gamingStreakCount || 0}d
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium">Active</span>
                </div>
              </div>

              {/* Verified Game Records */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2.5 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-indigo-400" />
                  Game Records & Best Scores
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {/* Temple Run 3D */}
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                    <div className="flex items-center justify-between text-xs font-semibold text-gray-300 mb-1">
                      <span className="flex items-center gap-1">🗿 Temple Run 3D</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-gray-400">Distance</span>
                      <span className="text-xs font-bold text-emerald-400">
                        {profile.gameStats?.temple?.bestDistance || 0}m
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between mt-0.5">
                      <span className="text-[10px] text-gray-500">Coins / Best</span>
                      <span className="text-[10px] text-amber-300 font-semibold">
                        {profile.gameStats?.temple?.totalCoins || 0} 🪙 • {profile.gameStats?.temple?.bestScore || 0} pts
                      </span>
                    </div>
                  </div>

                  {/* Arrow Puzzle */}
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                    <div className="flex items-center justify-between text-xs font-semibold text-gray-300 mb-1">
                      <span className="flex items-center gap-1">🎯 Arrow Puzzle</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-gray-400">Max Level</span>
                      <span className="text-xs font-bold text-indigo-400">
                        Lvl {profile.gameStats?.arrow?.maxLevel || profile.arrowLevel || 1}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between mt-0.5">
                      <span className="text-[10px] text-gray-500">High Score</span>
                      <span className="text-[10px] text-indigo-300 font-semibold">
                        {profile.gameStats?.arrow?.bestScore || 0} pts
                      </span>
                    </div>
                  </div>

                  {/* Candy Crush */}
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                    <div className="flex items-center justify-between text-xs font-semibold text-gray-300 mb-1">
                      <span className="flex items-center gap-1">🍬 Candy Crush</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-gray-400">Level</span>
                      <span className="text-xs font-bold text-pink-400">
                        Lvl {profile.gameStats?.candy?.maxLevel || 1}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between mt-0.5">
                      <span className="text-[10px] text-gray-500">Best Match</span>
                      <span className="text-[10px] text-pink-300 font-semibold">
                        {profile.gameStats?.candy?.bestScore || 0} pts
                      </span>
                    </div>
                  </div>

                  {/* Speed Tapper & AI TicTacToe */}
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                    <div className="flex items-center justify-between text-xs font-semibold text-gray-300 mb-1">
                      <span className="flex items-center gap-1">⚡ Tapper & ❌ AI</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-gray-400">Speed Tap</span>
                      <span className="text-xs font-bold text-yellow-400">
                        {profile.gameStats?.tapper?.bestScore || 0} pts
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between mt-0.5">
                      <span className="text-[10px] text-gray-500">AI Arena</span>
                      <span className="text-[10px] text-cyan-300 font-semibold">
                        {profile.gameStats?.tictactoe?.wins || 0}W - {profile.gameStats?.tictactoe?.losses || 0}L
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Achievements Showcase */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  Unlocked Achievements ({profile.achievements?.length || 0})
                </h4>
                {profile.achievements && profile.achievements.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {profile.achievements.map((ach) => (
                      <div
                        key={ach.id}
                        className="p-2.5 rounded-xl bg-gradient-to-r from-white/[0.04] to-white/[0.01] border border-amber-500/20 flex items-start gap-2"
                      >
                        <div className="text-lg shrink-0 mt-0.5">{ach.icon || '🏅'}</div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-amber-200 truncate">{ach.title}</p>
                          <p className="text-[10px] text-gray-400 leading-tight line-clamp-2 mt-0.5">{ach.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                    <p className="text-xs text-gray-400">No achievements unlocked yet. Play games to earn trophies!</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-white/10 bg-black/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white transition-all shadow-md cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
