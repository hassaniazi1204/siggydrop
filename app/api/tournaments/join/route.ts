// app/api/tournaments/join/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(request: NextRequest) {
  try {
    // Check NextAuth session
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in to join tournaments' },
        { status: 401 }
      );
    }

    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    // Get user info from session
    const userId = (session.user as any).id || session.user.email;
    const username = session.user.name || session.user.email?.split('@')[0] || 'Player';

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
      .eq('user_id', userId)
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

    // Add user as participant
    const { data: participant, error: participantError } = await supabase
      .from('tournament_participants')
      .insert({
        tournament_id: tournament.id,
        user_id: userId,
        username: username,
        profile_image: session.user.image || null,
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
