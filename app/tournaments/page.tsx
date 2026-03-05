'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useSession } from 'next-auth/react';
import CreateTournamentModal from '@/components/CreateTournamentModal';
import JoinTournamentModal from '@/components/JoinTournamentModal';

interface Tournament {
  id: string;
  tournament_code: string;
  name: string;
  description: string;
  duration_minutes: number;
  max_players: number;
  status: string;
  creator_username: string;
  created_at: string;
  current_players?: number;
}

export default function TournamentsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const supabase = createClient();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'waiting' | 'active'>('all');

  // Fetch tournaments
  const fetchTournaments = async () => {
    const { data, error } = await supabase
      .from('active_tournaments')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setTournaments(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTournaments();
  }, []);

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('tournaments-list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournaments',
        },
        () => {
          fetchTournaments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredTournaments = tournaments.filter(t => {
    // Always hide finished and cancelled tournaments
    if (t.status === 'finished' || t.status === 'cancelled') return false;
    
    if (filter === 'all') return true;
    return t.status === filter;
  });

  const getStatusBadge = (status: string) => {
    const badges = {
      waiting: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Waiting' },
      starting: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Starting Soon' },
      active: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Active' },
    };

    const badge = badges[status as keyof typeof badges] || badges.waiting;

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const handleJoinTournament = (tournamentId: string) => {
    if (!session) {
      alert('Please log in to join tournaments');
      return;
    }
    router.push(`/tournament/${tournamentId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-purple-900 p-8">
      {/* Modals */}
      <CreateTournamentModal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
      
      <JoinTournamentModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
      />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-5xl font-black text-white mb-2">
                🏆 Tournaments
              </h1>
              <p className="text-xl text-gray-400">
                Compete against players worldwide in real-time tournaments
              </p>
            </div>

            <button
              onClick={() => router.push('/game')}
              className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold transition-colors"
            >
              ← Back to Game
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => {
                if (!session) {
                  alert('Please log in to create tournaments');
                  return;
                }
                setShowCreateModal(true);
              }}
              className="flex-1 px-8 py-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-black text-xl transition-all hover:scale-105 shadow-lg"
            >
              ➕ Create Tournament
            </button>

            <button
              onClick={() => {
                if (!session) {
                  alert('Please log in to join tournaments');
                  return;
                }
                setShowJoinModal(true);
              }}
              className="flex-1 px-8 py-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-black text-xl transition-all hover:scale-105 shadow-lg"
            >
              🎮 Join with Code
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-8 flex gap-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-6 py-3 rounded-lg font-bold transition-colors ${
              filter === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            All Tournaments
          </button>
          <button
            onClick={() => setFilter('waiting')}
            className={`px-6 py-3 rounded-lg font-bold transition-colors ${
              filter === 'waiting'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Open to Join
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-6 py-3 rounded-lg font-bold transition-colors ${
              filter === 'active'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            In Progress
          </button>
        </div>

        {/* Tournaments Grid */}
        {loading ? (
          <div className="text-center py-20">
            <div className="text-white text-2xl">Loading tournaments...</div>
          </div>
        ) : filteredTournaments.length === 0 ? (
          <div className="text-center py-20 bg-gray-900/50 rounded-2xl border-2 border-gray-700">
            <div className="text-6xl mb-4">🎮</div>
            <h3 className="text-2xl font-black text-white mb-2">No Tournaments Found</h3>
            <p className="text-gray-400 mb-6">Be the first to create one!</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-colors"
            >
              Create Tournament
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTournaments.map((tournament) => (
              <div
                key={tournament.id}
                className="bg-gray-900/50 backdrop-blur-md border-2 border-purple-500/30 rounded-2xl p-6 hover:border-purple-500 transition-all hover:scale-105 cursor-pointer"
                onClick={() => handleJoinTournament(tournament.id)}
              >
                {/* Status Badge */}
                <div className="flex justify-between items-start mb-4">
                  {getStatusBadge(tournament.status)}
                  <div className="text-right">
                    <div className="text-sm text-gray-400">Code</div>
                    <div className="text-lg font-mono font-black text-purple-400">
                      {tournament.tournament_code}
                    </div>
                  </div>
                </div>

                {/* Tournament Name */}
                <h3 className="text-2xl font-black text-white mb-2 truncate">
                  {tournament.name}
                </h3>

                {/* Description */}
                {tournament.description && (
                  <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                    {tournament.description}
                  </p>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-black/30 rounded-lg p-3 text-center">
                    <div className="text-2xl font-black text-purple-400">
                      {tournament.duration_minutes}
                    </div>
                    <div className="text-xs text-gray-400">Minutes</div>
                  </div>

                  <div className="bg-black/30 rounded-lg p-3 text-center">
                    <div className="text-2xl font-black text-green-400">
                      {tournament.current_players || 0}/{tournament.max_players}
                    </div>
                    <div className="text-xs text-gray-400">Players</div>
                  </div>
                </div>

                {/* Host */}
                <div className="text-sm text-gray-400 mb-4">
                  Host: <span className="text-white font-semibold">{tournament.creator_username}</span>
                </div>

                {/* Join Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleJoinTournament(tournament.id);
                  }}
                  className={`w-full py-3 rounded-xl font-bold transition-all ${
                    tournament.status === 'waiting'
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : tournament.status === 'active'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  }`}
                  disabled={tournament.status !== 'waiting' && tournament.status !== 'active'}
                >
                  {tournament.status === 'waiting' ? 'Join Tournament' :
                   tournament.status === 'active' ? 'Watch Live' :
                   'Starting Soon'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
