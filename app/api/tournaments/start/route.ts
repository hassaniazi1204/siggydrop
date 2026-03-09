// app/api/tournaments/start/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';

export async function POST(request: NextRequest) {
  try {
    // Check NextAuth session
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id || session.user.email;

    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    // Parse request body
    const body = await request.json();
    const { tournament_id } = body;

    if (!tournament_id) {
      return NextResponse.json(
        { error: 'Tournament ID is required' },
        { status: 400 }
      );
    }

    console.log('Starting tournament:', tournament_id, 'User:', userId);

    // Get tournament
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournament_id)
      .single();

    if (tournamentError || !tournament) {
      console.error('Tournament not found:', tournamentError);
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      );
    }

    // Check if user is the creator
    if (tournament.created_by !== userId) {
      return NextResponse.json(
        { error: 'Only the tournament creator can start the tournament' },
        { status: 403 }
      );
    }

    // Check if tournament is in correct status
    if (tournament.status !== 'waiting') {
      return NextResponse.json(
        { error: `Tournament cannot be started - current status: ${tournament.status}` },
        { status: 400 }
      );
    }

    // Check if there are enough participants (at least 2)
    const { count: participantCount } = await supabase
      .from('tournament_participants')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournament_id);

    if (!participantCount || participantCount < 2) {
      return NextResponse.json(
        { error: 'At least 2 players required to start the tournament' },
        { status: 400 }
      );
    }

    console.log('Starting tournament with', participantCount, 'participants');

    // Update tournament status to 'active' and set started_at
    const { data: updatedTournament, error: updateError } = await supabase
      .from('tournaments')
      .update({
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .eq('id', tournament_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error starting tournament:', updateError);
      return NextResponse.json(
        { error: 'Failed to start tournament', details: updateError.message },
        { status: 500 }
      );
    }

    console.log('Tournament status updated to active');

    // Create initial leaderboard entries for all participants with score 0
    const { data: participants, error: participantsError } = await supabase
      .from('tournament_participants')
      .select('user_id')
      .eq('tournament_id', tournament_id);

    if (!participantsError && participants) {
      // Insert initial scores for all participants (only fields that exist in new schema)
      const initialScores = participants.map(p => ({
        tournament_id: tournament_id,
        user_id: p.user_id,
        current_score: 0,
        balls_dropped: 0,
        merges_completed: 0,
        game_duration_seconds: 0,
        last_update: new Date().toISOString(),
      }));

      const { error: scoresError } = await supabase
        .from('tournament_scores')
        .upsert(initialScores, { 
          onConflict: 'tournament_id,user_id',
          ignoreDuplicates: false 
        });

      if (scoresError) {
        console.error('Error creating initial leaderboard:', scoresError);
        // Don't fail the tournament start, just log the error
      } else {
        console.log(`Created initial leaderboard entries for ${participants.length} participants`);
      }
    }

    return NextResponse.json({
      success: true,
      tournament: {
        id: updatedTournament.id,
        status: updatedTournament.status,
        started_at: updatedTournament.started_at,
        max_players: updatedTournament.max_players,
      },
      participant_count: participantCount,
    });

  } catch (error) {
    console.error('Tournament start error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
