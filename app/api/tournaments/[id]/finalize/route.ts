// app/api/tournaments/[id]/finalize/route.ts
// Finalizes a tournament:
//   1. Guards: only finalizes 'running' tournaments (idempotent if already 'finished')
//   2. Reads final scores from tournament_scores
//   3. Joins users for username snapshot
//   4. Assigns ranks, DELETEs old results, INSERTs fresh snapshot
//   5. Sets status = 'finished', ended_at = now()
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tournamentId = params.id;
  if (!tournamentId)
    return NextResponse.json({ error: 'tournamentId required' }, { status: 400 });

  try {
    const supabase = createClient();

    const { data: tournament, error: tErr } = await supabase
      .from('tournaments')
      .select('status')
      .eq('id', tournamentId)
      .single();

    if (tErr || !tournament)
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });

    // Idempotent — already finished, return existing results
    if (tournament.status === 'finished') {
      const { data: existing } = await supabase
        .from('tournament_results')
        .select('user_id, username, rank, final_score')
        .eq('tournament_id', tournamentId)
        .order('rank', { ascending: true });
      return NextResponse.json({ success: true, already_finished: true, results: existing });
    }

    // Only finalize running tournaments
    if (tournament.status !== 'running')
      return NextResponse.json(
        { error: `Cannot finalize: tournament is ${tournament.status}` },
        { status: 400 }
      );

    // Read final scores
    const { data: scores, error: scoresErr } = await supabase
      .from('tournament_scores')
      .select('user_id, score, balls_dropped, merges_completed, game_duration_seconds')
      .eq('tournament_id', tournamentId)
      .order('score', { ascending: false });

    if (scoresErr) throw scoresErr;
    if (!scores?.length)
      return NextResponse.json({ error: 'No scores found' }, { status: 404 });

    // Join usernames
    const userIds = scores.map(s => s.user_id);
    const { data: users, error: usersErr } = await supabase
      .from('users').select('id, username').in('id', userIds);
    if (usersErr) throw usersErr;

    const usernameMap = new Map((users || []).map(u => [u.id, u.username]));

    // Build results with ranks
    const results = scores.map((s, index) => ({
      tournament_id:         tournamentId,
      user_id:               s.user_id,
      username:              usernameMap.get(s.user_id) || 'Unknown',
      rank:                  index + 1,
      final_score:           s.score,
      balls_dropped:         s.balls_dropped         ?? 0,
      merges_completed:      s.merges_completed      ?? 0,
      game_duration_seconds: s.game_duration_seconds ?? 0,
    }));

    // DELETE old → INSERT fresh (avoids stale rows from partial previous runs)
    const { error: delErr } = await supabase
      .from('tournament_results').delete().eq('tournament_id', tournamentId);
    if (delErr) throw delErr;

    const { error: insErr } = await supabase
      .from('tournament_results').insert(results);
    if (insErr) throw insErr;

    // Race condition guard: only the first concurrent caller wins.
    // Adding .eq('status', 'running') means if two finalize calls arrive
    // simultaneously, only one will match and update — the second will
    // update 0 rows and its result snapshot becomes the canonical one.
    const { count: updatedRows, error: updErr } = await supabase
      .from('tournaments')
      .update({ status: 'finished', ended_at: new Date().toISOString() })
      .eq('id', tournamentId)
      .eq('status', 'running')   // ← race condition guard
      .select('*', { count: 'exact', head: true });

    if (updErr) throw updErr;

    // If 0 rows updated, another concurrent request already finalized — that's fine
    if (updatedRows === 0) {
      console.log(`[finalize] ${tournamentId} already finalized by concurrent request.`);
      const { data: existing } = await supabase
        .from('tournament_results')
        .select('user_id, username, rank, final_score')
        .eq('tournament_id', tournamentId)
        .order('rank', { ascending: true });
      return NextResponse.json({ success: true, already_finished: true, results: existing });
    }

    console.log(`[finalize] ${tournamentId} finished. ${results.length} results written.`);
    return NextResponse.json({ success: true, results });

  } catch (err: any) {
    console.error('[finalize] error:', err.message);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
