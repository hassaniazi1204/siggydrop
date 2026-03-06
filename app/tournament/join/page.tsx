'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { createClient } from '@/utils/supabase/client';

function TournamentJoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const isGuest = searchParams.get('guest') === 'true';
    
    // Check for pending OAuth tournament join
    const pendingCode = localStorage.getItem('pendingTournamentJoin');
    const tournamentCode = code || pendingCode;

    if (!tournamentCode) {
      setError('No tournament code provided');
      setLoading(false);
      return;
    }

    const joinTournament = async () => {
      try {
        const { data: tournament, error: tournamentError } = await supabase
          .from('tournaments')
          .select('*')
          .eq('tournament_code', tournamentCode.toUpperCase())
          .single();

        if (tournamentError || !tournament) {
          setError('Tournament not found. Please check the code.');
          setLoading(false);
          return;
        }

        if (isGuest) {
          const guestUsername = localStorage.getItem('guestUsername');
          
          if (!guestUsername) {
            setError('Guest username not found. Please try again.');
            setLoading(false);
            return;
          }

          // Add guest to tournament participants
          const guestUserId = `guest_${guestUsername}_${Date.now()}`;
          const { error: insertError } = await supabase
            .from('tournament_participants')
            .insert({
              tournament_id: tournament.id,
              user_id: guestUserId,
              username: guestUsername,
              profile_image: null,
              status: 'joined',
            });

          if (insertError) {
            console.error('Error adding guest participant:', insertError);
            setError('Failed to join tournament as guest');
            setLoading(false);
            return;
          }

          // Store guest user ID for later use
          localStorage.setItem('guestUserId', guestUserId);
          
          // Clear pending join
          localStorage.removeItem('pendingTournamentJoin');

          router.push(`/tournament/${tournament.id}?guest=true&username=${guestUsername}`);
        } else if (session) {
          const response = await fetch('/api/tournaments/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tournament_code: tournamentCode.toUpperCase() }),
          });

          const data = await response.json();

          if (!response.ok) {
            setError(data.error || 'Failed to join tournament');
            setLoading(false);
            return;
          }
          
          // Clear pending join
          localStorage.removeItem('pendingTournamentJoin');
          localStorage.removeItem('authReturnUrl');

          router.push(`/tournament/${tournament.id}`);
        } else {
          // Not guest and no session - redirect to play mode modal
          router.push(`/?code=${tournamentCode}`);
        }
      } catch (err) {
        console.error('Join error:', err);
        setError('Failed to join tournament. Please try again.');
        setLoading(false);
      }
    };

    joinTournament();
  }, [searchParams, session, router, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-purple-900">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🏆</div>
          <h1 className="text-3xl font-black text-white mb-2">Joining Tournament...</h1>
          <p className="text-gray-400">Please wait</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-purple-900 p-8">
        <div className="bg-gray-900 border-2 border-red-500/30 rounded-2xl p-8 max-w-md text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-3xl font-black text-white mb-4">Join Failed</h1>
          <p className="text-red-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default function TournamentJoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-purple-900">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🏆</div>
          <h1 className="text-3xl font-black text-white mb-2">Loading...</h1>
        </div>
      </div>
    }>
      <TournamentJoinContent />
    </Suspense>
  );
}
