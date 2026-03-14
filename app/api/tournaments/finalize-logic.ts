// app/api/tournaments/finalize-logic.ts
// Shared finalization logic called directly by submit-score (no HTTP hop).
// Also used by the /finalize route handler for direct API calls.
// This avoids Vercel server-to-server fetch failures that caused tournaments
// to never complete when all players finished.

export async function finalizeTournament(supabase: any, tournamentId: string): Promise<{
  success: boolean;
  already_finished?: boolean;
  results?: any[];
  error?: string;
}> {
  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .select('status')
    .eq('id', tournamentId)
    .single();

  if (tErr || !tournament) return { success: false, error: 'Tournament not found' };

  // Idempotent — already finished
  if (tournament.status === 'finished') {
    const { data: existing } = await supabase
      .from('tournament_results')
      .select('user_id, username, rank, final_score')
      .eq('tournament_id', tournamentId)
      .order('rank', { ascending: true });
    return { success: true, already_finished: true, results: existing || [] };
  }

  if (tournament.status !== 'running')
    return { success: false, error: `Cannot finalize: tournament is ${tournament.status}` };

  // Read final scores
  const { data: scores, error: scoresErr } = await supabase
    .from('tournament_scores')
    .select('user_id, score, balls_dropped, merges_completed, game_duration_seconds')
    .eq('tournament_id', tournamentId)
    .order('score', { ascending: false });

  if (scoresErr) return { success: false, error: scoresErr.message };
  if (!scores?.length) return { success: false, error: 'No scores found' };

  // Join usernames
  const userIds = scores.map((s: any) => s.user_id);
  const { data: users, error: usersErr } = await supabase
    .from('users').select('id, username').in('id', userIds);
  if (usersErr) return { success: false, error: usersErr.message };

  const usernameMap = new Map((users || []).map((u: any) => [u.id, u.username]));

  const results = scores.map((s: any, index: number) => ({
    tournament_id:         tournamentId,
    user_id:               s.user_id,
    username:              usernameMap.get(s.user_id) || 'Unknown',
    rank:                  index + 1,
    final_score:           s.score,
    balls_dropped:         s.balls_dropped         ?? 0,
    merges_completed:      s.merges_completed      ?? 0,
    game_duration_seconds: s.game_duration_seconds ?? 0,
  }));

  // DELETE old → INSERT fresh
  const { error: delErr } = await supabase
    .from('tournament_results').delete().eq('tournament_id', tournamentId);
  if (delErr) return { success: false, error: delErr.message };

  const { error: insErr } = await supabase
    .from('tournament_results').insert(results);
  if (insErr) return { success: false, error: insErr.message };

  // Race condition guard — only the first concurrent caller wins
  const { data: updated, error: updErr } = await supabase
    .from('tournaments')
    .update({ status: 'finished', ended_at: new Date().toISOString() })
    .eq('id', tournamentId)
    .eq('status', 'running')
    .select('id')
    .maybeSingle();

  if (updErr) return { success: false, error: updErr.message };

  if (!updated) {
    // Another concurrent call already finished it
    const { data: existing } = await supabase
      .from('tournament_results')
      .select('user_id, username, rank, final_score')
      .eq('tournament_id', tournamentId)
      .order('rank', { ascending: true });
    return { success: true, already_finished: true, results: existing || [] };
  }

  console.log(`[finalize] ${tournamentId} finished. ${results.length} results written.`);
  return { success: true, results };
}
