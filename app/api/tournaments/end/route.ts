// app/api/tournaments/end/route.ts
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

    // Get tournament
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournament_id)
      .single();

    if (tournamentError || !tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      );
    }

    // Check if user is the creator
    if (tournament.created_by !== userId) {
      return NextResponse.json(
        { error: 'Only the tournament creator can end the tournament' },
        { status: 403 }
      );
    }

    // Update tournament status to finished
    const { error: updateError } = await supabase
      .from('tournaments')
      .update({ 
        status: 'finished',
        end_time: new Date().toISOString(),
      })
      .eq('id', tournament_id);

    if (updateError) {
      console.error('Error ending tournament:', updateError);
      return NextResponse.json(
        { error: 'Failed to end tournament' },
        { status: 500 }
      );
    }

    // Get all scores with participant info
    const { data: scores, error: scoresError } = await supabase
      .from('tournament_scores')
      .select(`
        user_id,
        current_score,
        balls_dropped,
        merges_completed,
        game_duration_seconds,
        tournament_participants!inner(username, profile_image)
      `)
      .eq('tournament_id', tournament_id)
      .order('current_score', { ascending: false });

    if (scoresError) {
      console.error('Error fetching scores:', scoresError);
      return NextResponse.json(
        { error: 'Failed to fetch tournament scores' },
        { status: 500 }
      );
    }

    if (!scores || scores.length === 0) {
      console.log('No scores found, returning success anyway');
      return NextResponse.json({
        success: true,
        message: 'Tournament ended (no scores recorded)',
      });
    }

    // Create tournament results with rankings
    const results = scores.map((score: any, index: number) => ({
      tournament_id: tournament_id,
      user_id: score.user_id,
      username: score.tournament_participants?.username || 'Unknown',
      profile_image: score.tournament_participants?.profile_image || null,
      rank: index + 1,
      final_score: score.current_score || 0,
      balls_dropped: score.balls_dropped || 0,
      merges_completed: score.merges_completed || 0,
      total_game_time_seconds: score.game_duration_seconds || 0,
    }));

    console.log('Creating tournament results:', results);

    // Insert results (upsert to handle duplicates)
    const { error: resultsError } = await supabase
      .from('tournament_results')
      .upsert(results, {
        onConflict: 'tournament_id,user_id',
        ignoreDuplicates: false,
      });

    if (resultsError) {
      console.error('Error creating tournament results:', resultsError);
      return NextResponse.json(
        { error: 'Failed to save tournament results' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      results_count: results.length,
      tournament_id: tournament_id,
    });

  } catch (error) {
    console.error('Tournament end error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
