'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

interface LeaderboardEntry {
  user_id: string;
  username: string;
  current_score: number;
  last_update: string;
}

interface LiveLeaderboardProps {
  tournamentId: string;
  currentUserId?: string;
  compact?: boolean;
}

export default function LiveLeaderboard({ tournamentId, currentUserId, compact = false }: LiveLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  // Fetch leaderboard data
  const fetchLeaderboard = async () => {
    try {
      console.log('Fetching leaderboard for tournament:', tournamentId);

      // STEP 1: Get scores
      const { data: scores, error: scoresError } = await supabase
        .from('tournament_scores')
        .select('user_id, current_score, last_update')
        .eq('tournament_id', tournamentId)
        .order('current_score', { ascending: false });

      if (scoresError) {
        console.error('❌ Error fetching scores:', scoresError);
        throw scoresError;
      }

      if (!scores || scores.length === 0) {
        console.log('⚠️ No scores found - tournament may not have started');
        setLeaderboard([]);
        setLoading(false);
        return;
      }

      console.log('✅ Fetched scores:', scores);

      // STEP 2: Get participant details (username only, no images)
      const { data: participants, error: participantsError } = await supabase
        .from('tournament_participants')
        .select('user_id, username')
        .eq('tournament_id', tournamentId);

      if (participantsError) {
        console.error('❌ Error fetching participants:', participantsError);
        throw participantsError;
      }

      console.log('✅ Fetched participants:', participants);

      // STEP 3: Manually join in JavaScript
      const participantsMap = new Map(
        participants?.map(p => [p.user_id, p]) || []
      );

      const combined: LeaderboardEntry[] = scores.map(score => {
        const participant = participantsMap.get(score.user_id);
        return {
          user_id: score.user_id,
          username: participant?.username || 'Unknown Player',
          current_score: score.current_score,
          last_update: score.last_update
        };
      });

      console.log('✅ Combined leaderboard:', combined);
      setLeaderboard(combined);
      setError(null);
    } catch (err: any) {
      console.error('❌ Leaderboard fetch error:', err);
      setError(err.message || 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`tournament_scores_${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_scores',
          filter: `tournament_id=eq.${tournamentId}`
        },
        (payload) => {
          console.log('🔄 Real-time update received:', payload);
          fetchLeaderboard(); // Re-fetch on any change
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
      });

    return () => {
      console.log('🔌 Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  if (loading) {
    return (
      <div className={`bg-purple-900/30 rounded-lg border border-purple-500/30 ${compact ? 'p-3' : 'p-6'}`}>
        <h3 className={`font-bold text-purple-300 mb-4 ${compact ? 'text-lg' : 'text-xl'}`}>Live Leaderboard</h3>
        <div className={`text-center text-gray-400 ${compact ? 'py-4' : 'py-8'}`}>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
          <p className={`mt-2 ${compact ? 'text-sm' : ''}`}>Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-purple-900/30 rounded-lg border border-purple-500/30 ${compact ? 'p-3' : 'p-6'}`}>
        <h3 className={`font-bold text-purple-300 mb-4 ${compact ? 'text-lg' : 'text-xl'}`}>Live Leaderboard</h3>
        <div className={`text-center text-red-400 ${compact ? 'py-4 text-sm' : 'py-8'}`}>
          Error: {error}
          <br />
          <button 
            onClick={fetchLeaderboard}
            className={`mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded ${compact ? 'text-sm' : ''}`}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className={`bg-purple-900/30 rounded-lg border border-purple-500/30 ${compact ? 'p-3' : 'p-6'}`}>
        <h3 className={`font-bold text-purple-300 mb-4 ${compact ? 'text-lg' : 'text-xl'}`}>Live Leaderboard</h3>
        <div className={`text-center text-gray-400 ${compact ? 'py-4 text-sm' : 'py-8'}`}>
          Waiting for players to start...
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-purple-900/30 rounded-lg border border-purple-500/30 ${compact ? 'p-3' : 'p-6'}`}>
      <h3 className={`font-bold text-purple-300 mb-4 flex items-center gap-2 ${compact ? 'text-lg' : 'text-xl'}`}>
        <span className="animate-pulse">🔴</span>
        Live Leaderboard
      </h3>
      
      <div className={compact ? 'space-y-1' : 'space-y-2'}>
        {leaderboard.map((entry, index) => (
          <div
            key={entry.user_id}
            className={`
              flex items-center gap-3 rounded-lg transition-all
              ${compact ? 'p-2' : 'p-3'}
              ${entry.user_id === currentUserId 
                ? 'bg-purple-600/40 border border-purple-400' 
                : 'bg-purple-800/20'
              }
            `}
          >
            {/* Rank */}
            <div className={`
              rounded-full flex items-center justify-center font-bold
              ${compact ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'}
              ${index === 0 ? 'bg-yellow-500 text-black' : 
                index === 1 ? 'bg-gray-300 text-black' :
                index === 2 ? 'bg-amber-600 text-white' :
                'bg-purple-700 text-purple-200'}
            `}>
              {index + 1}
            </div>

            {/* Avatar Initial (no images) */}
            <div className={`rounded-full bg-purple-600 flex items-center justify-center text-white font-bold ${compact ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'}`}>
              {entry.username.charAt(0).toUpperCase()}
            </div>

            {/* Username */}
            <div className="flex-1 min-w-0">
              <div className={`text-white font-medium truncate ${compact ? 'text-sm' : 'text-base'}`}>
                {entry.username}
                {entry.user_id === currentUserId && (
                  <span className="ml-2 text-xs text-purple-300">(You)</span>
                )}
              </div>
            </div>

            {/* Score */}
            <div className={`font-bold text-purple-200 ${compact ? 'text-base' : 'text-xl'}`}>
              {entry.current_score.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-center text-xs text-gray-400">
        Updates automatically in real-time
      </div>
    </div>
  );
}
