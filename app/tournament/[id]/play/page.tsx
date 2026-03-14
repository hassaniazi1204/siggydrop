'use client';
// Play page — UI concerns only:
//   - Timer above the game canvas, centered to canvas width
//   - 5-second start countdown overlay
//   - ⓘ info button (top-right)
//   - No score display (canvas shows score)
//   - No End button, no Hide Leaderboard button
//   - Leaderboard always visible on the right
//
// Architecture unchanged:
//   - Only calls /api/tournaments/submit-score
//   - Never calls /finalize directly
//   - Realtime redirect when status → finished

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useSession } from 'next-auth/react';
import LiveLeaderboard from '@/components/LiveLeaderboard';
import MergeGame from '@/components/MergeGame';
import TournamentWaitingScreen from '@/components/TournamentWaitingScreen';

// ── Info modal ────────────────────────────────────────────────────────────────
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
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-black text-white">How to Play</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="space-y-5 text-sm text-gray-300">
          <div>
            <h3 className="text-purple-400 font-bold mb-2">Basics</h3>
            <ul className="space-y-1 list-disc list-inside">
              <li>Click or tap to drop a ball onto the field</li>
              <li>Balls of the same level merge when they touch</li>
              <li>Merged balls become the next level up</li>
              <li>Score as high as possible before the timer runs out</li>
              <li>Don't let balls cross the red line!</li>
            </ul>
          </div>
          <div>
            <h3 className="text-purple-400 font-bold mb-2">Merge Guide</h3>
            <div className="flex justify-center">
              <img
                src="/avatars/Ritual wheel.png"
                alt="Ritual Wheel"
                className="w-full max-w-[200px] h-auto"
                style={{ filter: 'drop-shadow(0 0 16px rgba(64,255,175,0.3))' }}
              />
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

// ── Start countdown overlay ───────────────────────────────────────────────────
// Sequence: 5 → 4 → 3 → 2 → 1 → GO! → [done]
// Each step (including GO) shows for exactly 2 seconds.
// Total: 12 seconds (6 steps × 2s). onDone() fires after GO disappears.
//
// State:  5..1 = show number,  0 = show GO,  -1 = call onDone + unmount
// animKey increments every step so the CSS animation restarts cleanly.
function StartCountdown({ onDone }: { onDone: () => void }) {
  const [step, setStep]       = useState(5);   // 5,4,3,2,1,0,-1
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (step === -1) { onDone(); return; }
    const t = setTimeout(() => {
      setStep(s => s - 1);
      setAnimKey(k => k + 1);
    }, 2000);                  // ← exactly 2 seconds per step
    return () => clearTimeout(t);
  }, [step, onDone]);

  if (step === -1) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/55 backdrop-blur-[2px] rounded-2xl pointer-events-none">
      <div className="text-center">
        {step > 0 ? (
          <div
            key={animKey}
            className="font-black text-white select-none"
            style={{
              fontSize: '9rem',
              lineHeight: 1,
              textShadow: '0 0 60px rgba(168,85,247,0.9), 0 0 20px rgba(168,85,247,0.5)',
              animation: 'cdPop 1.8s ease-out forwards',
            }}
          >
            {step}
          </div>
        ) : (
          <div
            key={animKey}
            className="font-black text-purple-400 select-none"
            style={{
              fontSize: '7rem',
              lineHeight: 1,
              textShadow: '0 0 60px rgba(168,85,247,0.9)',
              animation: 'cdPop 1.8s ease-out forwards',
            }}
          >
            GO!
          </div>
        )}
      </div>
      <style>{`
        @keyframes cdPop {
          0%   { transform: scale(1.8); opacity: 0; }
          15%  { transform: scale(1.0); opacity: 1; }
          70%  { transform: scale(1.0); opacity: 1; }
          100% { transform: scale(0.6); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default function TournamentGamePage() {
  const params       = useParams();
  const router       = useRouter();
  const { data: session } = useSession();

  const supabaseRef  = useRef(createClient());
  const supabase     = supabaseRef.current;

  const [tournament, setTournament]         = useState<any>(null);
  const [timeRemaining, setTimeRemaining]   = useState<number>(0);
  const [currentScore, setCurrentScore]     = useState(0);   // kept for TIME'S UP overlay only
  const [gameStarted, setGameStarted]       = useState(false);
  const [gameEnded, setGameEnded]           = useState(false);
  const [playerFinished, setPlayerFinished] = useState(false);
  const [finalScore, setFinalScore]         = useState(0);
  const [playerUsername, setPlayerUsername] = useState('');
  const [currentUserDbId, setCurrentUserDbId] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal]   = useState(false);
  // Countdown: true = showing 5-4-3-2-1, false = game active
  const [showCountdown, setShowCountdown]   = useState(false);
  // Music mute — owned here, pushed into MergeGame via externalIsMuted prop
  const [isMuted, setIsMuted]               = useState(false);

  const gameMetrics  = useRef({ balls_dropped: 0, merges_completed: 0, game_start_time: 0 });
  const lastSubmit   = useRef(0);
  const gameEndedRef = useRef(false);
  const scoreRef     = useRef(0);
  const tournamentId = params.id as string;

  // ── Logic (all unchanged) ─────────────────────────────────────────────────

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

  // When status becomes running: show countdown, then start game
  useEffect(() => {
    if (!tournament || gameStarted) return;
    if (tournament.status === 'running') {
      setShowCountdown(true); // countdown will call handleCountdownDone when finished
    }
  }, [tournament?.status, gameStarted]);

  useEffect(() => {
    if (!gameStarted || gameEnded) return;
    const iv = setInterval(() => submitScore(false), 10000);
    return () => clearInterval(iv);
  }, [gameStarted, gameEnded]);

  // useCallback gives a stable reference — without this, onDone changes every render
  // which resets the countdown useEffect and causes the infinite restart bug.
  const handleCountdownDone = useCallback(() => {
    setShowCountdown(false);
    setGameStarted(true);
    gameMetrics.current.game_start_time = Date.now();
  }, []);

  const submitScore = async (isFinal: boolean): Promise<number> => {
    if (!session || !tournamentId) return scoreRef.current;
    const now = Date.now();
    if (!isFinal && now - lastSubmit.current < 2000) return scoreRef.current;
    lastSubmit.current = now;
    const scoreToSubmit = scoreRef.current;
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
      // Player's game ended (balls crossed line) before timer — show waiting screen
      setPlayerFinished(true);
      setFinalScore(submitted || scoreRef.current);
      setPlayerUsername(session?.user?.name || session?.user?.email?.split('@')[0] || 'Player');
    } else {
      // Timer expired — this is the authoritative end of the tournament.
      // Force-finalize regardless of whether other players have submitted.
      // The TIME'S UP overlay is already showing; Realtime will redirect everyone.
      try {
        await fetch(`/api/tournaments/${tournamentId}/finalize`, { method: 'POST' });
      } catch (e) {
        console.error('[play] force-finalize on timer expiry failed:', e);
      }
    }
  };

  // ── Timer formatting ──────────────────────────────────────────────────────

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const timerColor =
    timeRemaining <= 60  ? 'text-red-400'    :
    timeRemaining <= 300 ? 'text-yellow-300' :
                           'text-green-400';

  const timerBorder =
    timeRemaining <= 60  ? 'border-red-500/50'    :
    timeRemaining <= 300 ? 'border-yellow-400/40' :
                           'border-green-500/30';

  // ── Early exits ───────────────────────────────────────────────────────────

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

  // ── Main layout ───────────────────────────────────────────────────────────
  //
  //  ┌─────────────────────────────────────────────┐
  //  │  [ thin top bar: tournament name + ⓘ ]      │
  //  ├──────────────────────┬──────────────────────┤
  //  │   ⏱ 01:42            │                      │
  //  │  ┌──────────────┐    │   LIVE LEADERBOARD   │
  //  │  │  GAME CANVAS │    │                      │
  //  │  └──────────────┘    │                      │
  //  └──────────────────────┴──────────────────────┘

  return (
    <div className="min-h-screen bg-black flex flex-col overflow-hidden">

      {/* TIME'S UP overlay */}
      {gameEnded && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <h1 className="text-6xl font-black text-white mb-4">TIME'S UP!</h1>
            <p className="text-2xl text-purple-400 mb-4">Final Score: {currentScore.toLocaleString()}</p>
            <p className="text-gray-400">Waiting for results...</p>
          </div>
        </div>
      )}

      {showInfoModal && <InfoModal onClose={() => setShowInfoModal(false)} />}

      {/* ── Thin top bar: tournament label + [ 🔊 Music ] [ ⓘ ] ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-black/70 border-b border-purple-500/15">
        <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">
          🏆 Tournament
        </span>
        <div className="flex items-center gap-2">
          {/* Music toggle — state owned here, synced into MergeGame */}
          <button
            onClick={() => setIsMuted(m => !m)}
            title={isMuted ? 'Unmute music' : 'Mute music'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors
              ${isMuted
                ? 'bg-gray-800/60 text-gray-400 border-gray-600/40 hover:bg-gray-700/80'
                : 'bg-green-900/40 text-green-300 border-green-500/40 hover:bg-green-800/50'
              }`}
          >
            {isMuted ? '🔇' : '🔊'}
            <span className="hidden sm:inline">{isMuted ? 'Unmute' : 'Music'}</span>
          </button>
          {/* Info button */}
          <button
            onClick={() => setShowInfoModal(true)}
            title="How to Play"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800/60 hover:bg-gray-700/80 text-gray-400 hover:text-white border border-gray-600/40 transition-colors text-sm font-bold"
          >
            ⓘ
          </button>
        </div>
      </div>

      {/* ── Main content: canvas column + leaderboard column ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: timer above canvas */}
        <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-black via-gray-900 to-purple-950 gap-3 px-4 py-4">

          {/* Timer — centered to the canvas width (360px max) */}
          <div className="w-full flex justify-center" style={{ maxWidth: '360px' }}>
            <div className={`
              w-full flex items-center justify-center gap-2 py-2 rounded-xl border
              bg-black/60 font-mono font-black ${timerColor} ${timerBorder}
              ${timeRemaining <= 60 ? 'animate-pulse' : ''}
            `}>
              <span className="text-base">⏱</span>
              <span className="text-3xl tracking-tight">{formatTime(timeRemaining)}</span>
            </div>
          </div>

          {/* Canvas + countdown overlay */}
          <div className="relative" style={{ width: '360px', maxWidth: '100%' }}>
            {showCountdown && <StartCountdown onDone={handleCountdownDone} />}
            <MergeGame
              tournamentMode={true}
              onScoreChange={(s) => { setCurrentScore(s); scoreRef.current = s; }}
              onBallDropped={() => gameMetrics.current.balls_dropped++}
              onMerge={() => gameMetrics.current.merges_completed++}
              onGameOver={() => handleGameEnd(false)}
              disabled={gameEnded || showCountdown}
              externalIsMuted={isMuted}
              onMuteChange={(muted) => setIsMuted(muted)}
            />
          </div>
        </div>

        {/* RIGHT: leaderboard — always visible, no hide button */}
        <div className="hidden sm:flex w-80 flex-shrink-0 flex-col border-l border-purple-500/20 bg-gray-950/60 overflow-y-auto">
          <div className="p-4 flex-1">
            <LiveLeaderboard
              tournamentId={tournamentId}
              currentUserId={currentUserDbId || undefined}
              compact={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
