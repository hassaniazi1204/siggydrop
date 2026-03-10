// app/api/tournaments/end/route.ts
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { tournamentId } = await request.json();
    if (!tournamentId) return NextResponse.json({ error: 'tournamentId required' }, { status: 400 });

    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    const { data: tournament } = await supabase.from('tournaments').select('status').eq('id', tournamentId).single();
    if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    if (tournament.status === 'finished') return NextResponse.json({ success: true, message: 'Already finished' });
    if (tournament.status !== 'active') return NextResponse.json({ error: 'Tournament not active' }, { status: 400 });

    // Fetch scores ordered by rank
    const { data: scores } = await supabase
      .from('tournament_scores')
      .select('user_id, score, balls_dropped, merges_completed, game_duration_seconds')
      .eq('tournament_id', tournamentId)
      .order('score', { ascending: false });

    if (!scores?.length) return NextResponse.json({ error: 'No scores found' }, { status: 404 });

    // Fetch usernames from users table (uuid join — proper FK)
    const userIds = scores.map(s => s.user_id);
    const { data: users } = await supabase.from('users').select('id, username').in('id', userIds);
    const usernameMap = new Map((users || []).map(u => [u.id, u.username]));

    // Build results with rank
    const results = scores.map((s, i) => ({
      tournament_id:         tournamentId,
      user_id:               s.user_id,
      username:              usernameMap.get(s.user_id) || 'Unknown',
      rank:                  i + 1,
      final_score:           s.score,
      balls_dropped:         s.balls_dropped,
      merges_completed:      s.merges_completed,
      game_duration_seconds: s.game_duration_seconds,
    }));

    await supabase.from('tournament_results').upsert(results, { onConflict: 'tournament_id,user_id' });
    await supabase.from('tournaments').update({ status: 'finished', ended_at: new Date().toISOString() }).eq('id', tournamentId);

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
