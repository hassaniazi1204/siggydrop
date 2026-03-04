// app/api/tournaments/create/route.ts
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
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      name,
      description,
      duration_minutes,
      max_players = 100,
      auto_start_enabled = false,
      auto_start_player_count,
      scheduled_start_time,
    } = body;

    // Validation
    if (!name || !duration_minutes) {
      return NextResponse.json(
        { error: 'Tournament name and duration are required' },
        { status: 400 }
      );
    }

    if (duration_minutes < 1 || duration_minutes > 120) {
      return NextResponse.json(
        { error: 'Duration must be between 1 and 120 minutes' },
        { status: 400 }
      );
    }

    if (max_players < 2 || max_players > 1000) {
      return NextResponse.json(
        { error: 'Max players must be between 2 and 1000' },
        { status: 400 }
      );
    }

    // Get user's username from session or profile
    const username = user.user_metadata?.name || user.email?.split('@')[0] || 'Player';

    // Generate unique tournament code
    const { data: codeData, error: codeError } = await supabase
      .rpc('generate_tournament_code');

    if (codeError) {
      console.error('Error generating code:', codeError);
      return NextResponse.json(
        { error: 'Failed to generate tournament code' },
        { status: 500 }
      );
    }

    const tournament_code = codeData;

    // Create tournament
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .insert({
        tournament_code,
        name,
        description,
        duration_minutes,
        max_players,
        created_by: user.id,
        creator_username: username,
        status: 'waiting',
        auto_start_enabled,
        auto_start_player_count,
        scheduled_start_time: scheduled_start_time || null,
      })
      .select()
      .single();

    if (tournamentError) {
      console.error('Error creating tournament:', tournamentError);
      return NextResponse.json(
        { error: 'Failed to create tournament' },
        { status: 500 }
      );
    }

    // Add creator as first participant
    const { error: participantError } = await supabase
      .from('tournament_participants')
      .insert({
        tournament_id: tournament.id,
        user_id: user.id,
        username: username,
        profile_image: user.user_metadata?.avatar_url || user.user_metadata?.picture,
        status: 'joined',
      });

    if (participantError) {
      console.error('Error adding creator as participant:', participantError);
      // Don't fail - tournament is created, just log the error
    }

    return NextResponse.json({
      success: true,
      tournament: {
        id: tournament.id,
        tournament_code: tournament.tournament_code,
        name: tournament.name,
        description: tournament.description,
        duration_minutes: tournament.duration_minutes,
        max_players: tournament.max_players,
        status: tournament.status,
        created_at: tournament.created_at,
        auto_start_enabled: tournament.auto_start_enabled,
        auto_start_player_count: tournament.auto_start_player_count,
      },
    });

  } catch (error) {
    console.error('Tournament creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
