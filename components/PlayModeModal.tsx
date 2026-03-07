'use client';

import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

interface PlayModeModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function PlayModeModal({ isOpen = true, onClose }: PlayModeModalProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [guestUsername, setGuestUsername] = useState('');
  const [selectedMode, setSelectedMode] = useState<'solo' | 'tournament' | null>(null);

  // Check if joining a tournament
  const tournamentCode = searchParams?.get('code');
  const isTournamentJoin = !!tournamentCode;

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  const handleGuestPlay = () => {
    if (!guestUsername.trim()) {
      alert('Please enter a username!');
      return;
    }

    // Store guest username and ID in localStorage
    const guestUserId = `guest_${guestUsername}_${Date.now()}`;
    localStorage.setItem('guestUsername', guestUsername);
    localStorage.setItem('guestUserId', guestUserId);

    if (isTournamentJoin && tournamentCode) {
      // Redirect to tournament join with guest mode
      router.push(`/tournament/join?code=${tournamentCode}&guest=true`);
    } else {
      // Redirect to solo game
      router.push('/game');
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'discord') => {
    try {
      // Store tournament context before OAuth redirect
      if (isTournamentJoin && tournamentCode) {
        localStorage.setItem('pendingTournamentJoin', tournamentCode);
        localStorage.setItem('authReturnUrl', `/tournament/join?code=${tournamentCode}`);
      } else {
        localStorage.setItem('authReturnUrl', '/game');
      }

      // Trigger OAuth login
      await signIn(provider, {
        callbackUrl: isTournamentJoin 
          ? `/tournament/join?code=${tournamentCode}`
          : '/game',
      });
    } catch (error) {
      console.error('OAuth error:', error);
      alert('Login failed. Please try again.');
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 border-2 border-purple-500/30 rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
        {/* Close Button (only if onClose provided and not tournament join) */}
        {onClose && !isTournamentJoin && (
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Title */}
        <div className="text-center mb-8">
          <h2 className="text-4xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
            {isTournamentJoin ? '🏆 Join Tournament' : '🎮 Choose Play Mode'}
          </h2>
          {isTournamentJoin && (
            <p className="text-gray-400 text-sm">
              Code: <span className="text-purple-400 font-mono font-bold">{tournamentCode}</span>
            </p>
          )}
          <p className="text-gray-300 text-sm mt-2">
            {isTournamentJoin 
              ? 'Sign in or play as guest to join the tournament'
              : 'Sign in to save your progress or play as guest'}
          </p>
        </div>

        {/* OAuth Login Options */}
        <div className="space-y-3 mb-6">
          <button
            onClick={() => handleOAuthLogin('google')}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-gray-100 text-gray-900 rounded-xl font-bold transition-all hover:scale-105 active:scale-95"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>Continue with Google</span>
          </button>

          <button
            onClick={() => handleOAuthLogin('discord')}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl font-bold transition-all hover:scale-105 active:scale-95"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            <span>Continue with Discord</span>
          </button>
        </div>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-gray-900 text-gray-400">or play as guest</span>
          </div>
        </div>

        {/* Guest Mode */}
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Enter your username"
            value={guestUsername}
            onChange={(e) => setGuestUsername(e.target.value.slice(0, 20))}
            onKeyPress={(e) => e.key === 'Enter' && handleGuestPlay()}
            className="w-full px-4 py-3 bg-gray-800 border-2 border-gray-700 focus:border-purple-500 rounded-xl text-white placeholder-gray-500 outline-none transition-colors"
            maxLength={20}
          />
          
          <button
            onClick={handleGuestPlay}
            disabled={!guestUsername.trim()}
            className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-700 disabled:to-gray-700 text-white rounded-xl font-bold transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isTournamentJoin ? '👥 Join as Guest' : '🎮 Play as Guest'}
          </button>
        </div>

        {/* Guest Mode Warning */}
        <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-yellow-400 text-xs text-center">
            ⚠️ Guest mode: Your progress won't be saved permanently
          </p>
        </div>

        {/* Back Button (only for non-tournament and if onClose not provided) */}
        {!isTournamentJoin && !onClose && (
          <button
            onClick={() => router.push('/')}
            className="w-full mt-4 px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
          >
            ← Back to Home
          </button>
        )}
      </div>
    </div>
  );
}
