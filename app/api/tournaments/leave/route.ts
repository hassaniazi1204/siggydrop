// app/api/tournaments/leave/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';

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
    if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 401 });

    const { tournament_id } = await request.json();
    if (!tournament_id) return NextResponse.json({ error: 'tournament_id required' }, { status: 400 });

    const { data: tournament } = await supabase.from('tournaments').select('status, created_by').eq('id', tournament_id).single();
    if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    if (['active', 'finished'].includes(tournament.status)) return NextResponse.json({ error: 'Cannot leave after tournament started' }, { status: 400 });
    if (tournament.created_by === userId) return NextResponse.json({ error: 'Creator cannot leave — cancel instead' }, { status: 400 });

    await supabase.from('tournament_participants').delete().eq('tournament_id', tournament_id).eq('user_id', userId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
