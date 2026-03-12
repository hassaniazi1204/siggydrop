'use client';
// Results page — reads ONLY from tournament_results ordered by rank ASC.
// Auto-triggers finalization if results are missing (e.g. direct navigation).
// Status guard: blocks if tournament is still 'waiting' or 'running'.

import { useEffect, useState, useRef } from 'react';
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
  const params       = useParams();
  const router       = useRouter();
  const tournamentId = params.id as string;

  const supabaseRef = useRef(createClient());
  const supabase    = supabaseRef.current;

  const { data: session, status: sessionStatus } = useSession();

  const [results, setResults]                   = useState<Result[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState<string | null>(null);
  const [tournamentCode, setTournamentCode]     = useState('');
  const [currentUserDbId, setCurrentUserDbId]   = useState<string | null>(null);
  const [finalizing, setFinalizing]             = useState(false);

  // Gate /api/user/me on session confirmed — prevents ERR_TIMED_OUT retry loop
  useEffect(() => {
    if (sessionStatus !== 'authenticated') return;
    fetch('/api/user/me').then(r => r.json()).then(d => { if (d.id) setCurrentUserDbId(d.id); });
  }, [sessionStatus]);

  const fetchResults = async () => {
    try {
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('tournament_code, status')
        .eq('id', tournamentId)
        .single();

      if (!tournament) { setError('Tournament not found'); setLoading(false); return; }
      setTournamentCode(tournament.tournament_code);

      // Tournament hasn't ended yet
      if (tournament.status === 'waiting' || tournament.status === 'running') {
        setError('Tournament has not ended yet');
        setLoading(false);
        return;
      }

      // Read final snapshot from tournament_results
      const { data, error: resultsError } = await supabase
        .from('tournament_results')
        .select('user_id, username, rank, final_score')
        .eq('tournament_id', tournamentId)
        .order('rank', { ascending: true });

      if (resultsError) throw resultsError;

      if (!data?.length) {
        // Results not written yet even though status is finished — trigger finalize
        setFinalizing(true);
        const res = await fetch(`/api/tournaments/${tournamentId}/finalize`, { method: 'POST' });
        setFinalizing(false);

        if (res.ok) {
          const { data: fresh } = await supabase
            .from('tournament_results')
            .select('user_id, username, rank, final_score')
            .eq('tournament_id', tournamentId)
            .order('rank', { ascending: true });
          setResults(fresh || []);
        } else {
          setError('Could not load results — please refresh');
        }
        setLoading(false);
        return;
      }

      setResults(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!tournamentId) return;
    fetchResults();

    // Realtime: re-fetch if tournament finishes while we're on this page
    const ch = supabase
      .channel(`results:${tournamentId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'tournaments',
        filter: `id=eq.${tournamentId}`,
      }, (payload) => {
        if ((payload.new as any).status === 'finished') fetchResults();
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [tournamentId]);

  if (loading || finalizing) return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-purple-300 mx-auto mb-4" />
        <p className="text-purple-200 text-lg">
          {finalizing ? 'Calculating final standings...' : 'Loading results...'}
        </p>
      </div>
    </div>
  );

  if (error && !results.length) return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-purple-900/50 border border-purple-500/30 rounded-2xl p-8 max-w-md text-center">
        <div className="text-5xl mb-4">⏳</div>
        <h2 className="text-2xl font-bold text-white mb-2">Tournament Still Running</h2>
        <p className="text-purple-200 mb-6">{error}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={fetchResults} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition">
            Refresh
          </button>
          <button onClick={() => router.push('/tournaments')} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition">
            Back
          </button>
        </div>
      </div>
    </div>
  );

  const myResult = results.find(r => r.user_id === currentUserDbId);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-800 to-indigo-900 p-4">
      <div className="max-w-2xl mx-auto pt-8">

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🏆 Final Results</h1>
          <p className="text-purple-200">
            Code: <span className="font-mono font-bold">{tournamentCode}</span>
          </p>
        </div>

        {myResult && (
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 mb-6 border-2 border-purple-300/50 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-200 text-sm mb-1">Your Result</p>
                <p className="text-white text-3xl font-black">#{myResult.rank} Place</p>
              </div>
              <div className="text-right">
                <p className="text-purple-200 text-sm mb-1">Final Score</p>
                <p className="text-white text-3xl font-black">{myResult.final_score.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Rank, Username, Score only */}
        <div className="bg-purple-900/50 rounded-xl border border-purple-500/30 backdrop-blur overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_auto] text-xs font-bold text-purple-400 uppercase px-4 py-3 border-b border-purple-700/50 gap-4">
            <span>Rank</span>
            <span>Player</span>
            <span>Score</span>
          </div>
          <div className="divide-y divide-purple-800/30">
            {results.map(result => (
              <div
                key={result.user_id}
                className={`grid grid-cols-[auto_1fr_auto] items-center px-4 py-4 gap-4 transition-colors ${
                  result.user_id === currentUserDbId ? 'bg-purple-600/30' : 'hover:bg-purple-800/20'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg flex-shrink-0 ${
                  result.rank === 1 ? 'bg-yellow-500 text-black' :
                  result.rank === 2 ? 'bg-slate-300 text-black' :
                  result.rank === 3 ? 'bg-amber-600 text-white' :
                  'bg-purple-700 text-purple-300'
                }`}>
                  {result.rank}
                </div>
                <div className="min-w-0">
                  <div className="text-white font-semibold truncate">
                    {result.username}
                    {result.user_id === currentUserDbId && (
                      <span className="ml-2 text-xs text-purple-300">(You)</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-white">{result.final_score.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex gap-4 justify-center">
          <button onClick={() => router.push('/tournaments')} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition">
            Back to Tournaments
          </button>
          <button onClick={() => router.push('/game')} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition">
            Play Solo
          </button>
        </div>
      </div>
    </div>
  );
}
