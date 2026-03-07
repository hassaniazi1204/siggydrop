'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { createClient } from '@/utils/supabase/client';

interface Tournament {
  id: string;
  name: string;
  tournament_code: string;
  status: string;
  duration_minutes: number;
  max_players: number;
  created_at: string;
  actual_start_time: string | null;
  participant_count?: number;
}

export default function MyTournamentsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const supabase = createClient();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
      return;
    }

    if (status === 'authenticated') {
      fetchMyTournaments();
    }
  }, [status, router]);

  const fetchMyTournaments = async () => {
    if (!session?.user) return;

    try {
      const userId = (session.user as any).id || session.user.email;

      // Get tournaments created by this user
      const { data: tournamentsData, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching tournaments:', error);
        setLoading(false);
        return;
      }

      // Get participant counts for each tournament
      const tournamentsWithCounts = await Promise.all(
        (tournamentsData || []).map(async (tournament) => {
          const { count } = await supabase
            .from('tournament_participants')
            .select('*', { count: 'exact', head: true })
            .eq('tournament_id', tournament.id);

          return {
            ...tournament,
            participant_count: count || 0,
          };
        })
      );

      setTournaments(tournamentsWithCounts);
      setLoading(false);
    } catch (error) {
      console.error('Error:', error);
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      waiting: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Waiting' },
      starting: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Starting' },
      active: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Active' },
      finished: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Finished' },
      cancelled: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Cancelled' },
    };

    const badge = badges[status as keyof typeof badges] || badges.waiting;

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-purple-900">
        <div className="text-white text-2xl">Loading your tournaments...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-purple-900 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
              My Tournaments
            </h1>
            <p className="text-gray-400">Tournaments you've created</p>
          </div>

          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold transition-colors"
          >
            ← Back
          </button>
        </div>

        {/* Tournaments List */}
        {tournaments.length === 0 ? (
          <div className="bg-gray-900/80 backdrop-blur-lg border-2 border-gray-700 rounded-2xl p-12 text-center">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-2xl font-black text-white mb-2">No Tournaments Yet</h2>
            <p className="text-gray-400 mb-6">Create your first tournament to get started</p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-bold transition-all"
            >
              Create Tournament
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {tournaments.map((tournament) => (
              <div
                key={tournament.id}
                onClick={() => {
                  if (tournament.status === 'active') {
                    router.push(`/tournament/${tournament.id}/play`);
                  } else if (tournament.status === 'finished') {
                    router.push(`/tournament/${tournament.id}/results`);
                  } else {
                    router.push(`/tournament/${tournament.id}`);
                  }
                }}
                className="bg-gray-900/80 backdrop-blur-lg border-2 border-gray-700 hover:border-purple-500 rounded-2xl p-6 cursor-pointer transition-all hover:scale-[1.02]"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-2xl font-black text-white mb-2">{tournament.name}</h3>
                    <div className="flex items-center gap-3 flex-wrap">
                      {getStatusBadge(tournament.status)}
                      <span className="text-gray-400 text-sm font-mono">
                        Code: <span className="text-purple-400 font-bold">{tournament.tournament_code}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Players</p>
                    <p className="text-white font-bold">
                      {tournament.participant_count} / {tournament.max_players}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-500 text-xs mb-1">Duration</p>
                    <p className="text-white font-bold">{tournament.duration_minutes} min</p>
                  </div>

                  <div>
                    <p className="text-gray-500 text-xs mb-1">Created</p>
                    <p className="text-white font-bold">
                      {new Date(tournament.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-500 text-xs mb-1">Started</p>
                    <p className="text-white font-bold">
                      {tournament.actual_start_time 
                        ? new Date(tournament.actual_start_time).toLocaleTimeString()
                        : 'Not yet'}
                    </p>
                  </div>
                </div>

                {/* Action Hint */}
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <p className="text-purple-400 text-sm font-bold">
                    {tournament.status === 'waiting' && '→ Click to manage tournament'}
                    {tournament.status === 'active' && '→ Click to view live game'}
                    {tournament.status === 'finished' && '→ Click to view results'}
                    {tournament.status === 'cancelled' && '→ Click to view details'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
