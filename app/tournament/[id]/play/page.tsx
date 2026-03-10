'use client';

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
  const supabase = createClient();

  const [tournament, setTournament] = useState<any>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [currentScore, setCurrentScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const [playerFinished, setPlayerFinished] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [playerUsername, setPlayerUsername] = useState('');
  // currentUserDbId resolved from /api/user/me so LiveLeaderboard can highlight correctly
  const [currentUserDbId, setCurrentUserDbId] = useState<string | null>(null);

  const gameMetrics = useRef({ balls_dropped: 0, merges_completed: 0, game_start_time: 0 });
  const lastScoreSubmission = useRef(0);
  const tournamentId = params.id as string;

  // Resolve DB uuid once on mount
  useEffect(() => {
    fetch('/api/user/me').then(r => r.json()).then(d => { if (d.id) setCurrentUserDbId(d.id); });
  }, []);

  useEffect(() => {
    if (!tournamentId) return;
    supabase.from('tournaments').select('*').eq('id', tournamentId).single()
      .then(({ data }) => {
        if (data) {
          setTournament(data);
          if (data.started_at) {
            // Calculate remaining time from started_at + duration
            // Duration is not stored — default to 10 min if not set
            const durationMs = (data.duration_minutes || 10) * 60 * 1000;
            const endTime = new Date(data.started_at).getTime() + durationMs;
            const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
            setTimeRemaining(remaining);
          }
        }
      });
  }, [tournamentId]);

  useEffect(() => {
    if (timeRemaining <= 0 || gameEnded) return;
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) { handleGameEnd(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeRemaining, gameEnded]);

  useEffect(() => {
    if (!tournament || gameStarted) return;
    if (tournament.status === 'active') {
      setGameStarted(true);
      gameMetrics.current.game_start_time = Date.now();
      // Update participant status — service role handles this server-side on score submit
    }
  }, [tournament?.status, gameStarted]);

  useEffect(() => {
    if (!gameStarted || gameEnded || currentScore === 0) return;
    const interval = setInterval(() => submitScore(false), 10000);
    return () => clearInterval(interval);
  }, [gameStarted, gameEnded, currentScore]);

  const submitScore = async (isFinal: boolean): Promise<number> => {
    if (!session || !tournamentId) return currentScore;
    const now = Date.now();
    if (!isFinal && now - lastScoreSubmission.current < 2000) return currentScore;
    lastScoreSubmission.current = now;

    const gameDuration = Math.floor((now - gameMetrics.current.game_start_time) / 1000);
    const scoreToSubmit = currentScore;

    try {
      await fetch('/api/tournaments/submit-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: tournamentId,
          score: scoreToSubmit,
          is_final: isFinal,   // ← correct field name
          game_metrics: {
            balls_dropped: gameMetrics.current.balls_dropped,
            merges_completed: gameMetrics.current.merges_completed,
            game_duration_seconds: gameDuration,
          },
        }),
      });
    } catch (err) { console.error('Score submit error:', err); }

    return scoreToSubmit;
  };

  const handleGameEnd = async (timeExpired: boolean) => {
    if (gameEnded) return;
    setGameEnded(true);
    const submittedScore = await submitScore(true);

    if (timeExpired || timeRemaining <= 0) {
      setTimeout(() => router.push(`/tournament/${tournamentId}/results`), 3000);
    } else {
      setPlayerFinished(true);
      setFinalScore(submittedScore || currentScore);
      setPlayerUsername(session?.user?.name || session?.user?.email?.split('@')[0] || 'Player');
    }
  };

  const handleEndTournament = async () => {
    if (!window.confirm('End this tournament now?')) return;
    const r = await fetch('/api/tournaments/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournament_id: tournamentId }),
    });
    if (r.ok) router.push(`/tournament/${tournamentId}/results`);
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

      <div className="fixed top-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-md border-b border-purple-500/30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className={`px-6 py-3 rounded-xl font-mono text-3xl font-black ${timeRemaining <= 60 ? 'bg-red-500/20 text-red-400 animate-pulse' : timeRemaining <= 300 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
            ⏱️ {formatTime(timeRemaining)}
          </div>
          <div className="text-3xl font-black text-purple-400">{currentScore.toLocaleString()}</div>
          <div className="flex gap-2">
            <button onClick={() => setShowLeaderboard(!showLeaderboard)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-sm">
              {showLeaderboard ? 'Hide' : 'Show'} Ranks
            </button>
            <button onClick={handleEndTournament} className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg font-bold text-sm border border-red-500/30">
              🛑 End
            </button>
          </div>
        </div>
      </div>

      <div className="pt-20 h-screen flex">
        <div className={`flex-1 ${showLeaderboard ? 'sm:w-2/3' : 'w-full'} overflow-hidden`}>
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
