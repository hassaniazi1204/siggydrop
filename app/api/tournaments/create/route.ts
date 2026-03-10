// app/api/tournaments/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function resolveUserId(supabase: any, session: any): Promise<string | null> {
  const nextauthId = (session.user as any).id || session.user.email;
  if (!nextauthId) return null;
  const username = session.user.name || session.user.email?.split('@')[0] || 'Player';

  const { data: existing } = await supabase
    .from('users').select('id').eq('nextauth_id', nextauthId).single();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('users')
    .insert({ nextauth_id: nextauthId, username, email: session.user.email, avatar: session.user.image })
    .select('id').single();

  if (error) { console.error('Failed to create user:', error); return null; }
  return created.id;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    const userId = await resolveUserId(supabase, session);
    if (!userId) return NextResponse.json({ error: 'Failed to resolve user' }, { status: 500 });

    const body = await request.json().catch(() => ({}));
    const { max_players = 10 } = body;

    // Generate unique code
    let tournament_code = '';
    for (let i = 0; i < 10; i++) {
      const candidate = generateCode();
      const { data } = await supabase.from('tournaments').select('id').eq('tournament_code', candidate).single();
      if (!data) { tournament_code = candidate; break; }
    }
    if (!tournament_code) return NextResponse.json({ error: 'Could not generate unique code' }, { status: 500 });

    const { data: tournament, error } = await supabase
      .from('tournaments')
      .insert({ tournament_code, created_by: userId, max_players, status: 'waiting' })
      .select().single();

    if (error || !tournament) return NextResponse.json({ error: 'Failed to create tournament', details: error?.message }, { status: 500 });

    await supabase.from('tournament_participants').insert({
      tournament_id: tournament.id, user_id: userId, status: 'joined',
    });

    return NextResponse.json({ success: true, tournament });
  } catch (err: any) {
    console.error('Create tournament error:', err);
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
