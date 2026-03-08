'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Image from 'next/image';

interface LeaderboardEntry {
  user_id: string;
  username: string;
  profile_image: string | null;
  current_score: number;
  last_update: string;
}

interface LiveLeaderboardProps {
  tournamentId: string;
  currentUserId?: string;
}

export default function LiveLeaderboard({ tournamentId, currentUserId }: LiveLeaderboardProps) {
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

      // STEP 2: Get participant details
      const { data: participants, error: participantsError } = await supabase
        .from('tournament_participants')
        .select('user_id, username, profile_image')
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
          profile_image: participant?.profile_image || null,
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

  // Subscribe to real-time updates
  useEffect(() => {
    console.log('🔄 Setting up real-time subscription for tournament:', tournamentId);

    // Initial fetch
    fetchLeaderboard();

    // Subscribe to changes
    const channel = supabase
      .channel(`leaderboard-${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_scores',
          filter: `tournament_id=eq.${tournamentId}`
        },
        (payload) => {
          console.log('📡 Real-time update received:', payload);
          fetchLeaderboard(); // Refetch on any change
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
      });

    return () => {
      console.log('🔌 Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  if (loading) {
    return (
      <div className="bg-purple-900/30 rounded-lg p-6 border border-purple-500/30">
        <h3 className="text-xl font-bold text-purple-300 mb-4">Live Leaderboard</h3>
        <div className="text-center text-gray-400 py-8">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-purple-900/30 rounded-lg p-6 border border-purple-500/30">
        <h3 className="text-xl font-bold text-purple-300 mb-4">Live Leaderboard</h3>
        <div className="text-center text-red-400 py-8">
          Error: {error}
          <br />
          <button 
            onClick={fetchLeaderboard}
            className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="bg-purple-900/30 rounded-lg p-6 border border-purple-500/30">
        <h3 className="text-xl font-bold text-purple-300 mb-4">Live Leaderboard</h3>
        <div className="text-center text-gray-400 py-8">
          Waiting for players to start...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-purple-900/30 rounded-lg p-6 border border-purple-500/30">
      <h3 className="text-xl font-bold text-purple-300 mb-4 flex items-center gap-2">
        <span className="animate-pulse">🔴</span>
        Live Leaderboard
      </h3>
      
      <div className="space-y-2">
        {leaderboard.map((entry, index) => (
          <div
            key={entry.user_id}
            className={`
              flex items-center gap-3 p-3 rounded-lg transition-all
              ${entry.user_id === currentUserId 
                ? 'bg-purple-600/40 border border-purple-400' 
                : 'bg-purple-800/20'
              }
            `}
          >
            {/* Rank */}
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center font-bold
              ${index === 0 ? 'bg-yellow-500 text-black' : 
                index === 1 ? 'bg-gray-300 text-black' :
                index === 2 ? 'bg-amber-600 text-white' :
                'bg-purple-700 text-purple-200'}
            `}>
              {index + 1}
            </div>

            {/* Profile Image */}
            {entry.profile_image ? (
              <Image
                src={entry.profile_image}
                alt={entry.username}
                width={32}
                height={32}
                className="rounded-full"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold">
                {entry.username.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Username */}
            <div className="flex-1 min-w-0">
              <div className="text-white font-medium truncate">
                {entry.username}
                {entry.user_id === currentUserId && (
                  <span className="ml-2 text-xs text-purple-300">(You)</span>
                )}
              </div>
            </div>

            {/* Score */}
            <div className="text-xl font-bold text-purple-200">
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
