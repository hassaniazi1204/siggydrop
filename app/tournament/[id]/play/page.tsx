'use client';
// Play page — client responsibilities:
//   - Submit score updates periodically and on game-over (submit-score only)
//   - Listen for tournament status → 'finished' via Realtime and redirect
//
// Client does NOT:
//   - Call /finalize directly
//   - Control tournament state
//   - Gate redirects behind a ref — all players redirect when server says finished

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useSession } from 'next-auth/react';
import LiveLeaderboard from '@/components/LiveLeaderboard';
import MergeGame from '@/components/MergeGame';
import TournamentWaitingScreen from '@/components/TournamentWaitingScreen';

export default function TournamentGamePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();

  // Stable supabase ref — cleanup always targets same instance
  const supabaseRef = useRef(createClient());
  const supabase    = supabaseRef.current;

  const [tournament, setTournament]           = useState<any>(null);
  const [timeRemaining, setTimeRemaining]     = useState<number>(0);
  const [currentScore, setCurrentScore]       = useState(0);
  const [gameStarted, setGameStarted]         = useState(false);
  const [gameEnded, setGameEnded]             = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const [playerFinished, setPlayerFinished]   = useState(false);
  const [finalScore, setFinalScore]           = useState(0);
  const [playerUsername, setPlayerUsername]   = useState('');
  const [currentUserDbId, setCurrentUserDbId] = useState<string | null>(null);

  const gameMetrics  = useRef({ balls_dropped: 0, merges_completed: 0, game_start_time: 0 });
  const lastSubmit   = useRef(0);
  const gameEndedRef = useRef(false);
  // scoreRef mirrors currentScore — avoids stale closure on final submit
  const scoreRef     = useRef(0);
  const tournamentId = params.id as string;

  // Resolve DB uuid — gated on session being loaded
  useEffect(() => {
    if (!session) return;
    fetch('/api/user/me').then(r => r.json()).then(d => { if (d.id) setCurrentUserDbId(d.id); });
  }, [session]);

  // Load tournament — timer derived from started_at + duration_minutes
  useEffect(() => {
    if (!tournamentId) return;
    supabase.from('tournaments').select('*').eq('id', tournamentId).single()
      .then(({ data }) => {
        if (!data) return;
        setTournament(data);
        if (data.started_at && data.duration_minutes) {
          const endMs = new Date(data.started_at).getTime() + data.duration_minutes * 60 * 1000;
          setTimeRemaining(Math.max(0, Math.floor((endMs - Date.now()) / 1000)));
        }
      });
  }, [tournamentId]);

  // Countdown timer — purely cosmetic on the client.
  // When it reaches zero we submit the final score and show the overlay.
  // The actual tournament finalization is server-side (pg_cron or submit-score auto-finalize).
  // The Realtime listener below is what triggers the redirect for all players.
  useEffect(() => {
    if (!tournament?.started_at || gameEnded) return;
    const endMs = new Date(tournament.started_at).getTime() + tournament.duration_minutes * 60 * 1000;

    const iv = setInterval(() => {
      const remaining = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
      setTimeRemaining(remaining);
      if (remaining === 0 && !gameEndedRef.current) handleGameEnd(true);
    }, 1000);

    return () => clearInterval(iv);
  }, [tournament?.started_at, tournament?.duration_minutes, gameEnded]);

  // Realtime: redirect ALL players the moment tournament status → 'finished'.
  // No redirectingRef gate — the server is the authority. When it says finished,
  // every client redirects immediately regardless of local game state.
  useEffect(() => {
    if (!tournamentId) return;
    const ch = supabase
      .channel(`play-status:${tournamentId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'tournaments',
        filter: `id=eq.${tournamentId}`,
      }, (payload) => {
        if ((payload.new as any).status === 'finished')
          router.push(`/tournament/${tournamentId}/results`);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tournamentId]);

  // Start game when status is running
  useEffect(() => {
    if (!tournament || gameStarted) return;
    if (tournament.status === 'running') {
      setGameStarted(true);
      gameMetrics.current.game_start_time = Date.now();
    }
  }, [tournament?.status, gameStarted]);

  // Periodic score submission every 10s
  useEffect(() => {
    if (!gameStarted || gameEnded) return;
    const iv = setInterval(() => submitScore(false), 10000);
    return () => clearInterval(iv);
  }, [gameStarted, gameEnded]);

  const submitScore = async (isFinal: boolean): Promise<number> => {
    if (!session || !tournamentId) return scoreRef.current;
    const now = Date.now();
    if (!isFinal && now - lastSubmit.current < 2000) return scoreRef.current;
    lastSubmit.current = now;

    const scoreToSubmit = scoreRef.current;
    console.log('[submitScore]', { scoreToSubmit, isFinal });
    try {
      await fetch('/api/tournaments/submit-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: tournamentId,
          score:         scoreToSubmit,
          is_final:      isFinal,
          game_metrics: {
            balls_dropped:         gameMetrics.current.balls_dropped,
            merges_completed:      gameMetrics.current.merges_completed,
            game_duration_seconds: Math.floor((now - gameMetrics.current.game_start_time) / 1000),
          },
        }),
      });
    } catch (err) { console.error('[play] submit error:', err); }
    return scoreToSubmit;
  };

  const handleGameEnd = async (timeExpired: boolean) => {
    if (gameEndedRef.current) return;
    gameEndedRef.current = true;
    setGameEnded(true);

    // Submit final score — this is ALL the client does.
    // If timeExpired: server's auto-finalize (or pg_cron) will set status=finished
    //   and Realtime will redirect all players.
    // If player finished early: they see the waiting screen until Realtime fires.
    const submitted = await submitScore(true);

    if (!timeExpired) {
      // Player finished before timer — show waiting screen
      setPlayerFinished(true);
      setFinalScore(submitted || scoreRef.current);
      setPlayerUsername(session?.user?.name || session?.user?.email?.split('@')[0] || 'Player');
    }
    // timeExpired case: overlay is already shown, Realtime redirect will arrive shortly
  };

  // Host ends tournament early — POST to creator-authenticated server endpoint.
  // Server validates creator, triggers finalize, status change propagates via Realtime.
  const handleEndTournament = async () => {
    if (!window.confirm('End this tournament now for all players?')) return;
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const d = await res.json();
        console.error('[play] end tournament failed:', d.error);
      }
      // On success, server sets status=finished → Realtime redirects all players
    } catch (err) {
      console.error('[play] end tournament error:', err);
    }
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (!tournament) return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-white text-2xl">Loading tournament...</div>
    </div>
  );

  if (playerFinished) return (
    <TournamentWaitingScreen
      tournamentId={tournamentId}
      playerScore={finalScore}
      playerUsername={playerUsername}
    />
  );

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {gameEnded && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <h1 className="text-6xl font-black text-white mb-4">TIME'S UP!</h1>
            <p className="text-2xl text-purple-400 mb-4">Final Score: {currentScore.toLocaleString()}</p>
            <p className="text-gray-400">Waiting for results...</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-md border-b border-purple-500/30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className={`px-4 py-2 rounded-xl font-mono text-2xl font-black ${
            timeRemaining <= 60  ? 'bg-red-500/20 text-red-400 animate-pulse' :
            timeRemaining <= 300 ? 'bg-yellow-500/20 text-yellow-400' :
                                   'bg-green-500/20 text-green-400'
          }`}>
            ⏱️ {formatTime(timeRemaining)}
          </div>

          <div className="text-2xl font-black text-purple-400">
            {currentScore.toLocaleString()}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowLeaderboard(s => !s)}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-sm"
            >
              {showLeaderboard ? 'Hide' : 'Show'} Ranks
            </button>
            <button
              onClick={handleEndTournament}
              className="px-3 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg font-bold text-sm border border-red-500/30"
            >
              🛑 End
            </button>
          </div>
        </div>
      </div>

      {/* Game + Leaderboard */}
      <div className="pt-20 h-screen flex">
        <div className={`flex-1 overflow-hidden ${showLeaderboard ? 'sm:w-2/3' : 'w-full'}`}>
          <div className="h-full flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-purple-900">
            <MergeGame
              tournamentMode={true}
              onScoreChange={(s) => { setCurrentScore(s); scoreRef.current = s; }}
              onBallDropped={() => gameMetrics.current.balls_dropped++}
              onMerge={() => gameMetrics.current.merges_completed++}
              onGameOver={() => handleGameEnd(false)}
              disabled={gameEnded}
            />
          </div>
        </div>
        {showLeaderboard && (
          <div className="hidden sm:block sm:w-1/3 border-l border-purple-500/30 bg-gray-900/50 overflow-y-auto p-4">
            <LiveLeaderboard
              tournamentId={tournamentId}
              currentUserId={currentUserDbId || undefined}
              compact={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}
