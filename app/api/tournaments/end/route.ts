import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { tournament_id } = body;

    // Get tournament
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournament_id)
      .single();

    if (tournamentError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Check authorization (only creator can manually end)
    if (tournament.created_by !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check status
    if (tournament.status === 'finished') {
      return NextResponse.json({ error: 'Tournament already finished' }, { status: 400 });
    }

    // Get final scores
    const { data: finalScores, error: scoresError } = await supabase
      .from('tournament_scores')
      .select(`
        user_id,
        score,
        balls_dropped,
        merges_completed,
        game_duration_seconds,
        participant_id
      `)
      .eq('tournament_id', tournament_id)
      .eq('final_score', true);

    if (scoresError) {
      console.error('Error fetching final scores:', scoresError);
    }

    // Get participants info
    const { data: participants } = await supabase
      .from('tournament_participants')
      .select('id, user_id, username, profile_image')
      .eq('tournament_id', tournament_id);

    // Calculate final rankings
    const scoresByUser = new Map();
    
    finalScores?.forEach((score: any) => {
      const existing = scoresByUser.get(score.user_id);
      if (!existing || score.score > existing.score) {
        scoresByUser.set(score.user_id, score);
      }
    });

    const rankedScores = Array.from(scoresByUser.entries())
      .map(([user_id, score]) => ({
        user_id,
        ...(score as any),
      }))
      .sort((a, b) => b.score - a.score);

    // Insert into tournament_results
    const results = rankedScores.map((score, index) => {
      const participant = participants?.find((p: any) => p.user_id === score.user_id);
      return {
        tournament_id: tournament_id,
        user_id: score.user_id,
        rank: index + 1,
        username: participant?.username || 'Unknown',
        profile_image: participant?.profile_image,
        final_score: score.score,
        balls_dropped: score.balls_dropped,
        merges_completed: score.merges_completed,
        total_game_time_seconds: score.game_duration_seconds,
      };
    });

    const { error: resultsError } = await supabase
      .from('tournament_results')
      .upsert(results, { onConflict: 'tournament_id,user_id' });

    if (resultsError) {
      console.error('Error saving results:', resultsError);
    }

    // Update tournament status
    const { error: updateError } = await supabase
      .from('tournaments')
      .update({ status: 'finished' })
      .eq('id', tournament_id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to end tournament' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      final_results: results,
    });

  } catch (error) {
    console.error('Tournament end error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
