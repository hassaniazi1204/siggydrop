// app/api/leaderboard/route.ts
// Solo play leaderboard — top 20 enforced server-side.
// user_id is uuid (proper FK to users.id).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';

// Helper: get or create the users.id (uuid) for the current NextAuth session
async function resolveUserId(supabase: any, session: any): Promise<string | null> {
  const nextauthId = (session.user as any).id || session.user.email;
  const username   = session.user.name || session.user.email?.split('@')[0] || 'Player';

  const { data, error } = await supabase
    .from('users')
    .upsert(
      { nextauth_id: nextauthId, username, email: session.user.email, avatar: session.user.image },
      { onConflict: 'nextauth_id' }
    )
    .select('id')
    .single();

  if (error || !data) { console.error('resolveUserId error:', error); return null; }
  return data.id;
}

// ─── GET: Fetch top 20 solo scores ───────────────────────────────────────────
export async function GET() {
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    const { data: scores, error } = await supabase
      .from('solo_scores')
      .select(`
        id,
        score,
        created_at,
        users ( username )
      `)
      .order('score', { ascending: false })
      .limit(20);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const leaderboard = (scores || []).map((row: any) => ({
      id:         row.id,
      username:   row.users?.username ?? 'Unknown',
      score:      row.score,
      created_at: row.created_at,
    }));

    return NextResponse.json({ success: true, data: leaderboard });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: Submit a solo score ────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    const { score, game_metrics = {} } = await request.json();

    if (typeof score !== 'number' || score < 0)
      return NextResponse.json({ error: 'Valid score required' }, { status: 400 });

    const { balls_dropped = 0, merges_completed = 0 } = game_metrics;
    if (merges_completed > balls_dropped && balls_dropped > 0)
      return NextResponse.json({ error: 'Invalid game metrics' }, { status: 400 });

    const userId = await resolveUserId(supabase, session);
    if (!userId) return NextResponse.json({ error: 'Failed to resolve user' }, { status: 500 });

    // Check current top-20 threshold
    const { data: currentTop20 } = await supabase
      .from('solo_scores')
      .select('id, score')
      .order('score', { ascending: false })
      .limit(20);

    const isTop20Full      = (currentTop20?.length ?? 0) >= 20;
    const lowestTop20Score = isTop20Full ? currentTop20![currentTop20!.length - 1].score : -1;

    if (score <= lowestTop20Score && isTop20Full)
      return NextResponse.json({ success: true, ranked: false, threshold: lowestTop20Score });

    // Insert new score
    const { error: insertError } = await supabase
      .from('solo_scores')
      .insert({ user_id: userId, score });

    if (insertError) throw insertError;

    // Drop the old 20th entry if top-20 was full
    if (isTop20Full) {
      await supabase.from('solo_scores').delete().eq('id', currentTop20![currentTop20!.length - 1].id);
    }

    return NextResponse.json({ success: true, ranked: true }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
