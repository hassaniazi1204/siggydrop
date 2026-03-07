'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  profile_image: string | null;
  current_score: number;
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

  // Fetch and rank scores
  const fetchLeaderboard = useCallback(async () => {
    try {
      // Query tournament_scores with participant info
      const { data, error } = await supabase
        .from('tournament_scores')
        .select(`
          user_id,
          current_score,
          last_update,
          tournament_participants!inner(username, profile_image)
        `)
        .eq('tournament_id', tournamentId)
        .order('current_score', { ascending: false });

      if (error) {
        console.error('Leaderboard fetch error:', error);
        return;
      }

      if (data) {
        // Transform and rank
        const entries: LeaderboardEntry[] = data.map((entry: any, index: number) => ({
          rank: index + 1,
          user_id: entry.user_id || '',
          username: entry.tournament_participants?.username || 'Unknown',
          profile_image: entry.tournament_participants?.profile_image || null,
          current_score: entry.current_score || 0,
          last_update: entry.last_update || new Date().toISOString(),
        }));

        setLeaderboard(entries);

        // Find current user's rank
        if (currentUserId) {
          const myEntry = entries.find(e => e.user_id === currentUserId);
          setMyRank(myEntry?.rank || null);
        }

        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      setLoading(false);
    }
  }, [tournamentId, currentUserId, supabase]);

  // Initial fetch
  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Supabase Realtime subscription
  useEffect(() => {
    console.log('Setting up Realtime subscription for tournament:', tournamentId);

    const channel = supabase
      .channel(`tournament_scores:${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',  // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'tournament_scores',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload) => {
          console.log('Realtime update received:', payload);
          // Immediately refetch leaderboard when any score changes
          fetchLeaderboard();
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      console.log('Cleaning up Realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [tournamentId, fetchLeaderboard, supabase]);

  if (loading && leaderboard.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-black/40 backdrop-blur-sm rounded-xl p-4">
        <div className="text-white text-center">
          <div className="text-4xl mb-2 animate-pulse">🏆</div>
          <div className="text-sm">Loading leaderboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-black/40 backdrop-blur-sm rounded-xl border-2 border-purple-500/30 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-3 sm:p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white">🏆 LIVE RANKS</h2>
            <p className="text-xs text-white/80 hidden sm:block">Real-time Rankings</p>
          </div>
          {myRank && (
            <div className="bg-white/20 px-3 py-1 rounded-lg">
              <div className="text-xs text-white/80">Your Rank</div>
              <div className="text-2xl font-black text-white">#{myRank}</div>
            </div>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-2">
        {leaderboard.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <div className="text-4xl mb-2">👥</div>
            <p className="text-sm">Waiting for players to score...</p>
          </div>
        ) : (
          leaderboard.map((entry) => {
            const isCurrentUser = entry.user_id === currentUserId;
            const rank = entry.rank;

            return (
              <div
                key={entry.user_id}
                className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl transition-all ${
                  isCurrentUser
                    ? 'bg-purple-600/40 border-2 border-purple-400 scale-105'
                    : 'bg-gray-800/50 border border-gray-700 hover:bg-gray-800/70'
                }`}
              >
                {/* Rank */}
                <div className="w-8 sm:w-12 text-center flex-shrink-0">
                  {rank === 1 ? (
                    <div className="text-2xl sm:text-3xl">🥇</div>
                  ) : rank === 2 ? (
                    <div className="text-2xl sm:text-3xl">🥈</div>
                  ) : rank === 3 ? (
                    <div className="text-2xl sm:text-3xl">🥉</div>
                  ) : (
                    <div className="text-lg sm:text-2xl font-black text-gray-400">
                      #{rank}
                    </div>
                  )}
                </div>

                {/* Avatar */}
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                  {entry.profile_image ? (
                    <img
                      src={entry.profile_image}
                      alt={entry.username}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <div className="text-white font-bold text-sm sm:text-base">
                      {entry.username?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}
                </div>

                {/* Username */}
                <div className="flex-1 min-w-0">
                  <div className={`font-bold text-sm sm:text-base truncate ${
                    isCurrentUser ? 'text-purple-300' : 'text-white'
                  }`}>
                    {entry.username || 'Unknown Player'}
                    {isCurrentUser && (
                      <span className="ml-1 text-xs bg-purple-500/50 px-2 py-0.5 rounded">
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 hidden sm:block">
                    {new Date(entry.last_update).toLocaleTimeString()}
                  </div>
                </div>

                {/* Score */}
                <div className={`text-right flex-shrink-0 ${
                  rank === 1 ? 'text-yellow-400' :
                  rank === 2 ? 'text-gray-300' :
                  rank === 3 ? 'text-orange-400' :
                  isCurrentUser ? 'text-purple-400' : 'text-white'
                }`}>
                  <div className="text-lg sm:text-2xl font-black">
                    {entry.current_score?.toLocaleString() || 0}
                  </div>
                  <div className="text-xs text-gray-400 hidden sm:block">points</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-900/50 p-2 sm:p-3 text-center border-t border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <div className="text-xs text-gray-400">
            Live • Real-time updates
          </div>
        </div>
      </div>
    </div>
  );
}
