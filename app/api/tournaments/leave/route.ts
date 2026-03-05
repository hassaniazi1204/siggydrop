// app/api/tournaments/leave/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    // Parse request body
    const body = await request.json();
    const { tournament_id, user_id } = body;

    if (!tournament_id || !user_id) {
      return NextResponse.json(
        { error: 'Tournament ID and User ID are required' },
        { status: 400 }
      );
    }

    // Get tournament to check status
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('status, created_by')
      .eq('id', tournament_id)
      .single();

    if (tournamentError || !tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      );
    }

    // Don't allow leaving if tournament has started
    if (tournament.status === 'active' || tournament.status === 'finished') {
      return NextResponse.json(
        { error: 'Cannot leave tournament that has already started' },
        { status: 400 }
      );
    }

    // Don't allow creator to leave (they should cancel instead)
    if (tournament.created_by === user_id) {
      return NextResponse.json(
        { error: 'Tournament creator cannot leave. Please cancel the tournament instead.' },
        { status: 400 }
      );
    }

    // Remove participant
    const { error: deleteError } = await supabase
      .from('tournament_participants')
      .delete()
      .eq('tournament_id', tournament_id)
      .eq('user_id', user_id);

    if (deleteError) {
      console.error('Error removing participant:', deleteError);
      return NextResponse.json(
        { error: 'Failed to leave tournament' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully left tournament',
    });

  } catch (error) {
    console.error('Leave tournament error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
