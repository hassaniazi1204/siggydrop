// app/api/tournaments/submit-score/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';

// Anti-cheat validation constants
const MAX_SCORE_PER_MINUTE = 2000;
const MAX_SCORE_PER_BALL = 150;
const MAX_DURATION_VARIANCE = 30; // seconds
const MIN_SUBMISSION_INTERVAL = 2; // seconds

export async function POST(request: NextRequest) {
  try {
    // Check NextAuth session (allow guests too)
    const session = await getServerSession(authOptions);
    const guestUserId = request.headers.get('x-guest-user-id');
    
    if (!session && !guestUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = guestUserId || (session?.user as any)?.id || session?.user?.email;

    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    // Parse request body
    const body = await request.json();
    const {
      tournament_id,
      score,
      final_score = false,
      game_metrics = {},
    } = body;

    if (!tournament_id || score === undefined) {
      return NextResponse.json(
        { error: 'Tournament ID and score are required' },
        { status: 400 }
      );
    }

    // Validate score is non-negative
    if (score < 0) {
      return NextResponse.json(
        { error: 'Invalid score' },
        { status: 400 }
      );
    }

    // Get tournament to verify it's active
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('status, duration_minutes, actual_start_time')
      .eq('id', tournament_id)
      .single();

    if (tournamentError || !tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      );
    }

    if (tournament.status !== 'active') {
      return NextResponse.json(
        { error: 'Tournament is not active' },
        { status: 400 }
      );
    }

    // Anti-cheat validation
    const validationFlags: any = {};
    const {
      balls_dropped = 0,
      merges_completed = 0,
      game_duration_seconds = 0,
    } = game_metrics;

    // Check 1: Score vs Duration
    const expectedMaxScore = (game_duration_seconds / 60) * MAX_SCORE_PER_MINUTE;
    if (score > expectedMaxScore * 1.2) { // 20% tolerance
      validationFlags.SCORE_TOO_HIGH_FOR_DURATION = true;
    }

    // Check 2: Score per Ball
    if (balls_dropped > 0) {
      const scorePerBall = score / balls_dropped;
      if (scorePerBall > MAX_SCORE_PER_BALL) {
        validationFlags.SCORE_PER_BALL_TOO_HIGH = true;
      }
    }

    // Check 3: Duration matches tournament
    if (tournament.actual_start_time && final_score) {
      const tournamentDuration = Math.floor(
        (new Date().getTime() - new Date(tournament.actual_start_time).getTime()) / 1000
      );
      const durationDiff = Math.abs(game_duration_seconds - tournamentDuration);
      
      if (durationDiff > MAX_DURATION_VARIANCE) {
        validationFlags.DURATION_MISMATCH = true;
      }
    }

    // Check 4: Activity check
    if (final_score && (balls_dropped === 0 || merges_completed === 0)) {
      validationFlags.NO_GAME_ACTIVITY = true;
    }

    // Insert score
    const { data: scoreData, error: scoreError } = await supabase
      .from('tournament_scores')
      .insert({
        tournament_id,
        user_id: userId,
        score,
        balls_dropped,
        merges_completed,
        game_duration_seconds,
        final_score,
        validation_flags: Object.keys(validationFlags).length > 0 ? validationFlags : null,
      })
      .select()
      .single();

    if (scoreError) {
      console.error('Error submitting score:', scoreError);
      return NextResponse.json(
        { error: 'Failed to submit score' },
        { status: 500 }
      );
    }

    // Update participant's last heartbeat
    await supabase
      .from('tournament_participants')
      .update({ 
        last_heartbeat: new Date().toISOString(),
        status: final_score ? 'finished' : 'playing',
        game_ended_at: final_score ? new Date().toISOString() : null,
      })
      .eq('tournament_id', tournament_id)
      .eq('user_id', userId);

    return NextResponse.json({
      success: true,
      score: scoreData,
      validation_flags: validationFlags,
    });

  } catch (error) {
    console.error('Submit score error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
