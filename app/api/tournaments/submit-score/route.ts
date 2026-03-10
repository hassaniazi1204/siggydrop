// app/api/tournaments/submit-score/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';

const MAX_SCORE_PER_BALL        = 5000;
const MAX_GAME_DURATION_SECONDS = 600;

async function resolveUserId(supabase: any, session: any): Promise<string | null> {
  const nextauthId = (session.user as any).id || session.user.email;
  if (!nextauthId) return null;
  const { data } = await supabase.from('users').select('id').eq('nextauth_id', nextauthId).single();
  return data?.id ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    const userId = await resolveUserId(supabase, session);
    if (!userId) return NextResponse.json({ error: 'Failed to resolve user' }, { status: 500 });

    const { tournament_id, score, is_final = false, game_metrics = {} } = await request.json();

    if (!tournament_id || typeof score !== 'number' || score < 0)
      return NextResponse.json({ error: 'tournament_id and valid score required' }, { status: 400 });

    const { balls_dropped = 0, merges_completed = 0, game_duration_seconds = 0 } = game_metrics;

    if (merges_completed > balls_dropped && balls_dropped > 0)
      return NextResponse.json({ error: 'Invalid game metrics' }, { status: 400 });
    if (balls_dropped > 0 && score > balls_dropped * MAX_SCORE_PER_BALL)
      return NextResponse.json({ error: 'Score exceeds plausible maximum' }, { status: 400 });
    if (game_duration_seconds > MAX_GAME_DURATION_SECONDS)
      return NextResponse.json({ error: 'Game duration exceeds maximum' }, { status: 400 });

    const { data: tournament } = await supabase.from('tournaments').select('status').eq('id', tournament_id).single();
    if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    if (tournament.status !== 'active') return NextResponse.json({ error: 'Tournament is not active' }, { status: 400 });

    await supabase.from('tournament_scores').upsert({
      tournament_id, user_id: userId, score, balls_dropped,
      merges_completed, game_duration_seconds, finished: is_final,
      last_update: new Date().toISOString(),
    }, { onConflict: 'tournament_id,user_id' });

    await supabase.from('tournament_participants')
      .update({ status: is_final ? 'finished' : 'playing', game_ended_at: is_final ? new Date().toISOString() : null })
      .eq('tournament_id', tournament_id).eq('user_id', userId);

    if (is_final) {
      const { count: total }    = await supabase.from('tournament_scores').select('*', { count: 'exact', head: true }).eq('tournament_id', tournament_id);
      const { count: finished } = await supabase.from('tournament_scores').select('*', { count: 'exact', head: true }).eq('tournament_id', tournament_id).eq('finished', true);
      if (total !== null && finished !== null && finished >= total) {
        await fetch(`${process.env.NEXTAUTH_URL}/api/tournaments/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tournamentId: tournament_id }),
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
