'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { createClient } from '@/utils/supabase/client';

function TournamentJoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tournamentCode, setTournamentCode] = useState('');
  const [autoJoining, setAutoJoining] = useState(false);

  // Check if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      // Redirect to login with code
      const code = searchParams.get('code');
      if (code) {
        router.push(`/?code=${code}`);
      } else {
        router.push('/');
      }
    }
  }, [status, searchParams, router]);

  // Auto-join if code in URL
  useEffect(() => {
    if (status !== 'authenticated') return;

    const code = searchParams.get('code') || localStorage.getItem('pendingTournamentJoin');
    
    if (code && !autoJoining) {
      setAutoJoining(true);
      setTournamentCode(code.toUpperCase());
      joinTournament(code.toUpperCase());
      
      // Clear pending join
      localStorage.removeItem('pendingTournamentJoin');
      localStorage.removeItem('authReturnUrl');
    }
  }, [status, searchParams, autoJoining]);

  const joinTournament = async (code: string) => {
    if (!code || !code.trim()) {
      setError('Please enter a tournament code');
      return;
    }

    if (!session) {
      setError('Please sign in to join tournaments');
      return;
    }

    setLoading(true);
    setError(null);

    try {
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

      // Get tournament details to redirect appropriately
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('id, status')
        .eq('tournament_code', code.toUpperCase())
        .single();

      if (tournament) {
        // Redirect based on tournament status
        if (tournament.status === 'active') {
          router.push(`/tournament/${tournament.id}/play`);
        } else {
          router.push(`/tournament/${tournament.id}`);
        }
      }
    } catch (err) {
      console.error('Join error:', err);
      setError('Failed to join tournament. Please try again.');
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    joinTournament(tournamentCode);
  };

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-purple-900">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">🔐</div>
          <h1 className="text-3xl font-black text-white mb-2">Checking Authentication...</h1>
          <p className="text-gray-400">Please wait</p>
        </div>
      </div>
    );
  }

  if (autoJoining) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-purple-900">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🏆</div>
          <h1 className="text-3xl font-black text-white mb-2">Joining Tournament...</h1>
          <p className="text-gray-400">Code: {tournamentCode}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-purple-900 p-4">
      <div className="max-w-md w-full">
        {/* Card */}
        <div className="bg-gray-900/80 backdrop-blur-lg border-2 border-purple-500/30 rounded-3xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🏆</div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
              Join Tournament
            </h1>
            <p className="text-gray-400 text-sm">
              Enter the tournament code to join
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">
                Tournament Code
              </label>
              <input
                type="text"
                value={tournamentCode}
                onChange={(e) => setTournamentCode(e.target.value.toUpperCase().slice(0, 8))}
                placeholder="Enter 8-digit code"
                className="w-full px-4 py-3 bg-gray-800 border-2 border-gray-700 focus:border-purple-500 rounded-xl text-white text-center text-2xl font-mono font-bold placeholder-gray-600 outline-none transition-colors uppercase"
                maxLength={8}
                disabled={loading}
                autoFocus
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || tournamentCode.length !== 8}
              className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-700 disabled:to-gray-700 text-white rounded-xl font-bold transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? 'Joining...' : 'Join Tournament'}
            </button>
          </form>

          {/* Info */}
          <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <p className="text-purple-300 text-xs text-center">
              💡 Get the tournament code from the host to join
            </p>
          </div>

          {/* Back Button */}
          <button
            onClick={() => router.push('/')}
            className="w-full mt-4 px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
          >
            ← Back to Home
          </button>
        </div>

        {/* User Info */}
        {session?.user && (
          <div className="mt-4 text-center">
            <p className="text-gray-500 text-sm">
              Signed in as <span className="text-purple-400 font-bold">{session.user.name || session.user.email}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TournamentJoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-purple-900">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    }>
      <TournamentJoinContent />
    </Suspense>
  );
}
