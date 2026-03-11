// app/api/tournaments/end/route.ts
// Thin wrapper that delegates all finalization to /api/tournaments/[id]/finalize
// Accepts both `tournament_id` and `tournamentId` for compatibility
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tournamentId = body.tournament_id || body.tournamentId;

    if (!tournamentId)
      return NextResponse.json({ error: 'tournament_id required' }, { status: 400 });

    // Delegate to the canonical finalize route
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/tournaments/${tournamentId}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });

  } catch (err: any) {
    console.error('[end] error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
