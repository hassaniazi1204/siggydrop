'use client';
// app/leaderboard/solo/page.tsx
// Top-20 solo play leaderboard. Fetches from /api/leaderboard.
// Highlights the currently logged-in user automatically via useSession.

import { Suspense, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

interface LeaderboardEntry {
  id: number;
  username: string;
  score: number;
  created_at: string;
}

function SoloLeaderboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Highlight username comes from session (preferred) or URL param (fallback for guests)
  const highlightUsername =
    session?.user?.name ||
    session?.user?.email?.split('@')[0] ||
    searchParams.get('username') ||
    null;

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/leaderboard');
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to fetch');
      setEntries(result.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-purple-900">
        <div className="text-white text-2xl">Loading leaderboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-purple-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
            🏆 SOLO LEADERBOARD
          </h1>
          <p className="text-gray-400 text-xl">Top 20 Solo Players</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-center">
            {error}
            <button onClick={fetchLeaderboard} className="ml-4 underline text-sm">Retry</button>
          </div>
        )}

        {/* Leaderboard table */}
        <div className="bg-gray-900/50 backdrop-blur-md border-2 border-purple-500/30 rounded-2xl p-8">
          {entries.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-xl">No scores yet. Be the first!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry, index) => {
                const isHighlighted =
                  highlightUsername &&
                  entry.username.toLowerCase() === highlightUsername.toLowerCase();
                const rank = index + 1;

                return (
                  <div
                    key={`${entry.id}-${index}`}
                    className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                      isHighlighted
                        ? 'bg-purple-600/30 border-2 border-purple-500 scale-105'
                        : 'bg-black/30 border-2 border-gray-700 hover:border-purple-500/50'
                    }`}
                  >
                    {/* Rank */}
                    <div className="w-16 text-center">
                      {rank === 1 ? <div className="text-5xl">🥇</div>
                        : rank === 2 ? <div className="text-5xl">🥈</div>
                        : rank === 3 ? <div className="text-5xl">🥉</div>
                        : <div className="text-3xl font-black text-gray-400">#{rank}</div>}
                    </div>

                    {/* Avatar initial */}
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                      {entry.username.charAt(0).toUpperCase()}
                    </div>

                    {/* Username */}
                    <div className="flex-1">
                      <div className={`font-bold text-lg ${isHighlighted ? 'text-purple-300' : 'text-white'}`}>
                        {entry.username}
                        {isHighlighted && (
                          <span className="ml-2 text-xs bg-purple-500/30 text-purple-300 px-2 py-1 rounded">YOU</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Score */}
                    <div className={`text-3xl font-black ${
                      rank === 1 ? 'text-yellow-400' :
                      rank === 2 ? 'text-gray-400' :
                      rank === 3 ? 'text-orange-400' :
                      isHighlighted ? 'text-purple-400' : 'text-white'
                    }`}>
                      {entry.score?.toLocaleString() ?? 0}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-8 flex justify-center gap-4 flex-wrap">
          <button
            onClick={() => router.push('/game')}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-black text-xl transition-all hover:scale-105 shadow-lg shadow-purple-500/30"
          >
            ▶️ Play Solo
          </button>
          <button
            onClick={() => router.push('/tournaments')}
            className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-black text-xl transition-all hover:scale-105 shadow-lg shadow-green-500/30"
          >
            🏆 Tournaments
          </button>
          <button
            onClick={fetchLeaderboard}
            className="px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold text-lg transition-all"
          >
            🔄 Refresh
          </button>
        </div>

        <div className="mt-12 text-center text-gray-400 text-sm">
          <p>Solo leaderboard shows the top 20 all-time scores from single-player games.</p>
          <p className="mt-2">Want to compete head-to-head? Join a tournament!</p>
        </div>
      </div>
    </div>
  );
}

export default function SoloLeaderboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-purple-900">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    }>
      <SoloLeaderboardContent />
    </Suspense>
  );
}
