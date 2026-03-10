// app/api/user/me/route.ts
// Returns the current user's DB uuid — used by client pages that need
// to compare against uuid FK columns (e.g. created_by, user_id).
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    const nextauthId = (session.user as any).id || session.user.email;

    const { data: existing } = await supabase
      .from('users').select('id, username, email, avatar')
      .eq('nextauth_id', nextauthId).single();
    if (existing) return NextResponse.json(existing);

    const username = session.user.name || session.user.email?.split('@')[0] || 'Player';
    const { data: created, error } = await supabase
      .from('users')
      .insert({ nextauth_id: nextauthId, username, email: session.user.email, avatar: session.user.image })
      .select('id, username, email, avatar').single();

    if (error) return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    return NextResponse.json(created);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
