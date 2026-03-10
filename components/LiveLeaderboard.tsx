'use client';
// components/LiveLeaderboard.tsx
// Real-time tournament leaderboard using Supabase Realtime.
// Uses proper uuid FK join: tournament_scores → users (no manual lookup needed).

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';

interface LeaderboardEntry {
  user_id:     string;
  username:    string;
  score:       number;
  finished:    boolean;
  last_update: string;
}

interface Props {
  tournamentId:   string;
  currentUserId?: string; // users.id (uuid)
  compact?:       boolean;
}

export default function LiveLeaderboard({ tournamentId, currentUserId, compact = false }: Props) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const supabase = createClient();

  const fetchLeaderboard = useCallback(async () => {
    try {
      // Direct join via uuid FK — no manual username lookup needed
      const { data: scores, error: scoresError } = await supabase
        .from('tournament_scores')
        .select(`
          user_id,
          score,
          finished,
          last_update,
          users ( username )
        `)
        .eq('tournament_id', tournamentId)
        .order('score', { ascending: false });

      if (scoresError) throw scoresError;

      setLeaderboard((scores || []).map((s: any) => ({
        user_id:     s.user_id,
        username:    s.users?.username || 'Unknown',
        score:       s.score,
        finished:    s.finished,
        last_update: s.last_update,
      })));
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [tournamentId, supabase]);

  useEffect(() => {
    fetchLeaderboard();

    // Supabase Realtime — subscribe to this tournament's scores only
    const channel = supabase
      .channel(`leaderboard:${tournamentId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournament_scores',
        filter: `tournament_id=eq.${tournamentId}`,
      }, () => fetchLeaderboard())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tournamentId, fetchLeaderboard]);

  const medalFor = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;

  if (loading) return (
    <div className={`bg-purple-900/30 rounded-lg border border-purple-500/30 ${compact ? 'p-3' : 'p-6'}`}>
      <h3 className={`font-bold text-purple-300 mb-4 ${compact ? 'text-lg' : 'text-xl'}`}>🔴 Live Leaderboard</h3>
      <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" /></div>
    </div>
  );

  if (error) return (
    <div className={`bg-purple-900/30 rounded-lg border border-purple-500/30 ${compact ? 'p-3' : 'p-6'}`}>
      <h3 className={`font-bold text-purple-300 mb-4 ${compact ? 'text-lg' : 'text-xl'}`}>🔴 Live Leaderboard</h3>
      <div className="text-center text-red-400 py-4 text-sm">
        {error}
        <br /><button onClick={fetchLeaderboard} className="mt-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm">Retry</button>
      </div>
    </div>
  );

  return (
    <div className={`bg-purple-900/30 rounded-lg border border-purple-500/30 ${compact ? 'p-3' : 'p-6'}`}>
      <h3 className={`font-bold text-purple-300 mb-4 flex items-center gap-2 ${compact ? 'text-lg' : 'text-xl'}`}>
        <span className="animate-pulse">🔴</span> Live Leaderboard
      </h3>

      {leaderboard.length === 0
        ? <p className="text-center text-gray-400 py-4 text-sm">Waiting for players to start...</p>
        : <div className={compact ? 'space-y-1' : 'space-y-2'}>
            {leaderboard.map((entry, i) => {
              const isMe   = entry.user_id === currentUserId;
              const medal  = medalFor(i);
              return (
                <div key={entry.user_id} className={`flex items-center gap-3 rounded-lg transition-all ${compact ? 'p-2' : 'p-3'} ${isMe ? 'bg-purple-600/40 border border-purple-400' : 'bg-purple-800/20'}`}>
                  <div className={`rounded-full flex items-center justify-center font-bold flex-shrink-0 ${compact ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'} ${i === 0 ? 'bg-yellow-500 text-black' : i === 1 ? 'bg-gray-300 text-black' : i === 2 ? 'bg-amber-600 text-white' : 'bg-purple-700 text-purple-200'}`}>
                    {medal ?? i + 1}
                  </div>
                  <div className={`rounded-full bg-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0 ${compact ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'}`}>
                    {entry.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-white font-medium truncate ${compact ? 'text-sm' : 'text-base'}`}>
                      {entry.username}
                      {isMe && <span className="ml-2 text-xs text-purple-300">(You)</span>}
                      {entry.finished && <span className="ml-2 text-xs text-green-400">✓</span>}
                    </div>
                  </div>
                  <div className={`font-bold text-purple-200 flex-shrink-0 ${compact ? 'text-base' : 'text-xl'}`}>
                    {entry.score.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
      }
      <p className="mt-4 text-center text-xs text-gray-500">Updates automatically in real-time</p>
    </div>
  );
}
