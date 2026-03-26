'use client';
// components/PlayModeModal.tsx
// Rebuilt with shadcn Dialog + Button + Input components.
// All game logic and handlers are identical — only markup changed.

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PlayModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAuthenticated?: boolean;
}

type Screen =
  | 'mode-select'
  | 'solo-auth'
  | 'tournament-action'
  | 'tournament-join'
  | 'tournament-auth';

export default function PlayModeModal({
  isOpen,
  onClose,
  isAuthenticated = false,
}: PlayModeModalProps) {
  const router = useRouter();
  const [currentScreen, setCurrentScreen] = useState<Screen>('mode-select');
  const [guestUsername, setGuestUsername] = useState('');
  const [tournamentCode, setTournamentCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Handlers (logic unchanged) ────────────────────────────────────────────
  const handleGuestPlay = () => {
    if (!guestUsername.trim()) { setError('Please enter a username'); return; }
    localStorage.setItem('guestUsername', guestUsername.trim());
    router.push('/game');
    onClose();
  };

  const handleOAuthSignIn = async (provider: 'google' | 'discord', redirectTo?: string) => {
    setLoading(true);
    try {
      await signIn(provider, { callbackUrl: redirectTo || '/game', redirect: true });
      onClose();
    } catch {
      setError('Sign in failed. Please try again.');
      setLoading(false);
    }
  };

  const handleTournamentJoinGuest = async () => {
    if (!guestUsername.trim()) { setError('Please enter a username'); return; }
    if (!tournamentCode.trim()) { setError('Please enter a tournament code'); return; }
    setLoading(true);
    localStorage.setItem('guestUsername', guestUsername.trim());
    localStorage.setItem('pendingTournamentCode', tournamentCode.toUpperCase().trim());
    router.push(`/tournament/join?code=${tournamentCode.toUpperCase().trim()}&guest=true`);
    onClose();
  };

  const resetModal = () => {
    setCurrentScreen('mode-select');
    setGuestUsername('');
    setTournamentCode('');
    setError(null);
    setLoading(false);
  };

  const handleClose = () => { resetModal(); onClose(); };

  // ── Shared OAuth buttons ───────────────────────────────────────────────────
  const OAuthButtons = ({ redirectTo }: { redirectTo?: string }) => (
    <div className="space-y-3">
      <Button
        variant="google"
        size="md"
        className="w-full"
        onClick={() => handleOAuthSignIn('google', redirectTo)}
        disabled={loading}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign in with Google
      </Button>
      <Button
        variant="discord"
        size="md"
        className="w-full"
        onClick={() => handleOAuthSignIn('discord', redirectTo)}
        disabled={loading}
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
        Sign in with Discord
      </Button>
    </div>
  );

  // ── Divider ───────────────────────────────────────────────────────────────
  const Divider = ({ label = 'or' }: { label?: string }) => (
    <div className="relative my-5">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-white/10" />
      </div>
      <div className="relative flex justify-center">
        <span className="px-3 bg-[#0a0a0f] text-white/35 text-xs uppercase tracking-widest">
          {label}
        </span>
      </div>
    </div>
  );

  // ── Error banner ──────────────────────────────────────────────────────────
  const ErrorBanner = () => error ? (
    <div className="px-4 py-3 rounded-xl bg-red-500/8 border border-red-500/20 text-red-400 text-sm mb-4">
      {error}
    </div>
  ) : null;

  // ── Back button ───────────────────────────────────────────────────────────
  const BackButton = ({ to }: { to: Screen }) => (
    <button
      onClick={() => { setCurrentScreen(to); setError(null); }}
      className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm mb-5 transition-colors"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m15 18-6-6 6-6"/>
      </svg>
      Back
    </button>
  );

  // ── Screens ───────────────────────────────────────────────────────────────
  const renderContent = () => {
    switch (currentScreen) {

      case 'mode-select':
        return (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Choose your mode</DialogTitle>
            </DialogHeader>

            {/* Solo Play card */}
            <button
              onClick={() => {
                if (isAuthenticated) { router.push('/game'); onClose(); }
                else setCurrentScreen('solo-auth');
              }}
              className="w-full text-left p-5 rounded-xl border border-white/8 bg-white/3 hover:bg-white/6 hover:border-[#8840FF]/40 transition-all duration-200 group"
            >
              <div className="flex items-center gap-4">
                <span className="text-3xl">🎮</span>
                <div>
                  <h3 className="text-white font-black text-lg tracking-tight">Solo Play</h3>
                  <p className="text-white/45 text-sm mt-0.5">Practice alone and beat the leaderboard</p>
                </div>
                <svg className="ml-auto text-white/20 group-hover:text-[#40FFAF] transition-colors" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </div>
            </button>

            {/* Tournaments card */}
            <button
              onClick={() => setCurrentScreen('tournament-action')}
              className="w-full text-left p-5 rounded-xl border border-white/8 bg-white/3 hover:bg-white/6 hover:border-[#40FFAF]/40 transition-all duration-200 group"
            >
              <div className="flex items-center gap-4">
                <span className="text-3xl">🏆</span>
                <div>
                  <h3 className="text-white font-black text-lg tracking-tight">Tournaments</h3>
                  <p className="text-white/45 text-sm mt-0.5">Compete in real-time battles</p>
                </div>
                <svg className="ml-auto text-white/20 group-hover:text-[#40FFAF] transition-colors" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </div>
            </button>
          </div>
        );

      case 'solo-auth':
        return (
          <div>
            <BackButton to="mode-select" />
            <DialogHeader>
              <DialogTitle>Solo Play</DialogTitle>
            </DialogHeader>
            <ErrorBanner />
            <OAuthButtons redirectTo="/game" />
            <Divider label="or play as guest" />
            <div className="space-y-3">
              <Input
                placeholder="Choose a username"
                value={guestUsername}
                onChange={e => setGuestUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGuestPlay()}
                maxLength={20}
              />
              <Button
                variant="ghost"
                size="md"
                className="w-full border-white/15"
                onClick={handleGuestPlay}
                disabled={loading}
              >
                Play as Guest
              </Button>
              <p className="text-center text-xs text-white/25">
                Guest scores are not saved to the leaderboard
              </p>
            </div>
          </div>
        );

      case 'tournament-action':
        return (
          <div>
            <BackButton to="mode-select" />
            <DialogHeader>
              <DialogTitle>Tournaments</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <button
                onClick={() => setCurrentScreen('tournament-join')}
                className="w-full text-left p-5 rounded-xl border border-white/8 bg-white/3 hover:bg-white/6 hover:border-[#40FFAF]/40 transition-all duration-200 group"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">🎯</span>
                  <div>
                    <h3 className="text-white font-black text-base tracking-tight">Join Tournament</h3>
                    <p className="text-white/45 text-sm mt-0.5">Enter a code to join</p>
                  </div>
                  <svg className="ml-auto text-white/20 group-hover:text-[#40FFAF] transition-colors" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </div>
              </button>

              <button
                onClick={() => {
                  if (isAuthenticated) { router.push('/tournaments?action=create'); onClose(); }
                  else setCurrentScreen('tournament-auth');
                }}
                className="w-full text-left p-5 rounded-xl border border-white/8 bg-white/3 hover:bg-white/6 hover:border-[#8840FF]/40 transition-all duration-200 group"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">➕</span>
                  <div>
                    <h3 className="text-white font-black text-base tracking-tight">Create Tournament</h3>
                    <p className="text-white/45 text-sm mt-0.5">Host your own tournament</p>
                  </div>
                  <svg className="ml-auto text-white/20 group-hover:text-[#40FFAF] transition-colors" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </div>
              </button>
            </div>
          </div>
        );

      case 'tournament-join':
        return (
          <div>
            <BackButton to="tournament-action" />
            <DialogHeader>
              <DialogTitle>Join Tournament</DialogTitle>
            </DialogHeader>
            <ErrorBanner />

            <div className="mb-5">
              <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">
                Tournament Code
              </label>
              <Input
                placeholder="XXXXXX"
                value={tournamentCode}
                onChange={e => setTournamentCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="text-center font-mono text-2xl font-black tracking-[0.3em] h-16"
              />
              <p className="text-right text-xs text-white/25 mt-1.5">{tournamentCode.length}/6</p>
            </div>

            {isAuthenticated ? (
              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={() => { router.push(`/tournament/join?code=${tournamentCode}`); onClose(); }}
                disabled={tournamentCode.length < 6}
              >
                Join Tournament →
              </Button>
            ) : (
              <>
                <OAuthButtons redirectTo={`/tournament/join?code=${tournamentCode}`} />
                <Divider label="or join as guest" />
                <div className="space-y-3">
                  <Input
                    placeholder="Your username"
                    value={guestUsername}
                    onChange={e => setGuestUsername(e.target.value)}
                    maxLength={20}
                  />
                  <Button
                    variant="ghost"
                    size="md"
                    className="w-full"
                    onClick={handleTournamentJoinGuest}
                    disabled={loading || tournamentCode.length < 6 || !guestUsername.trim()}
                  >
                    Join as Guest
                  </Button>
                  <p className="text-center text-xs text-white/25">
                    ⚠️ Guest tournament scores may not be saved
                  </p>
                </div>
              </>
            )}
          </div>
        );

      case 'tournament-auth':
        return (
          <div>
            <BackButton to="tournament-action" />
            <DialogHeader>
              <DialogTitle>Create Tournament</DialogTitle>
            </DialogHeader>
            <p className="text-white/45 text-sm mb-6">
              Sign in to host your own tournament
            </p>
            <ErrorBanner />
            <OAuthButtons redirectTo="/tournaments?action=create" />
            <p className="text-center text-xs text-white/25 mt-5">
              Creating tournaments requires an account
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-md">
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
