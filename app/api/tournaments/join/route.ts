// app/api/tournaments/join/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in to join tournaments' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { tournament_code } = body;

    if (!tournament_code) {
      return NextResponse.json(
        { error: 'Tournament code is required' },
        { status: 400 }
      );
    }

    // Find tournament by code
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('tournament_code', tournament_code.toUpperCase())
      .single();

    if (tournamentError || !tournament) {
      return NextResponse.json(
        { error: 'Tournament not found - Check the code and try again' },
        { status: 404 }
      );
    }

    // Check if tournament is still accepting players
    if (tournament.status !== 'waiting') {
      return NextResponse.json(
        { error: 'Tournament has already started or ended' },
        { status: 400 }
      );
    }

    // Check if tournament is full
    const { count: participantCount } = await supabase
      .from('tournament_participants')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournament.id);

    if (participantCount && participantCount >= tournament.max_players) {
      return NextResponse.json(
        { error: 'Tournament is full' },
        { status: 400 }
      );
    }

    // Check if user already joined
    const { data: existingParticipant } = await supabase
      .from('tournament_participants')
      .select('*')
      .eq('tournament_id', tournament.id)
      .eq('user_id', user.id)
      .single();

    if (existingParticipant) {
      // User already joined - just return tournament details
      return NextResponse.json({
        success: true,
        already_joined: true,
        tournament: tournament,
        participant: existingParticipant,
      });
    }

    // Get user's username
    const username = user.user_metadata?.name || user.email?.split('@')[0] || 'Player';

    // Add user as participant
    const { data: participant, error: participantError } = await supabase
      .from('tournament_participants')
      .insert({
        tournament_id: tournament.id,
        user_id: user.id,
        username: username,
        profile_image: user.user_metadata?.avatar_url || user.user_metadata?.picture,
        status: 'joined',
      })
      .select()
      .single();

    if (participantError) {
      console.error('Error joining tournament:', participantError);
      return NextResponse.json(
        { error: 'Failed to join tournament' },
        { status: 500 }
      );
    }

    // Check if auto-start conditions are met
    const newParticipantCount = (participantCount || 0) + 1;
    
    if (
      tournament.auto_start_enabled &&
      tournament.auto_start_player_count &&
      newParticipantCount >= tournament.auto_start_player_count
    ) {
      // Trigger auto-start
      await supabase
        .from('tournaments')
        .update({ status: 'starting' })
        .eq('id', tournament.id);
      
      // Note: The actual countdown and start logic will be handled by the frontend
      // when it detects the status change via Realtime
    }

    return NextResponse.json({
      success: true,
      already_joined: false,
      tournament: tournament,
      participant: participant,
      participant_count: newParticipantCount,
    });

  } catch (error) {
    console.error('Tournament join error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
