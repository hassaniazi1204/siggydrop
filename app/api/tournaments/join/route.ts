// app/api/tournaments/join/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';

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
  if (error || !data) { console.error('resolveUserId:', error); return null; }
  return data.id;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    const userId = await resolveUserId(supabase, session);
    if (!userId) return NextResponse.json({ error: 'Failed to resolve user' }, { status: 500 });

    const { tournament_code } = await request.json();
    if (!tournament_code) return NextResponse.json({ error: 'Tournament code required' }, { status: 400 });

    const { data: tournament } = await supabase
      .from('tournaments')
      .select('*')
      .eq('tournament_code', tournament_code.toUpperCase())
      .single();

    if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    if (tournament.status !== 'waiting') return NextResponse.json({ error: 'Tournament already started or ended' }, { status: 400 });

    const { count } = await supabase
      .from('tournament_participants')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournament.id);

    if ((count ?? 0) >= tournament.max_players)
      return NextResponse.json({ error: 'Tournament is full' }, { status: 400 });

    // Check already joined
    const { data: existing } = await supabase
      .from('tournament_participants')
      .select('id')
      .eq('tournament_id', tournament.id)
      .eq('user_id', userId)
      .single();

    if (existing) return NextResponse.json({ success: true, already_joined: true, tournament_id: tournament.id, tournament });

    const { data: participant, error } = await supabase
      .from('tournament_participants')
      .insert({ tournament_id: tournament.id, user_id: userId, status: 'joined' })
      .select()
      .single();

    if (error) return NextResponse.json({ error: 'Failed to join tournament' }, { status: 500 });

    return NextResponse.json({ success: true, already_joined: false, tournament_id: tournament.id, tournament, participant });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
