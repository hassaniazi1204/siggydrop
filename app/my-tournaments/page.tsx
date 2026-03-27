'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Tournament {
  id: string;
  tournament_code: string;
  status: string;
  max_players: number;
  duration_minutes: number;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  participant_count?: number;
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  waiting:  { label: 'Waiting',  dot: 'bg-yellow-400', text: 'text-yellow-400' },
  running:  { label: 'Live',     dot: 'bg-green-400 animate-pulse', text: 'text-green-400' },
  finished: { label: 'Finished', dot: 'bg-white/20',   text: 'text-white/40'  },
};

export default function MyTournamentsPage() {
  const router = useRouter();
  const { status } = useSession();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/'); return; }
    if (status === 'authenticated') fetchMyTournaments();
  }, [status]);

  const fetchMyTournaments = async () => {
    try {
      const meRes = await fetch('/api/user/me');
      if (!meRes.ok) return;
      const me = await meRes.json();
      const { data, error } = await supabase
        .from('tournaments').select('*')
        .eq('created_by', me.id)
        .order('created_at', { ascending: false });
      if (error || !data) return;
      const withCounts = await Promise.all(data.map(async t => {
        const { count } = await supabase
          .from('tournament_participants')
          .select('*', { count: 'exact', head: true })
          .eq('tournament_id', t.id);
        return { ...t, participant_count: count || 0 };
      }));
      setTournaments(withCounts);
    } finally { setLoading(false); }
  };

  if (status === 'loading' || loading) return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="w-10 h-10 border-2 border-[#40FFAF] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-black px-4 py-12">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-10">
          <div>
            <p className="text-xs font-bold text-[#40FFAF] uppercase tracking-[0.2em] mb-2">My Arena</p>
            <h1 className="text-4xl font-black text-white tracking-tight">My Tournaments</h1>
            <p className="text-white/35 text-sm mt-1">Tournaments you've created</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.push('/')}>← Back</Button>
        </div>

        {/* Empty state */}
        {tournaments.length === 0 ? (
          <div className="rounded-2xl border border-white/8 p-16 text-center">
            <div className="text-5xl mb-4">🏆</div>
            <h2 className="text-xl font-black text-white mb-2">No tournaments yet</h2>
            <p className="text-white/35 text-sm mb-6">Create your first tournament to get started</p>
            <Button variant="purple" size="md" onClick={() => router.push('/tournaments')}>
              Create Tournament
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {tournaments.map(t => {
              const cfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.waiting;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    if (t.status === 'running')       router.push(`/tournament/${t.id}/play`);
                    else if (t.status === 'finished') router.push(`/tournament/${t.id}/results`);
                    else                              router.push(`/tournament/${t.id}`);
                  }}
                  className="w-full text-left p-5 rounded-2xl border border-white/8 bg-white/2 hover:bg-white/5 hover:border-white/16 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3 mb-4">
                    {/* Status pill */}
                    <div className="flex items-center gap-2">
                      <div className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
                      <span className={cn('text-xs font-bold uppercase tracking-wider', cfg.text)}>
                        {cfg.label}
                      </span>
                    </div>
                    {/* Code */}
                    <span className="ml-auto font-mono text-xs text-white/30">
                      Code: <span className="text-[#8840FF] font-bold">{t.tournament_code}</span>
                    </span>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    {[
                      { label: 'Players',  value: `${t.participant_count} / ${t.max_players}` },
                      { label: 'Duration', value: `${t.duration_minutes}m` },
                      { label: 'Created',  value: new Date(t.created_at).toLocaleDateString() },
                      { label: 'Started',  value: t.started_at ? new Date(t.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—' },
                    ].map(s => (
                      <div key={s.label}>
                        <p className="text-white/30 text-[10px] uppercase tracking-wider mb-0.5">{s.label}</p>
                        <p className="text-white font-bold text-sm">{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* CTA hint */}
                  <div className="flex items-center gap-1.5 text-xs text-white/25 group-hover:text-[#40FFAF] transition-colors">
                    <span>
                      {t.status === 'waiting'  && 'Manage tournament'}
                      {t.status === 'running'  && 'View live game'}
                      {t.status === 'finished' && 'View results'}
                    </span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:translate-x-0.5 transition-transform">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
