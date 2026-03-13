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

// ── Info modal — shown when player clicks ⓘ ──────────────────────────────────
function InfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-purple-500/40 rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-white">How to Play</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 text-sm text-gray-300">
          <div>
            <h3 className="text-purple-400 font-bold mb-2">Basics</h3>
            <ul className="space-y-1 list-disc list-inside">
              <li>Click or tap to drop a ball onto the playing field</li>
              <li>Balls of the same number merge when they touch</li>
              <li>Merged balls become the next number up</li>
              <li>Score as high as possible before the timer runs out</li>
            </ul>
          </div>

          <div>
            <h3 className="text-purple-400 font-bold mb-2">Merge Guide</h3>
            <div className="grid grid-cols-2 gap-1 font-mono text-xs">
              {[
                ['1 + 1', '2'], ['2 + 2', '4'], ['4 + 4', '8'],
                ['8 + 8', '16'], ['16 + 16', '32'], ['32 + 32', '64'],
              ].map(([from, to]) => (
                <div key={from} className="flex items-center gap-2 bg-black/30 rounded px-2 py-1">
                  <span className="text-gray-400">{from}</span>
                  <span className="text-purple-400">=</span>
                  <span className="text-white font-bold">{to}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-purple-400 font-bold mb-2">Tips</h3>
            <ul className="space-y-1 list-disc list-inside">
              <li>Chain merges for bonus points</li>
              <li>Keep the board tidy to avoid running out of space</li>
              <li>Watch the live leaderboard to gauge your competition</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  // UI-only state — no effect on game logic
  const [showInfoModal, setShowInfoModal]     = useState(false);

  const gameMetrics  = useRef({ balls_dropped: 0, merges_completed: 0, game_start_time: 0 });
  const lastSubmit   = useRef(0);
  const gameEndedRef = useRef(false);
  const scoreRef     = useRef(0);
  const tournamentId = params.id as string;

  // ── All logic below is UNCHANGED from previous version ───────────────────

  useEffect(() => {
    if (!session) return;
    fetch('/api/user/me').then(r => r.json()).then(d => { if (d.id) setCurrentUserDbId(d.id); });
  }, [session]);

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

  useEffect(() => {
    if (!tournament || gameStarted) return;
    if (tournament.status === 'running') {
      setGameStarted(true);
      gameMetrics.current.game_start_time = Date.now();
    }
  }, [tournament?.status, gameStarted]);

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
    const submitted = await submitScore(true);
    if (!timeExpired) {
      setPlayerFinished(true);
      setFinalScore(submitted || scoreRef.current);
      setPlayerUsername(session?.user?.name || session?.user?.email?.split('@')[0] || 'Player');
    }
  };

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
    } catch (err) {
      console.error('[play] end tournament error:', err);
    }
  };

  // ── Formatting helpers ────────────────────────────────────────────────────

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const timerColor =
    timeRemaining <= 60  ? 'text-red-400'    :
    timeRemaining <= 300 ? 'text-yellow-400' :
                           'text-green-400';

  const timerBg =
    timeRemaining <= 60  ? 'bg-red-500/10 border-red-500/40'       :
    timeRemaining <= 300 ? 'bg-yellow-500/10 border-yellow-500/40' :
                           'bg-green-500/10 border-green-500/40';

  // ── Early-exit renders (logic unchanged) ─────────────────────────────────

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

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-black flex flex-col overflow-hidden">

      {/* Time-up overlay (logic unchanged) */}
      {gameEnded && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <h1 className="text-6xl font-black text-white mb-4">TIME'S UP!</h1>
            <p className="text-2xl text-purple-400 mb-4">Final Score: {currentScore.toLocaleString()}</p>
            <p className="text-gray-400">Waiting for results...</p>
          </div>
        </div>
      )}

      {/* Info modal */}
      {showInfoModal && <InfoModal onClose={() => setShowInfoModal(false)} />}

      {/* ── Header bar ──────────────────────────────────────────────────── */}
      {/*                                                                    */}
      {/*   [ Score ]     [ ⏱ TIMER ]     [ Ranks | End | ⓘ ]             */}
      {/*                                                                    */}
      {/* Timer is centered between score (left) and controls (right).      */}
      <div className="flex-shrink-0 bg-black/90 backdrop-blur-md border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 py-2 grid grid-cols-3 items-center gap-2">

          {/* Left — current score */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 uppercase tracking-widest hidden sm:block">Score</span>
            <span className="text-2xl font-black text-purple-300 tabular-nums">
              {currentScore.toLocaleString()}
            </span>
          </div>

          {/* Centre — tournament timer, visually dominant */}
          <div className="flex justify-center">
            <div className={`
              flex items-center gap-2 px-5 py-2 rounded-xl border font-mono font-black
              ${timerBg} ${timerColor}
              ${timeRemaining <= 60 ? 'animate-pulse' : ''}
            `}>
              <span className="text-lg">⏱</span>
              <span className="text-3xl tracking-tight">{formatTime(timeRemaining)}</span>
            </div>
          </div>

          {/* Right — controls */}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setShowLeaderboard(s => !s)}
              className="px-3 py-2 bg-purple-800/50 hover:bg-purple-700/60 text-purple-200 rounded-lg font-bold text-xs border border-purple-500/30 transition-colors"
            >
              {showLeaderboard ? 'Hide' : 'Show'} Ranks
            </button>
            <button
              onClick={handleEndTournament}
              className="px-3 py-2 bg-red-900/30 hover:bg-red-800/50 text-red-400 rounded-lg font-bold text-xs border border-red-500/30 transition-colors"
            >
              🛑 End
            </button>
            {/* ⓘ Info button — opens How to Play / Merge Guide modal */}
            <button
              onClick={() => setShowInfoModal(true)}
              title="How to Play"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800/60 hover:bg-gray-700/80 text-gray-400 hover:text-white border border-gray-600/40 transition-colors text-sm font-bold"
            >
              ⓘ
            </button>
          </div>
        </div>
      </div>

      {/* ── Game canvas + Leaderboard (side-by-side, unchanged) ──────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Game canvas — left panel */}
        <div className={`flex-1 overflow-hidden ${showLeaderboard ? 'sm:w-2/3' : 'w-full'}`}>
          <div className="h-full flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-purple-900">
            {/*
              MergeGame receives tournamentMode=true which hides:
                - "How to Play" section
                - "Merge Guide" section
                - "Restart Game" button
              No changes to MergeGame props or logic.
            */}
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

        {/* Leaderboard — right panel */}
        {showLeaderboard && (
          <div className="hidden sm:flex sm:w-1/3 flex-col border-l border-purple-500/20 bg-gray-950/60 overflow-y-auto">
            <div className="p-4 flex-1">
              <LiveLeaderboard
                tournamentId={tournamentId}
                currentUserId={currentUserDbId || undefined}
                compact={true}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
