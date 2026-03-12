// app/api/tournaments/end/route.ts
// Legacy body-based endpoint kept for compatibility.
// Now auth-guarded — delegates to /api/tournaments/[id]/end which is creator-gated.
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const tournamentId = body.tournament_id || body.tournamentId;
    if (!tournamentId)
      return NextResponse.json({ error: 'tournament_id required' }, { status: 400 });

    // Delegate to the creator-authenticated [id]/end route
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/tournaments/${tournamentId}/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward the session cookie so [id]/end can authenticate the caller
        'Cookie': request.headers.get('cookie') || '',
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });

  } catch (err: any) {
    console.error('[end] error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
