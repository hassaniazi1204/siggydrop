'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LeaderboardEntry {
  id: number;
  username: string;
  score: number;
  created_at: string;
}

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

function SoloLeaderboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightScore, setHighlightScore] = useState<number | null>(null);

  useEffect(() => {
    const score = searchParams.get('score');
    if (score) setHighlightScore(parseInt(score));
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(d => { if (d.success) setEntries(d.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [searchParams]);

  const currentUsername = session?.user?.name || session?.user?.email?.split('@')[0];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-[#40FFAF] border-t-transparent rounded-full animate-spin" />
        <p className="text-white/50 text-sm">Loading leaderboard…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black px-4 py-12">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-10 text-center">
          <p className="text-xs font-bold text-[#40FFAF] uppercase tracking-[0.2em] mb-3">
            Solo Rankings
          </p>
          <h1 className="text-5xl font-black text-white tracking-tight">
            Leaderboard
          </h1>
          <p className="text-white/35 text-sm mt-2">Top 20 solo players</p>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-white/8 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[3rem_1fr_auto] gap-4 px-5 py-3 border-b border-white/6 bg-white/3">
            <span className="text-xs font-bold text-white/30 uppercase tracking-widest">#</span>
            <span className="text-xs font-bold text-white/30 uppercase tracking-widest">Player</span>
            <span className="text-xs font-bold text-white/30 uppercase tracking-widest text-right">Score</span>
          </div>

          {entries.length === 0 ? (
            <div className="py-16 text-center text-white/30 text-sm">
              No scores yet. Be the first!
            </div>
          ) : (
            entries.map((entry, i) => {
              const isMe = currentUsername && entry.username === currentUsername;
              const isNew = highlightScore !== null && entry.score === highlightScore && isMe;
              const rank = i + 1;

              return (
                <div
                  key={entry.id}
                  className={cn(
                    'grid grid-cols-[3rem_1fr_auto] gap-4 items-center px-5 py-4',
                    'border-b border-white/5 last:border-0 transition-colors',
                    isNew  && 'bg-[#40FFAF]/8 border-l-2 border-l-[#40FFAF]',
                    isMe && !isNew && 'bg-[#8840FF]/6',
                    !isMe  && 'hover:bg-white/3',
                  )}
                >
                  {/* Rank */}
                  <div className="text-center">
                    {rank <= 3
                      ? <span className="text-xl">{RANK_MEDALS[rank - 1]}</span>
                      : <span className="text-sm font-bold text-white/30">#{rank}</span>
                    }
                  </div>

                  {/* Player */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#8840FF] to-[#E554E8] flex items-center justify-center text-white text-sm font-black flex-shrink-0">
                      {entry.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          'font-bold text-sm truncate',
                          isMe ? 'text-[#40FFAF]' : 'text-white'
                        )}>
                          {entry.username}
                        </span>
                        {isMe && (
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-[#8840FF]/30 text-[#8840FF] uppercase tracking-wide">
                            You
                          </span>
                        )}
                        {isNew && (
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-[#40FFAF]/20 text-[#40FFAF] uppercase tracking-wide">
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-white/25 text-xs mt-0.5">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Score */}
                  <div className={cn(
                    'font-black text-lg tabular-nums text-right',
                    rank === 1 ? 'text-yellow-400' :
                    rank === 2 ? 'text-slate-300'  :
                    rank === 3 ? 'text-amber-500'  :
                    isMe       ? 'text-[#40FFAF]'  : 'text-white'
                  )}>
                    {(entry.score || 0).toLocaleString()}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-8 justify-center">
          <Button variant="primary" size="md" onClick={() => router.push('/game')}>
            ▶ Play Solo
          </Button>
          <Button variant="ghost" size="md" onClick={() => router.push('/tournaments')}>
            🏆 Tournaments
          </Button>
        </div>

        <p className="text-center text-white/20 text-xs mt-8">
          Solo leaderboard shows top 20 players from single-player games.
        </p>
      </div>
    </div>
  );
}

export default function SoloLeaderboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-10 h-10 border-2 border-[#40FFAF] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SoloLeaderboardContent />
    </Suspense>
  );
}
