// app/api/tournaments/[id]/leaderboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    const tournamentId = params.id;

    const { data: tournament } = await supabase
      .from('tournaments')
      .select('id, tournament_code, status, started_at, ended_at')
      .eq('id', tournamentId)
      .single();

    if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });

    // Finished: serve from tournament_results (rank baked in, username snapshotted)
    if (tournament.status === 'finished') {
      const { data: results } = await supabase
        .from('tournament_results')
        .select('user_id, username, rank, final_score, balls_dropped, merges_completed, game_duration_seconds')
        .eq('tournament_id', tournamentId)
        .order('rank', { ascending: true });
      return NextResponse.json({ success: true, tournament, leaderboard: results || [], is_final: true });
    }

    // Active/waiting: serve live scores with username joined from users (uuid FK — direct join)
    const { data: scores } = await supabase
      .from('tournament_scores')
      .select(`
        user_id,
        score,
        finished,
        last_update,
        users ( username )
      `)
      .eq('tournament_id', tournamentId)
      .order('score', { ascending: false });

    const leaderboard = (scores || []).map((s: any, i: number) => ({
      user_id:     s.user_id,
      username:    s.users?.username || 'Unknown',
      rank:        i + 1,
      score:       s.score,
      finished:    s.finished,
      last_update: s.last_update,
    }));

    return NextResponse.json({ success: true, tournament, leaderboard, is_final: false });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
