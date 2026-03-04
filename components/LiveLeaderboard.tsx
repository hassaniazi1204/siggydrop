'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  profile_image: string | null;
  best_score: number;
  last_update: string;
}

interface LiveLeaderboardProps {
  tournamentId: string;
  currentUserId?: string;
  compact?: boolean;
}

export default function LiveLeaderboard({ 
  tournamentId, 
  currentUserId,
  compact = false 
}: LiveLeaderboardProps) {
  const supabase = createClient();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch leaderboard
  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/leaderboard`);
      const data = await response.json();

      if (data.success) {
        setLeaderboard(data.leaderboard);
        setMyRank(data.my_rank);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchLeaderboard();
  }, [tournamentId]);

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel(`leaderboard:${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_scores',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => {
          // Refetch leaderboard on any score update
          fetchLeaderboard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-white">Loading leaderboard...</div>
      </div>
    );
  }

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'from-yellow-400 to-yellow-600';
    if (rank === 2) return 'from-gray-300 to-gray-400';
    if (rank === 3) return 'from-orange-400 to-orange-600';
    return 'from-purple-400 to-pink-400';
  };

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '🎮';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      {!compact && (
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-black text-white">Live Leaderboard</h2>
          {myRank && (
            <div className="px-4 py-2 bg-purple-500/20 border border-purple-500 rounded-lg">
              <span className="text-purple-400 font-bold">Your Rank: #{myRank}</span>
            </div>
          )}
        </div>
      )}

      {/* Leaderboard */}
      <div className={`space-y-2 ${compact ? 'max-h-96 overflow-y-auto' : ''}`}>
        {leaderboard.length === 0 ? (
          <div className="text-center p-8 bg-gray-800/50 rounded-xl">
            <p className="text-gray-400">No scores yet. Be the first to play!</p>
          </div>
        ) : (
          leaderboard.map((entry, index) => {
            const isCurrentUser = entry.user_id === currentUserId;
            const isTop3 = entry.rank <= 3;

            return (
              <div
                key={entry.user_id}
                className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                  isCurrentUser
                    ? 'bg-purple-500/20 border-2 border-purple-500 scale-105'
                    : isTop3
                    ? 'bg-gradient-to-r from-gray-800 to-gray-900 border-2 border-yellow-500/30'
                    : 'bg-gray-800/50 border border-gray-700'
                }`}
              >
                {/* Rank */}
                <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center">
                  {isTop3 ? (
                    <div className={`w-full h-full rounded-full bg-gradient-to-br ${getRankColor(entry.rank)} flex items-center justify-center text-2xl`}>
                      {getRankEmoji(entry.rank)}
                    </div>
                  ) : (
                    <div className="text-2xl font-black text-gray-400">
                      #{entry.rank}
                    </div>
                  )}
                </div>

                {/* Avatar */}
                <div className="flex-shrink-0">
                  {entry.profile_image ? (
                    <img
                      src={entry.profile_image}
                      alt={entry.username}
                      className="w-12 h-12 rounded-full border-2 border-purple-400 object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                      {entry.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Username */}
                <div className="flex-1 min-w-0">
                  <div className={`font-bold truncate ${isCurrentUser ? 'text-purple-400' : 'text-white'}`}>
                    {entry.username}
                    {isCurrentUser && (
                      <span className="ml-2 text-xs bg-purple-500/30 px-2 py-0.5 rounded">YOU</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(entry.last_update).toLocaleTimeString()}
                  </div>
                </div>

                {/* Score */}
                <div className="text-right">
                  <div className={`text-2xl font-black ${
                    isCurrentUser ? 'text-purple-400' : 
                    isTop3 ? 'text-yellow-400' : 'text-white'
                  }`}>
                    {entry.best_score.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-400">points</div>
                </div>

                {/* Movement Indicator (optional enhancement) */}
                {!compact && (
                  <div className="flex-shrink-0 w-8">
                    {/* Add movement arrows here if tracking position changes */}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Show More (if compact) */}
      {compact && leaderboard.length > 10 && (
        <div className="text-center">
          <button className="text-purple-400 hover:text-purple-300 text-sm font-semibold">
            View Full Leaderboard →
          </button>
        </div>
      )}
    </div>
  );
}

