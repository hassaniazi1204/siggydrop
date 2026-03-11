'use client';
// LiveLeaderboard.tsx
// Improvement 1: framer-motion `layout` + `AnimatePresence` for smooth rank transitions.
// Rows physically slide to their new position instead of jumping.
// All realtime patch logic preserved from previous version.

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

interface Entry {
  user_id:  string;
  username: string;
  score:    number;
  finished: boolean;
}

interface Props {
  tournamentId:   string;
  currentUserId?: string;
  compact?:       boolean;
}

// Score counter that animates from old value to new value
function AnimatedScore({ value, compact }: { value: number; compact: boolean }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (value === prev.current) return;
    const start   = prev.current;
    const end     = value;
    const delta   = end - start;
    const duration = Math.min(600, Math.abs(delta) / 10 + 200); // faster for bigger jumps
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed  = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + delta * eased));
      if (progress < 1) requestAnimationFrame(tick);
      else prev.current = value;
    };

    requestAnimationFrame(tick);
  }, [value]);

  return (
    <span className={`font-bold tabular-nums flex-shrink-0 transition-colors duration-300
      ${compact ? 'text-base' : 'text-xl'}
      ${display !== prev.current ? 'text-yellow-300' : 'text-purple-200'}
    `}>
      {display.toLocaleString()}
    </span>
  );
}

export default function LiveLeaderboard({ tournamentId, currentUserId, compact = false }: Props) {
  const [entries, setEntries]   = useState<Entry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const prevRanks               = useRef<Map<string, number>>(new Map());
  const supabase                = createClient();

  // ── Initial load ──────────────────────────────────────────────────────────
  const initialLoad = useCallback(async () => {
    try {
      const { data: scores, error: scoresError } = await supabase
        .from('tournament_scores')
        .select('user_id, score, finished')
        .eq('tournament_id', tournamentId)
        .order('score', { ascending: false });

      if (scoresError) throw scoresError;
      if (!scores?.length) { setLoading(false); return; }

      const userIds = scores.map(s => s.user_id);
      const { data: users } = await supabase
        .from('users').select('id, username').in('id', userIds);
      const nameMap = new Map((users || []).map(u => [u.id, u.username]));

      const list: Entry[] = scores.map(s => ({
        user_id:  s.user_id,
        username: nameMap.get(s.user_id) || 'Player',
        score:    s.score,
        finished: s.finished,
      }));

      setEntries(list);
      list.forEach((e, i) => prevRanks.current.set(e.user_id, i));
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  // ── Realtime patch: only touch the changed player ─────────────────────────
  const patchEntry = useCallback((payload: any) => {
    const updated = payload.new;
    if (!updated) return;

    setEntries(prev => {
      let found = false;
      const patched = prev.map(e => {
        if (e.user_id === updated.user_id) {
          found = true;
          return { ...e, score: updated.score ?? e.score, finished: updated.finished ?? e.finished };
        }
        return e;
      });

      // Brand-new player: fetch username async then insert
      if (!found) {
        supabase.from('users').select('id, username').eq('id', updated.user_id).single()
          .then(({ data }) => {
            setEntries(cur => {
              const newEntry: Entry = {
                user_id:  updated.user_id,
                username: data?.username || 'Player',
                score:    updated.score ?? 0,
                finished: updated.finished ?? false,
              };
              return [...cur, newEntry].sort((a, b) => b.score - a.score);
            });
          });
        return prev;
      }

      // Re-sort and update prevRanks
      const sorted = [...patched].sort((a, b) => b.score - a.score);
      sorted.forEach((e, i) => prevRanks.current.set(e.user_id, i));
      return sorted;
    });
  }, [supabase]);

  useEffect(() => {
    initialLoad();
    const channel = supabase
      .channel(`leaderboard:${tournamentId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tournament_scores', filter: `tournament_id=eq.${tournamentId}` }, patchEntry)
      .on('postgres_changes', { event: 'UPDATE',  schema: 'public', table: 'tournament_scores', filter: `tournament_id=eq.${tournamentId}` }, patchEntry)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tournamentId, initialLoad, patchEntry]);

  // ── Rank badge colours ─────────────────────────────────────────────────────
  const rankStyle = (i: number) =>
    i === 0 ? 'bg-yellow-500 text-black shadow-yellow-500/40' :
    i === 1 ? 'bg-slate-300 text-black shadow-slate-300/30' :
    i === 2 ? 'bg-amber-600 text-white shadow-amber-600/30' :
              'bg-purple-800 text-purple-300';

  // ── States ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className={`bg-purple-900/30 rounded-xl border border-purple-500/20 ${compact ? 'p-3' : 'p-6'}`}>
      <Header compact={compact} />
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    </div>
  );

  if (error) return (
    <div className={`bg-purple-900/30 rounded-xl border border-purple-500/20 ${compact ? 'p-3' : 'p-6'}`}>
      <Header compact={compact} />
      <div className="text-center text-red-400 py-4 text-sm">
        {error}
        <br />
        <button onClick={initialLoad} className="mt-2 px-4 py-2 bg-purple-600 rounded-lg text-white text-sm hover:bg-purple-700 transition-colors">
          Retry
        </button>
      </div>
    </div>
  );

  return (
    <div className={`bg-purple-900/30 rounded-xl border border-purple-500/20 ${compact ? 'p-3' : 'p-6'}`}>
      <Header compact={compact} />

      {entries.length === 0 ? (
        <p className={`text-center text-gray-400 ${compact ? 'py-4 text-sm' : 'py-8'}`}>
          Waiting for players to start...
        </p>
      ) : (
        // motion.div with layout on the container — children animate their own layout changes
        <motion.div layout className={compact ? 'space-y-1' : 'space-y-2'}>
          <AnimatePresence initial={false}>
            {entries.map((entry, i) => {
              const isMe = entry.user_id === currentUserId;
              return (
                <motion.div
                  key={entry.user_id}
                  layout                          // ← This is the magic: Framer re-positions
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{
                    layout:  { type: 'spring', stiffness: 500, damping: 40 },
                    opacity: { duration: 0.2 },
                  }}
                  className={`
                    flex items-center gap-3 rounded-lg cursor-default select-none
                    ${compact ? 'p-2' : 'p-3'}
                    ${isMe
                      ? 'bg-purple-600/40 border border-purple-400/60 shadow-lg shadow-purple-600/20'
                      : 'bg-purple-800/20 border border-transparent'}
                  `}
                >
                  {/* Rank badge */}
                  <div className={`
                    rounded-full flex items-center justify-center font-black flex-shrink-0 shadow-md
                    ${compact ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'}
                    ${rankStyle(i)}
                  `}>
                    {i + 1}
                  </div>

                  {/* Avatar initial */}
                  <div className={`
                    rounded-full bg-gradient-to-br from-purple-500 to-pink-600
                    flex items-center justify-center text-white font-bold flex-shrink-0
                    ${compact ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'}
                  `}>
                    {entry.username.charAt(0).toUpperCase()}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <div className={`text-white font-medium truncate ${compact ? 'text-sm' : 'text-base'}`}>
                      {entry.username}
                      {isMe && <span className="ml-1 text-xs text-purple-300 font-normal">(You)</span>}
                      {entry.finished && <span className="ml-1 text-xs text-green-400">✓</span>}
                    </div>
                  </div>

                  {/* Animated score counter */}
                  <AnimatedScore value={entry.score} compact={compact} />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      <p className="mt-4 text-center text-xs text-gray-600">Updates automatically in real-time</p>
    </div>
  );
}

function Header({ compact }: { compact: boolean }) {
  return (
    <h3 className={`font-bold text-purple-300 mb-4 flex items-center gap-2 ${compact ? 'text-base' : 'text-xl'}`}>
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
      </span>
      Live Leaderboard
    </h3>
  );
}
