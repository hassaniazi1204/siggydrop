'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface PlayModeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Screen = 'mode-select' | 'solo-auth' | 'tournament-action' | 'tournament-join' | 'tournament-create' | 'tournament-auth';

export default function PlayModeModal({ isOpen, onClose }: PlayModeModalProps) {
  const router = useRouter();
  const [currentScreen, setCurrentScreen] = useState<Screen>('mode-select');
  const [guestUsername, setGuestUsername] = useState('');
  const [tournamentCode, setTournamentCode] = useState('');
  const [tournamentAction, setTournamentAction] = useState<'join' | 'create' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle guest play (solo mode)
  const handleGuestPlay = () => {
    if (!guestUsername.trim()) {
      setError('Please enter a username');
      return;
    }
    // Store guest username and redirect to game
    localStorage.setItem('guestUsername', guestUsername.trim());
    router.push('/game');
    onClose();
  };

  // Handle OAuth sign in
  const handleOAuthSignIn = async (provider: 'google' | 'discord', redirectTo?: string) => {
    setLoading(true);
    try {
      await signIn(provider, { 
        callbackUrl: redirectTo || '/game',
        redirect: true 
      });
      onClose();
    } catch (err) {
      setError('Sign in failed. Please try again.');
      setLoading(false);
    }
  };

  // Handle tournament join with guest
  const handleTournamentJoinGuest = async () => {
    if (!guestUsername.trim()) {
      setError('Please enter a username');
      return;
    }
    if (!tournamentCode.trim()) {
      setError('Please enter a tournament code');
      return;
    }

    setLoading(true);
    try {
      // Store guest username and tournament code
      localStorage.setItem('guestUsername', guestUsername.trim());
      localStorage.setItem('pendingTournamentCode', tournamentCode.toUpperCase().trim());
      
      // Redirect to tournament join flow
      router.push(`/tournament/join?code=${tournamentCode.toUpperCase().trim()}&guest=true`);
      onClose();
    } catch (err) {
      setError('Failed to join tournament. Please try again.');
      setLoading(false);
    }
  };

  // Reset modal state
  const resetModal = () => {
    setCurrentScreen('mode-select');
    setGuestUsername('');
    setTournamentCode('');
    setTournamentAction(null);
    setError(null);
    setLoading(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  // Render different screens
  const renderContent = () => {
    switch (currentScreen) {
      case 'mode-select':
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-black text-white text-center mb-8">
              Choose Your Game Mode
            </h2>

            {/* Solo Play Card */}
            <div 
              onClick={() => setCurrentScreen('solo-auth')}
              className="p-6 bg-gradient-to-br from-purple-900/50 to-pink-900/50 border-2 border-purple-500 rounded-2xl cursor-pointer hover:scale-105 transition-transform"
            >
              <div className="text-5xl mb-4 text-center">🎮</div>
              <h3 className="text-2xl font-black text-white mb-2 text-center">
                SOLO PLAY
              </h3>
              <p className="text-gray-300 text-center mb-4">
                Practice alone and improve your skills
              </p>
              <button className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-colors">
                Play Solo →
              </button>
            </div>

            {/* Tournament Card */}
            <div 
              onClick={() => setCurrentScreen('tournament-action')}
              className="p-6 bg-gradient-to-br from-green-900/50 to-emerald-900/50 border-2 border-green-500 rounded-2xl cursor-pointer hover:scale-105 transition-transform"
            >
              <div className="text-5xl mb-4 text-center">🏆</div>
              <h3 className="text-2xl font-black text-white mb-2 text-center">
                TOURNAMENTS
              </h3>
              <p className="text-gray-300 text-center mb-4">
                Compete in real-time battles
              </p>
              <button className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors">
                Enter Arena →
              </button>
            </div>
          </div>
        );

      case 'solo-auth':
        return (
          <div className="space-y-6">
            <button
              onClick={() => setCurrentScreen('mode-select')}
              className="text-gray-400 hover:text-white transition-colors mb-4"
            >
              ← Back
            </button>

            <h2 className="text-3xl font-black text-white mb-6">
              Solo Play
            </h2>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              {/* Google Sign In */}
              <button
                onClick={() => handleOAuthSignIn('google')}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-gray-100 text-gray-800 font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </button>

              {/* Discord Sign In */}
              <button
                onClick={() => handleOAuthSignIn('discord')}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                Sign in with Discord
              </button>

              {/* Guest Mode */}
              <div className="pt-4 border-t border-gray-700">
                <p className="text-gray-400 text-sm mb-4">Or play as guest:</p>
                <input
                  type="text"
                  placeholder="Enter your username"
                  value={guestUsername}
                  onChange={(e) => setGuestUsername(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleGuestPlay()}
                  maxLength={20}
                  className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 mb-4"
                />
                <button
                  onClick={handleGuestPlay}
                  disabled={loading}
                  className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  Play as Guest
                </button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Guest scores won't be saved to leaderboard
                </p>
              </div>
            </div>
          </div>
        );

      case 'tournament-action':
        return (
          <div className="space-y-6">
            <button
              onClick={() => setCurrentScreen('mode-select')}
              className="text-gray-400 hover:text-white transition-colors mb-4"
            >
              ← Back
            </button>

            <h2 className="text-3xl font-black text-white mb-6">
              Tournament Mode
            </h2>

            <div className="space-y-4">
              {/* Join Tournament */}
              <button
                onClick={() => {
                  setTournamentAction('join');
                  setCurrentScreen('tournament-join');
                }}
                className="w-full p-6 bg-gradient-to-r from-blue-900/50 to-cyan-900/50 border-2 border-blue-500 rounded-xl hover:scale-105 transition-transform"
              >
                <div className="text-4xl mb-2">🎯</div>
                <h3 className="text-xl font-black text-white mb-2">Join Tournament</h3>
                <p className="text-gray-300 text-sm">
                  Enter a tournament code to join
                </p>
              </button>

              {/* Create Tournament */}
              <button
                onClick={() => {
                  setTournamentAction('create');
                  setCurrentScreen('tournament-auth');
                }}
                className="w-full p-6 bg-gradient-to-r from-green-900/50 to-emerald-900/50 border-2 border-green-500 rounded-xl hover:scale-105 transition-transform"
              >
                <div className="text-4xl mb-2">➕</div>
                <h3 className="text-xl font-black text-white mb-2">Create Tournament</h3>
                <p className="text-gray-300 text-sm">
                  Host your own tournament
                </p>
              </button>
            </div>
          </div>
        );

      case 'tournament-join':
        return (
          <div className="space-y-6">
            <button
              onClick={() => setCurrentScreen('tournament-action')}
              className="text-gray-400 hover:text-white transition-colors mb-4"
            >
              ← Back
            </button>

            <h2 className="text-3xl font-black text-white mb-6">
              Join Tournament
            </h2>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Tournament Code Input */}
            <div>
              <label className="block text-white font-semibold mb-2">
                Tournament Code
              </label>
              <input
                type="text"
                placeholder="Enter 6-character code"
                value={tournamentCode}
                onChange={(e) => setTournamentCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="w-full px-6 py-4 bg-black/50 border-2 border-gray-700 rounded-xl text-white text-center font-mono text-2xl font-bold placeholder-gray-600 focus:outline-none focus:border-purple-500 tracking-widest"
              />
              <p className="text-xs text-gray-400 mt-2 text-center">
                {tournamentCode.length}/6 characters
              </p>
            </div>

            {/* Auth Options */}
            <div className="space-y-4">
              <p className="text-gray-400 text-sm text-center">Sign in to join:</p>
              
              {/* Google */}
              <button
                onClick={() => handleOAuthSignIn('google', `/tournament/join?code=${tournamentCode}`)}
                disabled={loading || tournamentCode.length < 6}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-gray-100 text-gray-800 font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </button>

              {/* Discord */}
              <button
                onClick={() => handleOAuthSignIn('discord', `/tournament/join?code=${tournamentCode}`)}
                disabled={loading || tournamentCode.length < 6}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                Sign in with Discord
              </button>

              {/* Guest Mode */}
              <div className="pt-4 border-t border-gray-700">
                <p className="text-gray-400 text-sm mb-4">Or join as guest:</p>
                <input
                  type="text"
                  placeholder="Enter your username"
                  value={guestUsername}
                  onChange={(e) => setGuestUsername(e.target.value)}
                  maxLength={20}
                  className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 mb-4"
                />
                <button
                  onClick={handleTournamentJoinGuest}
                  disabled={loading || tournamentCode.length < 6 || !guestUsername.trim()}
                  className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  Join as Guest
                </button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  ⚠️ Guest players can participate but scores may not count
                </p>
              </div>
            </div>
          </div>
        );

      case 'tournament-auth':
        return (
          <div className="space-y-6">
            <button
              onClick={() => setCurrentScreen('tournament-action')}
              className="text-gray-400 hover:text-white transition-colors mb-4"
            >
              ← Back
            </button>

            <h2 className="text-3xl font-black text-white mb-6">
              Create Tournament
            </h2>

            <p className="text-gray-400 mb-6">
              Sign in to create and host your own tournament
            </p>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              {/* Google */}
              <button
                onClick={() => handleOAuthSignIn('google', '/tournaments?action=create')}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-gray-100 text-gray-800 font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </button>

              {/* Discord */}
              <button
                onClick={() => handleOAuthSignIn('discord', '/tournaments?action=create')}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                Sign in with Discord
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center pt-4">
              Creating tournaments requires authentication
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border-2 border-purple-500/30 rounded-2xl max-w-lg w-full p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {renderContent()}
      </div>
    </div>
  );
}
