'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useSession } from 'next-auth/react';

interface Tournament {
  id: string;
  tournament_code: string;
  name: string;
  description: string;
  duration_minutes: number;
  max_players: number;
  status: string;
  created_by: string;
  creator_username: string;
  actual_start_time: string | null;
  end_time: string | null;
  auto_start_enabled: boolean;
  auto_start_player_count: number | null;
}

interface Participant {
  id: string;
  user_id: string;
  username: string;
  profile_image: string | null;
  status: string;
  joined_at: string;
}

export default function TournamentLobby() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const supabase = createClient();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreator, setIsCreator] = useState(false);

  const tournamentId = params.id as string;

  // Fetch tournament data
  useEffect(() => {
    if (!tournamentId) return;

    const fetchTournament = async () => {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (error) {
        setError('Tournament not found');
        setLoading(false);
        return;
      }

      setTournament(data);
      setIsCreator((session?.user as any)?.id === data.created_by);
      setLoading(false);
    };

    fetchTournament();
  }, [tournamentId, session]);

  // Fetch participants
  useEffect(() => {
    if (!tournamentId) return;

    const fetchParticipants = async () => {
      const { data } = await supabase
        .from('tournament_participants')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('joined_at', { ascending: true });

      if (data) {
        setParticipants(data);
      }
    };

    fetchParticipants();
  }, [tournamentId]);

  // Real-time subscriptions
  useEffect(() => {
    if (!tournamentId) return;

    // Subscribe to tournament changes
    const tournamentChannel = supabase
      .channel(`tournament:${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tournaments',
          filter: `id=eq.${tournamentId}`,
        },
        (payload) => {
          setTournament(payload.new as Tournament);
        }
      )
      .subscribe();

    // Subscribe to participant changes
    const participantsChannel = supabase
      .channel(`participants:${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_participants',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        async () => {
          // Refetch participants when changes occur
          const { data } = await supabase
            .from('tournament_participants')
            .select('*')
            .eq('tournament_id', tournamentId)
            .order('joined_at', { ascending: true });

          if (data) {
            setParticipants(data);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tournamentChannel);
      supabase.removeChannel(participantsChannel);
    };
  }, [tournamentId]);

  // Handle tournament status changes
  useEffect(() => {
    if (!tournament) return;

    if (tournament.status === 'starting') {
      // Start 5-second countdown
      setCountdown(5);
      
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            // Activate tournament
            activateTournament();
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }

    if (tournament.status === 'active') {
      // Redirect to game
      router.push(`/tournament/${tournamentId}/play`);
    }

    if (tournament.status === 'finished') {
      // Redirect to results
      router.push(`/tournament/${tournamentId}/results`);
    }
  }, [tournament?.status]);

  // Activate tournament after countdown
  const activateTournament = async () => {
    await fetch('/api/tournaments/start', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournament_id: tournamentId }),
    });
  };

  // Start tournament (creator only)
  const handleStartTournament = async () => {
    if (!isCreator) return;

    try {
      const response = await fetch('/api/tournaments/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournament_id: tournamentId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to start tournament');
      }
    } catch (error) {
      setError('Failed to start tournament');
    }
  };

  // Copy tournament code
  const copyCode = () => {
    if (tournament) {
      navigator.clipboard.writeText(tournament.tournament_code);
      // Show toast or notification
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-purple-900">
        <div className="text-white text-2xl">Loading tournament...</div>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-purple-900">
        <div className="text-center">
          <h1 className="text-4xl font-black text-red-400 mb-4">Error</h1>
          <p className="text-white text-xl mb-8">{error || 'Tournament not found'}</p>
          <button
            onClick={() => router.push('/tournaments')}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-colors"
          >
            Back to Tournaments
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-purple-900 p-8">
      {/* Countdown Overlay */}
      {countdown !== null && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <h1 className="text-9xl font-black text-white mb-4 animate-pulse">
              {countdown}
            </h1>
            <p className="text-3xl text-purple-400 font-bold">
              Tournament Starting...
            </p>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/tournaments')}
            className="mb-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            ← Back
          </button>
          
          <div className="bg-gray-900/50 backdrop-blur-md border-2 border-purple-500/30 rounded-2xl p-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-4xl font-black text-white mb-2">
                  {tournament.name}
                </h1>
                {tournament.description && (
                  <p className="text-gray-400 text-lg">{tournament.description}</p>
                )}
              </div>
              
              <div className="text-right">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600/20 border-2 border-purple-500 rounded-lg mb-2">
                  <span className="text-white font-mono text-2xl font-bold">
                    {tournament.tournament_code}
                  </span>
                  <button
                    onClick={copyCode}
                    className="p-1 hover:bg-purple-500/20 rounded transition-colors"
                    title="Copy code"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
                <p className="text-sm text-gray-400">Share this code to invite players</p>
              </div>
            </div>

            {/* Tournament Info */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-black/30 rounded-xl p-4 text-center">
                <div className="text-3xl font-black text-purple-400 mb-1">
                  {tournament.duration_minutes}
                </div>
                <div className="text-sm text-gray-400">Minutes</div>
              </div>
              
              <div className="bg-black/30 rounded-xl p-4 text-center">
                <div className="text-3xl font-black text-green-400 mb-1">
                  {participants.length}/{tournament.max_players}
                </div>
                <div className="text-sm text-gray-400">Players</div>
              </div>
              
              <div className="bg-black/30 rounded-xl p-4 text-center">
                <div className={`text-3xl font-black mb-1 ${
                  tournament.status === 'waiting' ? 'text-yellow-400' :
                  tournament.status === 'starting' ? 'text-orange-400' :
                  tournament.status === 'active' ? 'text-green-400' :
                  'text-gray-400'
                }`}>
                  {tournament.status.toUpperCase()}
                </div>
                <div className="text-sm text-gray-400">Status</div>
              </div>
            </div>

            {/* Auto-start info */}
            {tournament.auto_start_enabled && tournament.auto_start_player_count && (
              <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-blue-400 text-sm text-center">
                  🚀 Auto-start enabled: Tournament will start when {tournament.auto_start_player_count} players join
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Players List */}
        <div className="bg-gray-900/50 backdrop-blur-md border-2 border-purple-500/30 rounded-2xl p-8 mb-8">
          <h2 className="text-2xl font-black text-white mb-6">
            Players ({participants.length})
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {participants.map((participant, index) => (
              <div
                key={participant.id}
                className="flex items-center gap-3 p-4 bg-black/30 rounded-xl border border-gray-700 hover:border-purple-500/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                  {participant.profile_image ? (
                    <img
                      src={participant.profile_image}
                      alt={participant.username}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    participant.username.charAt(0).toUpperCase()
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="text-white font-semibold">
                    {participant.username}
                    {participant.user_id === tournament.created_by && (
                      <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                        HOST
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    Joined {new Date(participant.joined_at).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        {tournament.status === 'waiting' && (
          <div className="text-center">
            {isCreator ? (
              <button
                onClick={handleStartTournament}
                disabled={participants.length < 2}
                className={`px-12 py-4 rounded-xl font-black text-xl transition-all ${
                  participants.length < 2
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:scale-105 shadow-lg shadow-green-500/30'
                }`}
              >
                {participants.length < 2 ? 'Waiting for Players...' : '🚀 START TOURNAMENT'}
              </button>
            ) : (
              <div className="text-white text-xl">
                Waiting for host to start the tournament...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
