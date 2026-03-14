// app/api/tournaments/[id]/finalize/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { finalizeTournament } from '@/app/api/tournaments/finalize-logic';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tournamentId = params.id;
  if (!tournamentId)
    return NextResponse.json({ error: 'tournamentId required' }, { status: 400 });

  try {
    const supabase = createClient();
    const result = await finalizeTournament(supabase, tournamentId);

    if (!result.success)
      return NextResponse.json({ error: result.error }, { status: 400 });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[finalize] error:', err.message);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
