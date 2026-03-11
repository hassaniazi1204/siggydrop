'use client';
// ChatGPT Steps 3+4: timer derived from end_time, auto-redirect when finished

import { useEffect, useState, useRef, useCallback } from 'react';
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
  const supabase = createClient();

  const [tournament, setTournament]         = useState<any>(null);
  const [timeRemaining, setTimeRemaining]   = useState<number>(0);
  const [currentScore, setCurrentScore]     = useState(0);
  const [gameStarted, setGameStarted]       = useState(false);
  const [gameEnded, setGameEnded]           = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const [playerFinished, setPlayerFinished] = useState(false);
  const [finalScore, setFinalScore]         = useState(0);
  const [playerUsername, setPlayerUsername] = useState('');
  const [currentUserDbId, setCurrentUserDbId] = useState<string | null>(null);

  const gameMetrics     = useRef({ balls_dropped: 0, merges_completed: 0, game_start_time: 0 });
  const lastSubmit      = useRef(0);
  const endTimeRef      = useRef<number | null>(null);
  const gameEndedRef    = useRef(false);
  const tournamentId    = params.id as string;

  // Resolve DB uuid
  useEffect(() => {
    fetch('/api/user/me').then(r => r.json()).then(d => { if (d.id) setCurrentUserDbId(d.id); });
  }, []);

  // Load tournament — derive timer from end_time
  useEffect(() => {
    if (!tournamentId) return;
    supabase.from('tournaments').select('*').eq('id', tournamentId).single()
      .then(({ data }) => {
        if (!data) return;
        setTournament(data);
        if (data.end_time) {
          endTimeRef.current = new Date(data.end_time).getTime();
          const remaining = Math.max(0, Math.floor((endTimeRef.current - Date.now()) / 1000));
          setTimeRemaining(remaining);
        }
      });
  }, [tournamentId]);

  // ChatGPT Step 4: timer counts down from end_time every second
  useEffect(() => {
    if (!tournament || gameEnded) return;
    const iv = setInterval(() => {
      if (!endTimeRef.current) return;
      const remaining = Math.max(0, Math.floor((endTimeRef.current - Date.now()) / 1000));
      setTimeRemaining(remaining);
      if (remaining === 0 && !gameEndedRef.current) handleGameEnd(true);
    }, 1000);
    return () => clearInterval(iv);
  }, [tournament, gameEnded]);

  // Realtime: redirect all players when tournament finishes
  useEffect(() => {
    if (!tournamentId) return;
    const ch = supabase.channel(`t-status:${tournamentId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'tournaments',
        filter: `id=eq.${tournamentId}`,
      }, (payload) => {
        if ((payload.new as any).status === 'finished') {
          setTimeout(() => router.push(`/tournament/${tournamentId}/results`), 1500);
        }
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tournamentId]);

  // Start game
  useEffect(() => {
    if (!tournament || gameStarted) return;
    if (tournament.status === 'active') {
      setGameStarted(true);
      gameMetrics.current.game_start_time = Date.now();
    }
  }, [tournament?.status, gameStarted]);

  // Periodic score submission every 10s
  useEffect(() => {
    if (!gameStarted || gameEnded) return;
    const iv = setInterval(() => submitScore(false), 10000);
    return () => clearInterval(iv);
  }, [gameStarted, gameEnded, currentScore]);

  const submitScore = async (isFinal: boolean): Promise<number> => {
    if (!session || !tournamentId) return currentScore;
    const now = Date.now();
    if (!isFinal && now - lastSubmit.current < 2000) return currentScore;
    lastSubmit.current = now;

    const gameDuration = Math.floor((now - gameMetrics.current.game_start_time) / 1000);
    const scoreToSubmit = currentScore;

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
            game_duration_seconds: gameDuration,
          },
        }),
      });
    } catch (err) { console.error('Score submit error:', err); }
    return scoreToSubmit;
  };

  const handleGameEnd = async (timeExpired: boolean) => {
    if (gameEndedRef.current) return;
    gameEndedRef.current = true;
    setGameEnded(true);
    const submitted = await submitScore(true);

    if (timeExpired) {
      setTimeout(() => router.push(`/tournament/${tournamentId}/results`), 3000);
    } else {
      setPlayerFinished(true);
      setFinalScore(submitted || currentScore);
      setPlayerUsername(session?.user?.name || session?.user?.email?.split('@')[0] || 'Player');
    }
  };

  const handleEndTournament = async () => {
    if (!window.confirm('End this tournament now?')) return;
    await fetch('/api/tournaments/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournament_id: tournamentId }),
    });
    router.push(`/tournament/${tournamentId}/results`);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (!tournament) return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-white text-2xl">Loading tournament...</div>
    </div>
  );

  if (playerFinished) return (
    <TournamentWaitingScreen tournamentId={tournamentId} playerScore={finalScore} playerUsername={playerUsername} />
  );

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {gameEnded && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <h1 className="text-6xl font-black text-white mb-4">TIME'S UP!</h1>
            <p className="text-2xl text-purple-400 mb-4">Final Score: {currentScore.toLocaleString()}</p>
            <p className="text-gray-400">Redirecting to results...</p>
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
          }`}>⏱️ {formatTime(timeRemaining)}</div>

          <div className="text-2xl font-black text-purple-400">{currentScore.toLocaleString()}</div>

          <div className="flex gap-2">
            <button onClick={() => setShowLeaderboard(s => !s)}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-sm">
              {showLeaderboard ? 'Hide' : 'Show'} Ranks
            </button>
            <button onClick={handleEndTournament}
              className="px-3 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg font-bold text-sm border border-red-500/30">
              🛑 End
            </button>
          </div>
        </div>
      </div>

      <div className="pt-20 h-screen flex">
        <div className={`flex-1 overflow-hidden ${showLeaderboard ? 'sm:w-2/3' : 'w-full'}`}>
          <div className="h-full flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-purple-900">
            <MergeGame
              tournamentMode={true}
              onScoreChange={setCurrentScore}
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
