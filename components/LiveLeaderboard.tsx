'use client';
// LiveLeaderboard.tsx
// ChatGPT Steps 1 + 6: Supabase Realtime patch-only updates with rank animation.
// Subscribes to tournament_scores INSERT/UPDATE.
// On each event: patches only the changed player, re-sorts, recomputes ranks.
// Does NOT reload the entire list on every update.

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';

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

export default function LiveLeaderboard({ tournamentId, currentUserId, compact = false }: Props) {
  const [entries, setEntries]       = useState<Entry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  // Track which user_ids just changed rank so we can animate them
  const [flashIds, setFlashIds]     = useState<Set<string>>(new Set());
  const prevRanks                   = useRef<Map<string, number>>(new Map());
  const supabase                    = createClient();

  // Initial full load — needed once at mount
  const initialLoad = useCallback(async () => {
    try {
      // ChatGPT Step 2: SELECT username, score only
      const { data: scores, error: scoresError } = await supabase
        .from('tournament_scores')
        .select('user_id, score, finished')
        .eq('tournament_id', tournamentId)
        .order('score', { ascending: false });

      if (scoresError) throw scoresError;
      if (!scores?.length) { setLoading(false); return; }

      // Fetch usernames via uuid FK join
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
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [tournamentId, supabase]);

  // ChatGPT Step 1: patch only the changed player, re-sort
  const patchEntry = useCallback((payload: any) => {
    const updated = payload.new;
    if (!updated) return;

    setEntries(prev => {
      // Find & patch the changed entry
      let found = false;
      const patched = prev.map(e => {
        if (e.user_id === updated.user_id) {
          found = true;
          return { ...e, score: updated.score ?? e.score, finished: updated.finished ?? e.finished };
        }
        return e;
      });

      // New player joined mid-game — fetch their username then re-render
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

      // Re-sort by score descending
      const sorted = [...patched].sort((a, b) => b.score - a.score);

      // Detect rank changes for flash animation (ChatGPT Step 6)
      const changed = new Set<string>();
      sorted.forEach((e, i) => {
        const old = prevRanks.current.get(e.user_id);
        if (old !== undefined && old !== i) changed.add(e.user_id);
        prevRanks.current.set(e.user_id, i);
      });

      if (changed.size > 0) {
        setFlashIds(changed);
        setTimeout(() => setFlashIds(new Set()), 800);
      }

      return sorted;
    });
  }, [supabase]);

  useEffect(() => {
    initialLoad();

    // ChatGPT Step 1: subscribe to INSERT and UPDATE on tournament_scores
    const channel = supabase
      .channel(`leaderboard:${tournamentId}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'tournament_scores',
        filter: `tournament_id=eq.${tournamentId}`,
      }, patchEntry)
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'tournament_scores',
        filter: `tournament_id=eq.${tournamentId}`,
      }, patchEntry)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tournamentId, initialLoad, patchEntry]);

  const medal = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;

  if (loading) return (
    <div className={`bg-purple-900/30 rounded-lg border border-purple-500/30 ${compact ? 'p-3' : 'p-6'}`}>
      <h3 className={`font-bold text-purple-300 mb-4 ${compact ? 'text-lg' : 'text-xl'}`}>🔴 Live Leaderboard</h3>
      <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" /></div>
    </div>
  );

  if (error) return (
    <div className={`bg-purple-900/30 rounded-lg border border-purple-500/30 ${compact ? 'p-3' : 'p-6'}`}>
      <h3 className={`font-bold text-purple-300 mb-4 ${compact ? 'text-lg' : 'text-xl'}`}>🔴 Live Leaderboard</h3>
      <div className="text-center text-red-400 py-4 text-sm">
        {error}
        <br /><button onClick={initialLoad} className="mt-2 px-4 py-2 bg-purple-600 rounded text-white text-sm">Retry</button>
      </div>
    </div>
  );

  return (
    <div className={`bg-purple-900/30 rounded-lg border border-purple-500/30 ${compact ? 'p-3' : 'p-6'}`}>
      <h3 className={`font-bold text-purple-300 mb-4 flex items-center gap-2 ${compact ? 'text-lg' : 'text-xl'}`}>
        <span className="animate-pulse">🔴</span> Live Leaderboard
      </h3>

      {entries.length === 0
        ? <p className={`text-center text-gray-400 ${compact ? 'py-4 text-sm' : 'py-8'}`}>Waiting for players to start...</p>
        : <div className={compact ? 'space-y-1' : 'space-y-2'}>
            {entries.map((entry, i) => {
              const isMe      = entry.user_id === currentUserId;
              const isFlashing = flashIds.has(entry.user_id);
              const m         = medal(i);
              return (
                <div key={entry.user_id} className={`
                  flex items-center gap-3 rounded-lg transition-all duration-300
                  ${compact ? 'p-2' : 'p-3'}
                  ${isMe        ? 'bg-purple-600/40 border border-purple-400' : 'bg-purple-800/20'}
                  ${isFlashing  ? 'ring-2 ring-yellow-400 scale-[1.02]' : ''}
                `}>
                  <div className={`rounded-full flex items-center justify-center font-bold flex-shrink-0
                    ${compact ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'}
                    ${i === 0 ? 'bg-yellow-500 text-black' : i === 1 ? 'bg-gray-300 text-black' : i === 2 ? 'bg-amber-600 text-white' : 'bg-purple-700 text-purple-200'}
                  `}>
                    {m ?? i + 1}
                  </div>
                  <div className={`rounded-full bg-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0
                    ${compact ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'}`}>
                    {entry.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-white font-medium truncate ${compact ? 'text-sm' : 'text-base'}`}>
                      {entry.username}
                      {isMe && <span className="ml-2 text-xs text-purple-300">(You)</span>}
                      {entry.finished && <span className="ml-2 text-xs text-green-400">✓</span>}
                    </div>
                  </div>
                  <div className={`font-bold text-purple-200 flex-shrink-0 transition-all duration-300 ${compact ? 'text-base' : 'text-xl'} ${isFlashing ? 'text-yellow-300' : ''}`}>
                    {entry.score.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
      }
      <p className="mt-4 text-center text-xs text-gray-500">Updates automatically in real-time</p>
    </div>
  );
}
