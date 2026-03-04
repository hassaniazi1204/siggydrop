'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useSession } from 'next-auth/react';

interface TournamentResult {
  rank: number;
  user_id: string;
  username: string;
  profile_image: string | null;
  final_score: number;
  balls_dropped: number;
  merges_completed: number;
  total_game_time_seconds: number;
}

interface Tournament {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  created_at: string;
}

export default function TournamentResults() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const supabase = createClient();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [results, setResults] = useState<TournamentResult[]>([]);
  const [myResult, setMyResult] = useState<TournamentResult | null>(null);
  const [loading, setLoading] = useState(true);

  const tournamentId = params.id as string;

  useEffect(() => {
    if (!tournamentId) return;

    const fetchResults = async () => {
      // Fetch tournament
      const { data: tournamentData } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tournamentData) {
        setTournament(tournamentData);
      }

      // Fetch results
      const { data: resultsData } = await supabase
        .from('tournament_results')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('rank', { ascending: true });

      if (resultsData) {
        setResults(resultsData);
        
        // Find current user's result
        if ((session?.user as any)?.id) {
          const myData = resultsData.find(r => r.user_id === (session?.user as any)?.id);
          if (myData) {
            setMyResult(myData);
          }
        }
      }

      setLoading(false);
    };

    fetchResults();
  }, [tournamentId, session]);

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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-purple-900">
        <div className="text-white text-2xl">Loading results...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-purple-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-black text-white mb-4">
            🏆 Tournament Complete!
          </h1>
          {tournament && (
            <p className="text-2xl text-purple-400 font-bold">{tournament.name}</p>
          )}
        </div>

        {/* Your Result */}
        {myResult && (
          <div className="mb-12 bg-gradient-to-r from-purple-900/50 to-pink-900/50 backdrop-blur-md border-2 border-purple-500 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-2xl font-black text-white mb-6 text-center">
              Your Performance
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className={`text-5xl font-black bg-gradient-to-r ${getRankColor(myResult.rank)} bg-clip-text text-transparent mb-2`}>
                  {getRankEmoji(myResult.rank)}
                </div>
                <div className="text-3xl font-black text-white mb-1">#{myResult.rank}</div>
                <div className="text-sm text-gray-400">Rank</div>
              </div>

              <div className="text-center">
                <div className="text-4xl font-black text-purple-400 mb-1">
                  {myResult.final_score.toLocaleString()}
                </div>
                <div className="text-sm text-gray-400">Final Score</div>
              </div>

              <div className="text-center">
                <div className="text-4xl font-black text-blue-400 mb-1">
                  {myResult.balls_dropped}
                </div>
                <div className="text-sm text-gray-400">Balls Dropped</div>
              </div>

              <div className="text-center">
                <div className="text-4xl font-black text-green-400 mb-1">
                  {myResult.merges_completed}
                </div>
                <div className="text-sm text-gray-400">Merges</div>
              </div>
            </div>
          </div>
        )}

        {/* Top 3 Podium */}
        {results.length >= 3 && (
          <div className="mb-12 flex justify-center items-end gap-4">
            {/* 2nd Place */}
            <div className="flex flex-col items-center">
              <div className="text-6xl mb-2">🥈</div>
              {results[1].profile_image ? (
                <img
                  src={results[1].profile_image}
                  alt={results[1].username}
                  className="w-20 h-20 rounded-full border-4 border-gray-400 object-cover mb-2"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center text-white font-bold text-2xl mb-2 border-4 border-gray-400">
                  {results[1].username.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-white font-bold text-xl mb-1">{results[1].username}</div>
              <div className="text-3xl font-black text-gray-400 mb-2">
                {results[1].final_score.toLocaleString()}
              </div>
              <div className="w-32 h-24 bg-gradient-to-br from-gray-300 to-gray-500 rounded-t-xl flex items-center justify-center">
                <div className="text-4xl font-black text-white">2</div>
              </div>
            </div>

            {/* 1st Place */}
            <div className="flex flex-col items-center -mt-8">
              <div className="text-7xl mb-2">🥇</div>
              {results[0].profile_image ? (
                <img
                  src={results[0].profile_image}
                  alt={results[0].username}
                  className="w-24 h-24 rounded-full border-4 border-yellow-400 object-cover mb-2"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white font-bold text-3xl mb-2 border-4 border-yellow-400">
                  {results[0].username.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-white font-bold text-2xl mb-1">{results[0].username}</div>
              <div className="text-4xl font-black text-yellow-400 mb-2">
                {results[0].final_score.toLocaleString()}
              </div>
              <div className="w-32 h-32 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-t-xl flex items-center justify-center">
                <div className="text-5xl font-black text-white">1</div>
              </div>
            </div>

            {/* 3rd Place */}
            <div className="flex flex-col items-center">
              <div className="text-6xl mb-2">🥉</div>
              {results[2].profile_image ? (
                <img
                  src={results[2].profile_image}
                  alt={results[2].username}
                  className="w-20 h-20 rounded-full border-4 border-orange-400 object-cover mb-2"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-2xl mb-2 border-4 border-orange-400">
                  {results[2].username.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-white font-bold text-xl mb-1">{results[2].username}</div>
              <div className="text-3xl font-black text-orange-400 mb-2">
                {results[2].final_score.toLocaleString()}
              </div>
              <div className="w-32 h-20 bg-gradient-to-br from-orange-400 to-orange-600 rounded-t-xl flex items-center justify-center">
                <div className="text-4xl font-black text-white">3</div>
              </div>
            </div>
          </div>
        )}

        {/* Full Results Table */}
        <div className="bg-gray-900/50 backdrop-blur-md border-2 border-purple-500/30 rounded-2xl p-8">
          <h2 className="text-3xl font-black text-white mb-6">Full Rankings</h2>
          
          <div className="space-y-2">
            {results.map((result) => {
              const isCurrentUser = result.user_id === (session?.user as any)?.id;
              const isTop3 = result.rank <= 3;

              return (
                <div
                  key={result.user_id}
                  className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                    isCurrentUser
                      ? 'bg-purple-500/20 border-2 border-purple-500'
                      : isTop3
                      ? 'bg-gradient-to-r from-gray-800 to-gray-900 border border-yellow-500/30'
                      : 'bg-gray-800/50 border border-gray-700'
                  }`}
                >
                  {/* Rank */}
                  <div className="flex-shrink-0 w-16 text-center">
                    {isTop3 ? (
                      <div className="text-4xl">{getRankEmoji(result.rank)}</div>
                    ) : (
                      <div className="text-2xl font-black text-gray-400">#{result.rank}</div>
                    )}
                  </div>

                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {result.profile_image ? (
                      <img
                        src={result.profile_image}
                        alt={result.username}
                        className="w-12 h-12 rounded-full border-2 border-purple-400 object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                        {result.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Username */}
                  <div className="flex-1">
                    <div className={`font-bold ${isCurrentUser ? 'text-purple-400' : 'text-white'}`}>
                      {result.username}
                      {isCurrentUser && (
                        <span className="ml-2 text-xs bg-purple-500/30 px-2 py-0.5 rounded">YOU</span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex gap-6 text-sm">
                    <div className="text-center">
                      <div className="text-white font-bold">{result.balls_dropped}</div>
                      <div className="text-gray-400 text-xs">Balls</div>
                    </div>
                    <div className="text-center">
                      <div className="text-white font-bold">{result.merges_completed}</div>
                      <div className="text-gray-400 text-xs">Merges</div>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right">
                    <div className={`text-2xl font-black ${
                      isCurrentUser ? 'text-purple-400' : 
                      isTop3 ? 'text-yellow-400' : 'text-white'
                    }`}>
                      {result.final_score.toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-12 flex gap-4 justify-center">
          <button
            onClick={() => router.push('/tournaments')}
            className="px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold transition-colors"
          >
            Back to Tournaments
          </button>
          <button
            onClick={() => router.push('/game')}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-bold transition-colors"
          >
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
}
