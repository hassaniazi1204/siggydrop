'use client';
// ChatGPT Step 2: Final leaderboard shows only Rank, Username, Score
// Frozen once tournament status = 'finished'

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useSession } from 'next-auth/react';

interface Result {
  user_id:     string;
  username:    string;
  rank:        number;
  final_score: number;
}

export default function TournamentResults() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const tournamentId = params.id as string;
  const supabase = createClient();

  const [results, setResults]           = useState<Result[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [tournamentCode, setTournamentCode] = useState('');
  const [currentUserDbId, setCurrentUserDbId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/user/me').then(r => r.json()).then(d => { if (d.id) setCurrentUserDbId(d.id); });
  }, []);

  const fetchResults = async () => {
    try {
      const { data: tournament } = await supabase
        .from('tournaments').select('tournament_code, status').eq('id', tournamentId).single();
      if (!tournament) { setError('Tournament not found'); setLoading(false); return; }
      setTournamentCode(tournament.tournament_code);

      // ChatGPT Step 2: only rank, username, score from tournament_results
      const { data, error: resultsError } = await supabase
        .from('tournament_results')
        .select('user_id, username, rank, final_score')
        .eq('tournament_id', tournamentId)
        .order('rank', { ascending: true });

      if (resultsError) throw resultsError;

      if (!data?.length) {
        if (tournament.status !== 'finished') setError('Tournament has not ended yet');
        else setError('No results found');
        setLoading(false);
        return;
      }

      setResults(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!tournamentId) return;
    fetchResults();

    // Listen for tournament to finish
    const ch = supabase.channel(`results:${tournamentId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'tournaments',
        filter: `id=eq.${tournamentId}`,
      }, (payload) => {
        if ((payload.new as any).status === 'finished') fetchResults();
      }).subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [tournamentId]);

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-purple-300 mx-auto mb-4" />
        <p className="text-purple-200 text-lg">Loading results...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-8 max-w-md text-center">
        <h2 className="text-2xl font-bold text-red-300 mb-4">Error</h2>
        <p className="text-red-200 mb-6">{error}</p>
        <button onClick={() => router.push('/tournaments')} className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold">Back to Tournaments</button>
      </div>
    </div>
  );

  const myResult = results.find(r => r.user_id === currentUserDbId);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-800 to-indigo-900 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🏆 Final Results</h1>
          <p className="text-purple-200">Code: <span className="font-mono font-bold">{tournamentCode}</span></p>
        </div>

        {/* Your result highlight */}
        {myResult && (
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg p-6 mb-6 border-2 border-purple-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-200 text-sm mb-1">Your Result</p>
                <p className="text-white text-3xl font-bold">#{myResult.rank} Place</p>
              </div>
              <div className="text-right">
                <p className="text-purple-200 text-sm mb-1">Final Score</p>
                <p className="text-white text-3xl font-bold">{myResult.final_score.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* ChatGPT Step 2: Rank, Username, Score ONLY */}
        <div className="bg-purple-900/50 rounded-lg border border-purple-500/30 backdrop-blur overflow-hidden">
          <div className="grid grid-cols-3 text-xs font-bold text-purple-400 uppercase px-4 py-3 border-b border-purple-700/50">
            <span>Rank</span>
            <span>Player</span>
            <span className="text-right">Score</span>
          </div>
          <div className="divide-y divide-purple-800/30">
            {results.map(result => (
              <div key={result.user_id} className={`grid grid-cols-3 items-center px-4 py-4 transition-colors ${result.user_id === currentUserDbId ? 'bg-purple-600/30' : 'hover:bg-purple-800/20'}`}>
                {/* Rank */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                  result.rank === 1 ? 'bg-yellow-500 text-black' :
                  result.rank === 2 ? 'bg-gray-300 text-black' :
                  result.rank === 3 ? 'bg-amber-600 text-white' : 'bg-purple-700 text-purple-200'}`}>
                  {result.rank}
                </div>

                {/* Username */}
                <div className="text-white font-semibold truncate">
                  {result.username}
                  {result.user_id === currentUserDbId && <span className="ml-2 text-xs text-purple-300">(You)</span>}
                </div>

                {/* Score */}
                <div className="text-right text-xl font-bold text-white">
                  {result.final_score.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex gap-4 justify-center">
          <button onClick={() => router.push('/tournaments')} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition">Back to Tournaments</button>
          <button onClick={() => router.push('/game')} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition">Play Solo</button>
        </div>
      </div>
    </div>
  );
}
