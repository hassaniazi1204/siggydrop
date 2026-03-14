// app/api/tournaments/start/route.ts
// Lifecycle: waiting → running (single step, no 'starting' intermediate state)
// POST: waiting → running (sets started_at, no end_time stored)
// No PATCH needed — removed the two-step starting→active flow entirely.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';

async function resolveUserId(supabase: any, session: any): Promise<string | null> {
  const nextauthId = (session.user as any).id || session.user.email;
  if (!nextauthId) return null;
  const { data } = await supabase
    .from('users').select('id').eq('nextauth_id', nextauthId).maybeSingle();
  return data?.id ?? null;
}

// POST: waiting → running
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createClient();
    const userId = await resolveUserId(supabase, session);
    if (!userId) return NextResponse.json({ error: 'Failed to resolve user' }, { status: 500 });

    const { tournament_id } = await request.json();
    if (!tournament_id) return NextResponse.json({ error: 'tournament_id required' }, { status: 400 });

    const { data: tournament } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournament_id)
      .single();

    if (!tournament)
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    if (tournament.created_by !== userId)
      return NextResponse.json({ error: 'Only the creator can start' }, { status: 403 });
    if (tournament.status !== 'waiting')
      return NextResponse.json({ error: `Cannot start: tournament is ${tournament.status}` }, { status: 400 });

    const { count } = await supabase
      .from('tournament_participants')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournament_id);

    if ((count ?? 0) < 2)
      return NextResponse.json({ error: 'At least 2 players required to start' }, { status: 400 });

    // started_at = now. The client display timer initialises from
    // duration_minutes * 60 after the countdown ends, so players always
    // see the full duration regardless of when started_at was written.
    const started_at = new Date().toISOString();

    // Transition: waiting → running
    // started_at is set here. end_time is NOT stored — computed as needed:
    //   started_at + duration_minutes
    const { data: updated, error: updateErr } = await supabase
      .from('tournaments')
      .update({
        status:     'running',
        started_at: started_at,
      })
      .eq('id', tournament_id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Seed zero-score rows for all participants so LiveLeaderboard shows everyone immediately
    const { data: participants } = await supabase
      .from('tournament_participants')
      .select('user_id')
      .eq('tournament_id', tournament_id);

    if (participants?.length) {
      await supabase.from('tournament_scores').upsert(
        participants.map(p => ({
          tournament_id,
          user_id:               p.user_id,
          score:                 0,
          balls_dropped:         0,
          merges_completed:      0,
          game_duration_seconds: 0,
          finished:              false,
          last_update:           started_at,
        })),
        { onConflict: 'tournament_id,user_id', ignoreDuplicates: true }
      );
    }

    return NextResponse.json({ success: true, tournament: updated, participant_count: count });
  } catch (err: any) {
    console.error('[start] error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH is no longer used — the two-step starting→active flow was removed.
// Returning 410 Gone with a clear message instead of a silent 404.
export async function PATCH(_request: NextRequest) {
  return NextResponse.json(
    { error: 'PATCH /api/tournaments/start is no longer used. Use POST to start a tournament directly.' },
    { status: 410 }
  );
}
