'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useSession } from 'next-auth/react';

interface Tournament {
  id: string;
  tournament_code: string;
  status: string;
  max_players: number;
  created_by: string;
}

interface Participant {
  id: string;
  user_id: string;
  status: string;
  joined_at: string;
  users: { username: string; avatar: string | null } | null;
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
  const [currentUserDbId, setCurrentUserDbId] = useState<string | null>(null);
  const tournamentId = params.id as string;

  useEffect(() => {
    if (!session?.user) return;
    fetch('/api/user/me').then(r => r.json()).then(d => { if (d.id) setCurrentUserDbId(d.id); });
  }, [session]);

  useEffect(() => {
    if (!tournamentId) { setError('Invalid tournament ID'); setLoading(false); return; }
    supabase.from('tournaments').select('*').eq('id', tournamentId).single()
      .then(({ data, error }) => {
        if (error || !data) { setError('Tournament not found'); }
        else setTournament(data);
        setLoading(false);
      });
  }, [tournamentId]);

  useEffect(() => {
    if (currentUserDbId && tournament) setIsCreator(currentUserDbId === tournament.created_by);
  }, [currentUserDbId, tournament]);

  const fetchParticipants = async () => {
    const { data } = await supabase
      .from('tournament_participants')
      .select('id, user_id, status, joined_at, users ( username, avatar )')
      .eq('tournament_id', tournamentId)
      .order('joined_at', { ascending: true });
    if (data) setParticipants(data as any);
  };

  useEffect(() => { if (tournamentId) fetchParticipants(); }, [tournamentId]);

  useEffect(() => {
    if (!tournamentId) return;
    const t = supabase.channel(`t:${tournamentId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tournaments', filter: `id=eq.${tournamentId}` },
        (p) => setTournament(p.new as Tournament)).subscribe();
    const p = supabase.channel(`p:${tournamentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_participants', filter: `tournament_id=eq.${tournamentId}` },
        () => fetchParticipants()).subscribe();
    return () => { supabase.removeChannel(t); supabase.removeChannel(p); };
  }, [tournamentId]);

  useEffect(() => {
    if (!tournament) return;
    if (tournament.status === 'starting') {
      setCountdown(5);
      const iv = setInterval(() => setCountdown(prev => {
        if (prev === null || prev <= 1) { clearInterval(iv); activateTournament(); return null; }
        return prev - 1;
      }), 1000);
      return () => clearInterval(iv);
    }
    if (tournament.status === 'active') router.push(`/tournament/${tournamentId}/play`);
    if (tournament.status === 'finished') router.push(`/tournament/${tournamentId}/results`);
  }, [tournament?.status]);

  const activateTournament = () => fetch('/api/tournaments/start', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tournament_id: tournamentId }) });
  const handleStartTournament = async () => {
    if (!isCreator) return;
    const r = await fetch('/api/tournaments/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tournament_id: tournamentId }) });
    const d = await r.json();
    if (!r.ok) setError(d.error || 'Failed to start');
  };
  const copyCode = () => { if (tournament) navigator.clipboard.writeText(tournament.tournament_code); };
  const handleLeave = async () => {
    if (!window.confirm('Leave this tournament?')) return;
    const r = await fetch('/api/tournaments/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tournament_id: tournamentId }) });
    if (r.ok) router.push('/tournaments');
    else { const d = await r.json(); setError(d.error || 'Failed to leave'); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-purple-900"><div className="text-white text-2xl">Loading tournament...</div></div>;
  if (error || !tournament) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-purple-900">
      <div className="text-center">
        <h1 className="text-4xl font-black text-red-400 mb-4">Error</h1>
        <p className="text-white text-xl mb-8">{error || 'Tournament not found'}</p>
        <button onClick={() => router.push('/tournaments')} className="px-6 py-3 bg-purple-600 text-white rounded-lg font-bold">Back to Tournaments</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-purple-900 p-8">
      {countdown !== null && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <h1 className="text-9xl font-black text-white mb-4 animate-pulse">{countdown}</h1>
            <p className="text-3xl text-purple-400 font-bold">Tournament Starting...</p>
          </div>
        </div>
      )}
      <div className="max-w-6xl mx-auto">
        <button onClick={() => router.push('/tournaments')} className="mb-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg">← Back</button>
        <div className="bg-gray-900/50 backdrop-blur-md border-2 border-purple-500/30 rounded-2xl p-8 mb-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-4xl font-black text-white mb-2">Tournament Lobby</h1>
              <div className={`text-xl font-bold ${tournament.status === 'waiting' ? 'text-yellow-400' : tournament.status === 'active' ? 'text-green-400' : 'text-gray-400'}`}>{tournament.status.toUpperCase()}</div>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600/20 border-2 border-purple-500 rounded-lg mb-2">
                <span className="text-white font-mono text-2xl font-bold">{tournament.tournament_code}</span>
                <button onClick={copyCode} className="p-1 hover:bg-purple-500/20 rounded" title="Copy">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </button>
              </div>
              <p className="text-sm text-gray-400">Share this code to invite players</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-black/30 rounded-xl p-4 text-center"><div className="text-3xl font-black text-green-400 mb-1">{participants.length}/{tournament.max_players}</div><div className="text-sm text-gray-400">Players</div></div>
            <div className="bg-black/30 rounded-xl p-4 text-center"><div className="text-3xl font-black text-purple-400 mb-1">{tournament.status.toUpperCase()}</div><div className="text-sm text-gray-400">Status</div></div>
          </div>
        </div>

        <div className="bg-gray-900/50 backdrop-blur-md border-2 border-purple-500/30 rounded-2xl p-8 mb-8">
          <h2 className="text-2xl font-black text-white mb-6">Players ({participants.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {participants.map(p => {
              const username = p.users?.username || 'Unknown';
              return (
                <div key={p.id} className="flex items-center gap-3 p-4 bg-black/30 rounded-xl border border-gray-700 hover:border-purple-500/50 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">{username.charAt(0).toUpperCase()}</div>
                  <div className="flex-1">
                    <div className="text-white font-semibold">
                      {username}
                      {p.user_id === tournament.created_by && <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">HOST</span>}
                      {p.user_id === currentUserDbId && <span className="ml-2 text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">YOU</span>}
                    </div>
                    <div className="text-xs text-gray-400">Joined {new Date(p.joined_at).toLocaleTimeString()}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {tournament.status === 'waiting' && (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              {isCreator ? (
                <button onClick={handleStartTournament} disabled={participants.length < 2}
                  className={`px-12 py-4 rounded-xl font-black text-xl transition-all ${participants.length < 2 ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:scale-105 shadow-lg shadow-green-500/30'}`}>
                  {participants.length < 2 ? 'Waiting for Players...' : '🚀 START TOURNAMENT'}
                </button>
              ) : <div className="text-white text-xl">Waiting for host to start...</div>}
            </div>
            <button onClick={handleLeave} className="px-8 py-3 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-xl font-bold border-2 border-red-500/30">← Leave Tournament</button>
          </div>
        )}
        {error && <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-center">{error}</div>}
      </div>
    </div>
  );
}
