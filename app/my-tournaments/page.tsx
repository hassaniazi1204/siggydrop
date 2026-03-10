'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { createClient } from '@/utils/supabase/client';

interface Tournament {
  id: string;
  tournament_code: string;
  status: string;
  max_players: number;
  created_at: string;
  started_at: string | null;
  participant_count?: number;
}

export default function MyTournamentsPage() {
  const router = useRouter();
  const { status } = useSession();
  const supabase = createClient();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/'); return; }
    if (status === 'authenticated') fetchMyTournaments();
  }, [status]);

  const fetchMyTournaments = async () => {
    try {
      const meRes = await fetch('/api/user/me');
      if (!meRes.ok) { setLoading(false); return; }
      const me = await meRes.json();

      const { data, error } = await supabase
        .from('tournaments').select('*')
        .eq('created_by', me.id)
        .order('created_at', { ascending: false });

      if (error || !data) { setLoading(false); return; }

      const withCounts = await Promise.all(data.map(async t => {
        const { count } = await supabase.from('tournament_participants')
          .select('*', { count: 'exact', head: true }).eq('tournament_id', t.id);
        return { ...t, participant_count: count || 0 };
      }));

      setTournaments(withCounts);
    } finally {
      setLoading(false);
    }
  };

  const badge = (s: string) => {
    const m: Record<string, [string, string, string]> = {
      waiting:  ['bg-yellow-500/20', 'text-yellow-400', 'Waiting'],
      starting: ['bg-blue-500/20',   'text-blue-400',   'Starting'],
      active:   ['bg-green-500/20',  'text-green-400',  'Active'],
      finished: ['bg-gray-500/20',   'text-gray-400',   'Finished'],
      cancelled:['bg-red-500/20',    'text-red-400',    'Cancelled'],
    };
    const [bg, text, label] = m[s] || m.waiting;
    return <span className={`px-3 py-1 rounded-full text-xs font-bold ${bg} ${text}`}>{label}</span>;
  };

  if (status === 'loading' || loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-purple-900">
      <div className="text-white text-2xl">Loading your tournaments...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-purple-900 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">My Tournaments</h1>
            <p className="text-gray-400">Tournaments you've created</p>
          </div>
          <button onClick={() => router.push('/')} className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold">← Back</button>
        </div>

        {tournaments.length === 0 ? (
          <div className="bg-gray-900/80 border-2 border-gray-700 rounded-2xl p-12 text-center">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-2xl font-black text-white mb-2">No Tournaments Yet</h2>
            <p className="text-gray-400 mb-6">Create your first tournament to get started</p>
            <button onClick={() => router.push('/tournaments')} className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold">Create Tournament</button>
          </div>
        ) : (
          <div className="grid gap-4">
            {tournaments.map(t => (
              <div key={t.id} onClick={() => {
                if (t.status === 'active') router.push(`/tournament/${t.id}/play`);
                else if (t.status === 'finished') router.push(`/tournament/${t.id}/results`);
                else router.push(`/tournament/${t.id}`);
              }} className="bg-gray-900/80 border-2 border-gray-700 hover:border-purple-500 rounded-2xl p-6 cursor-pointer transition-all hover:scale-[1.02]">
                <div className="flex items-center gap-3 mb-4">
                  {badge(t.status)}
                  <span className="text-gray-400 text-sm font-mono">Code: <span className="text-purple-400 font-bold">{t.tournament_code}</span></span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div><p className="text-gray-500 text-xs mb-1">Players</p><p className="text-white font-bold">{t.participant_count} / {t.max_players}</p></div>
                  <div><p className="text-gray-500 text-xs mb-1">Created</p><p className="text-white font-bold">{new Date(t.created_at).toLocaleDateString()}</p></div>
                  <div><p className="text-gray-500 text-xs mb-1">Started</p><p className="text-white font-bold">{t.started_at ? new Date(t.started_at).toLocaleTimeString() : 'Not yet'}</p></div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <p className="text-purple-400 text-sm font-bold">
                    {t.status === 'waiting' && '→ Click to manage tournament'}
                    {t.status === 'active' && '→ Click to view live game'}
                    {t.status === 'finished' && '→ Click to view results'}
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
