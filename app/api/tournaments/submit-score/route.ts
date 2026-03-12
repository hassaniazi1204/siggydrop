// app/api/tournaments/submit-score/route.ts
// Status-based guard: only accepts scores when status = 'running'
// No end_time check — status is the single source of truth.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
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
    const isFinal: boolean = body.is_final ?? false;

    if (!tournament_id || typeof score !== 'number' || score < 0)
      return NextResponse.json({ error: 'tournament_id and valid score required' }, { status: 400 });

    const { balls_dropped = 0, merges_completed = 0, game_duration_seconds = 0 } = game_metrics;

    // ── Anti-cheat ────────────────────────────────────────────────────────────
    if (merges_completed > balls_dropped && balls_dropped > 0)
      return NextResponse.json({ error: 'Invalid: merges > balls' }, { status: 400 });
    if (merges_completed > 0 && score > merges_completed * MAX_SCORE_PER_MERGE)
      return NextResponse.json({ error: 'Score exceeds merge maximum' }, { status: 400 });

    // ── Status guard — status is the only source of truth ────────────────────
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('status')
      .eq('id', tournament_id)
      .single();

    if (!tournament)
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    if (tournament.status !== 'running')
      return NextResponse.json({ error: `Tournament is not running (status: ${tournament.status})` }, { status: 400 });

    // ── Upsert with GREATEST protection (score can only increase) ─────────────
    const { error: scoreError } = await supabase.rpc('upsert_tournament_score', {
      p_tournament_id:         tournament_id,
      p_user_id:               userId,
      p_score:                 score,
      p_balls_dropped:         balls_dropped,
      p_merges_completed:      merges_completed,
      p_game_duration_seconds: game_duration_seconds,
      p_finished:              isFinal,
    });

    if (scoreError) {
      console.error('[submit-score] rpc error:', scoreError.message);
      return NextResponse.json({ error: scoreError.message }, { status: 500 });
    }

    // Update participant status
    await supabase.from('tournament_participants')
      .update({
        status:        isFinal ? 'finished' : 'playing',
        game_ended_at: isFinal ? new Date().toISOString() : null,
      })
      .eq('tournament_id', tournament_id)
      .eq('user_id', userId);

    // ── Auto-finalize when all players have finished ──────────────────────────
    if (isFinal) {
      const { count: total } = await supabase
        .from('tournament_scores')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournament_id);

      const { count: finished } = await supabase
        .from('tournament_scores')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournament_id)
        .eq('finished', true);

      if (total !== null && finished !== null && finished >= total) {
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        fetch(`${baseUrl}/api/tournaments/${tournament_id}/finalize`, { method: 'POST' })
          .catch(e => console.error('[submit-score] auto-finalize failed:', e.message));
      }
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('[submit-score] exception:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
