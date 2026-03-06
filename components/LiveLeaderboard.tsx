'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  profile_image: string | null;
  current_score: number;
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

  // Fetch leaderboard from live view
  const fetchLeaderboard = async () => {
    try {
      // Query the live_tournament_leaderboards view
      const { data, error } = await supabase
        .from('live_tournament_leaderboards')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('rank', { ascending: true });

      if (error) {
        console.error('Leaderboard fetch error:', error);
        
        // Fallback: query tournament_scores directly
        const { data: scoresData, error: scoresError } = await supabase
          .from('tournament_scores')
          .select(`
            user_id,
            current_score,
            last_update,
            tournament_participants!inner(
              username,
              profile_image
            )
          `)
          .eq('tournament_id', tournamentId)
          .order('current_score', { ascending: false });

        if (scoresError) {
          console.error('Scores fetch error:', scoresError);
          setLoading(false);
          return;
        }

        // Transform to leaderboard format
        const entries: LeaderboardEntry[] = (scoresData || []).map((entry: any, index: number) => ({
          rank: index + 1,
          user_id: entry.user_id || '',
          username: entry.tournament_participants?.username || 'Unknown',
          profile_image: entry.tournament_participants?.profile_image || null,
          current_score: entry.current_score || 0,
          best_score: entry.current_score || 0,
          last_update: entry.last_update || new Date().toISOString(),
        }));

        setLeaderboard(entries);

        if (currentUserId) {
          const myEntry = entries.find(e => e.user_id === currentUserId);
          setMyRank(myEntry?.rank || null);
        }

        setLoading(false);
        return;
      }

      if (data) {
        const entries: LeaderboardEntry[] = data.map((entry: any) => ({
          rank: entry.rank || 0,
          user_id: entry.user_id || '',
          username: entry.username || 'Unknown',
          profile_image: entry.profile_image || null,
          current_score: entry.current_score || 0,
          best_score: entry.current_score || 0,
          last_update: entry.last_update || new Date().toISOString(),
        }));

        setLeaderboard(entries);

        // Find current user's rank
        if (currentUserId) {
          const myEntry = entries.find(e => e.user_id === currentUserId);
          setMyRank(myEntry?.rank || null);
        }
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
    const interval = setInterval(fetchLeaderboard, 1000); // Update every 1 second for real-time feel
    
    return () => clearInterval(interval);
  }, [tournamentId, currentUserId]);

  // Real-time subscription
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
          console.log('Score updated - refreshing leaderboard');
          fetchLeaderboard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

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
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-3 sm:p-4">
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
            <p className="text-sm">Players will appear here when they start scoring</p>
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
                    {entry.best_score?.toLocaleString() || 0}
                  </div>
                  <div className="text-xs text-gray-400 hidden sm:block">points</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-900/50 p-2 sm:p-3 text-center border-t border-gray-700">
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <div className="text-xs text-gray-400">
            Live • Updates every second
          </div>
        </div>
      </div>
    </div>
  );
}
