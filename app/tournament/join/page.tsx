'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { createClient } from '@/utils/supabase/client';

export default function TournamentJoinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const isGuest = searchParams.get('guest') === 'true';

    if (!code) {
      setError('No tournament code provided');
      setLoading(false);
      return;
    }

    const joinTournament = async () => {
      try {
        // Get tournament by code
        const { data: tournament, error: tournamentError } = await supabase
          .from('tournaments')
          .select('*')
          .eq('tournament_code', code.toUpperCase())
          .single();

        if (tournamentError || !tournament) {
          setError('Tournament not found. Please check the code.');
          setLoading(false);
          return;
        }

        if (isGuest) {
          // Handle guest join
          const guestUsername = localStorage.getItem('guestUsername');
          
          if (!guestUsername) {
            setError('Guest username not found. Please try again.');
            setLoading(false);
            return;
          }

          // For guests, just redirect to lobby
          // Note: Guest participation may have limited functionality
          router.push(`/tournament/${tournament.id}?guest=true&username=${guestUsername}`);
        } else if (session) {
          // Handle authenticated user join via API
          const response = await fetch('/api/tournaments/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tournament_code: code.toUpperCase() }),
          });

          const data = await response.json();

          if (!response.ok) {
            setError(data.error || 'Failed to join tournament');
            setLoading(false);
            return;
          }

          // Redirect to tournament lobby
          router.push(`/tournament/${tournament.id}`);
        } else {
          setError('Please sign in to join tournaments');
          setLoading(false);
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
