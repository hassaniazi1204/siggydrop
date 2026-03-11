// app/api/tournaments/submit-score/route.ts
// ChatGPT Steps 4 + 7: timer-aware + anti-cheat validation
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';

const MAX_SCORE_PER_MERGE = 100;

async function resolveUserId(supabase: any, session: any): Promise<string | null> {
  const nextauthId = (session.user as any).id || session.user.email;
  if (!nextauthId) return null;
  const { data: existing } = await supabase
    .from('users').select('id').eq('nextauth_id', nextauthId).maybeSingle();
  if (existing) return existing.id;
  const username = session.user.name || session.user.email?.split('@')[0] || 'Player';
  const { data: created, error } = await supabase
    .from('users')
    .insert({ nextauth_id: nextauthId, username, email: session.user.email, avatar: session.user.image })
    .select('id').single();
  if (error) { console.error('[resolveUserId]', error.message); return null; }
  return created.id;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createClient();
    const userId = await resolveUserId(supabase, session);
    if (!userId) return NextResponse.json({ error: 'Failed to resolve user' }, { status: 500 });

    const body = await request.json();
    const { tournament_id, score, game_metrics = {} } = body;
    // Accept both field names for compatibility with existing play page
    const isFinal: boolean = body.is_final ?? body.final_score ?? false;

    if (!tournament_id || typeof score !== 'number' || score < 0)
      return NextResponse.json({ error: 'tournament_id and valid score required' }, { status: 400 });

    const { balls_dropped = 0, merges_completed = 0, game_duration_seconds = 0 } = game_metrics;

    // ChatGPT Step 7 — anti-cheat
    if (merges_completed > balls_dropped && balls_dropped > 0)
      return NextResponse.json({ error: 'Invalid: merges > balls' }, { status: 400 });
    if (merges_completed > 0 && score > merges_completed * MAX_SCORE_PER_MERGE)
      return NextResponse.json({ error: 'Invalid: score exceeds merge maximum' }, { status: 400 });

    // Get tournament + end_time
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('status, end_time')
      .eq('id', tournament_id)
      .single();

    if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    if (tournament.status !== 'active')
      return NextResponse.json({ error: 'Tournament is not active' }, { status: 400 });

    // ChatGPT Step 4 — reject if past end_time
    if (tournament.end_time && Date.now() > new Date(tournament.end_time).getTime())
      return NextResponse.json({ error: 'Tournament has finished' }, { status: 400 });

    // Upsert score (column is `score` per our migration)
    const { error: scoreError } = await supabase
      .from('tournament_scores')
      .upsert({
        tournament_id,
        user_id:               userId,
        score,
        balls_dropped,
        merges_completed,
        game_duration_seconds,
        finished:              isFinal,
        last_update:           new Date().toISOString(),
      }, { onConflict: 'tournament_id,user_id' });

    if (scoreError) {
      console.error('[submit-score] upsert error:', scoreError.message);
      return NextResponse.json({ error: scoreError.message }, { status: 500 });
    }

    // Update participant status
    await supabase.from('tournament_participants')
      .update({
        status:       isFinal ? 'finished' : 'playing',
        game_ended_at: isFinal ? new Date().toISOString() : null,
      })
      .eq('tournament_id', tournament_id)
      .eq('user_id', userId);

    // Auto-end if all players finished
    if (isFinal) {
      const { count: total }    = await supabase.from('tournament_scores')
        .select('*', { count: 'exact', head: true }).eq('tournament_id', tournament_id);
      const { count: finished } = await supabase.from('tournament_scores')
        .select('*', { count: 'exact', head: true }).eq('tournament_id', tournament_id).eq('finished', true);
      if (total !== null && finished !== null && finished >= total) {
        await fetch(`${process.env.NEXTAUTH_URL}/api/tournaments/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tournament_id }),
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[submit-score] exception:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
