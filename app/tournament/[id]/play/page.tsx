'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useSession } from 'next-auth/react';
import LiveLeaderboard from '@/components/LiveLeaderboard';
import MergeGame from '@/components/MergeGame';

interface Tournament {
  id: string;
  name: string;
  duration_minutes: number;
  actual_start_time: string;
  end_time: string;
  status: string;
}

export default function TournamentGamePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const supabase = createClient();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [currentScore, setCurrentScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(true);

  // Game metrics for anti-cheat
  const gameMetrics = useRef({
    balls_dropped: 0,
    merges_completed: 0,
    game_start_time: 0,
  });

  const lastScoreSubmission = useRef(0);
  const tournamentId = params.id as string;

  // Fetch tournament
  useEffect(() => {
    if (!tournamentId) return;

    const fetchTournament = async () => {
      const { data } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (data) {
        setTournament(data);
        
        if (data.end_time) {
          const endTime = new Date(data.end_time).getTime();
          const now = Date.now();
          const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
          setTimeRemaining(remaining);
        }
      }
    };

    fetchTournament();
  }, [tournamentId, supabase]);

  // Tournament timer
  useEffect(() => {
    if (timeRemaining <= 0 || gameEnded) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 1;
        
        if (newTime <= 0) {
          handleGameEnd(true);
          return 0;
        }
        
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining, gameEnded]);

  // Start game
  useEffect(() => {
    if (!tournament || gameStarted) return;

    if (tournament.status === 'active') {
      setGameStarted(true);
      gameMetrics.current.game_start_time = Date.now();
      
      supabase
        .from('tournament_participants')
        .update({
          status: 'playing',
          game_started_at: new Date().toISOString(),
        })
        .eq('tournament_id', tournamentId)
        .eq('user_id', (session?.user as any)?.id);
    }
  }, [tournament?.status, gameStarted, tournamentId, session, supabase]);

  // Submit score periodically
  useEffect(() => {
    if (!gameStarted || gameEnded || currentScore === 0) return;

    const interval = setInterval(() => {
      submitScore(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [gameStarted, gameEnded, currentScore]);

  // Submit score to server
  const submitScore = async (isFinal: boolean) => {
    if (!session || !tournamentId) return;

    const now = Date.now();
    if (!isFinal && now - lastScoreSubmission.current < 2000) {
      return;
    }
    lastScoreSubmission.current = now;

    const gameDuration = Math.floor((now - gameMetrics.current.game_start_time) / 1000);

    try {
      await fetch('/api/tournaments/submit-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: tournamentId,
          score: currentScore,
          final_score: isFinal,
          game_metrics: {
            balls_dropped: gameMetrics.current.balls_dropped,
            merges_completed: gameMetrics.current.merges_completed,
            game_duration_seconds: gameDuration,
          },
        }),
      });
    } catch (error) {
      console.error('Error submitting score:', error);
    }
  };

  // Handle game end
  const handleGameEnd = async (timeExpired: boolean) => {
    if (gameEnded) return;
    
    setGameEnded(true);
    await submitScore(true);
    
    setTimeout(() => {
      router.push(`/tournament/${tournamentId}/results`);
    }, 3000);
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Game callbacks
  const onScoreChange = (newScore: number) => {
    setCurrentScore(newScore);
  };

  const onBallDropped = () => {
    gameMetrics.current.balls_dropped++;
  };

  const onMerge = () => {
    gameMetrics.current.merges_completed++;
  };

  if (!tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-white text-2xl">Loading tournament...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Time-Up Overlay */}
      {gameEnded && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <h1 className="text-6xl font-black text-white mb-4">TIME'S UP!</h1>
            <p className="text-2xl text-purple-400 mb-4">Final Score: {currentScore.toLocaleString()}</p>
            <p className="text-gray-400">Redirecting to results...</p>
          </div>
        </div>
      )}

      {/* Tournament Header */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-md border-b border-purple-500/30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-black text-white">{tournament.name}</h1>
            <p className="text-xs text-gray-400">Tournament Mode</p>
          </div>

          <div className={`px-6 py-3 rounded-xl font-mono text-3xl font-black ${
            timeRemaining <= 60 ? 'bg-red-500/20 text-red-400 animate-pulse' :
            timeRemaining <= 300 ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-green-500/20 text-green-400'
          }`}>
            ⏱️ {formatTime(timeRemaining)}
          </div>

          <div className="text-right">
            <div className="text-3xl font-black text-purple-400">
              {currentScore.toLocaleString()}
            </div>
            <p className="text-xs text-gray-400">Your Score</p>
          </div>

          <button
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-colors text-sm"
          >
            {showLeaderboard ? 'Hide' : 'Show'} Ranks
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-20 flex h-screen">
        {/* Game Area */}
        <div className={`transition-all duration-300 ${showLeaderboard ? 'w-2/3' : 'w-full'}`}>
          <MergeGame
            tournamentMode={true}
            onScoreChange={onScoreChange}
            onBallDropped={onBallDropped}
            onMerge={onMerge}
            disabled={gameEnded}
          />
        </div>

        {/* Leaderboard Sidebar */}
        {showLeaderboard && (
          <div className="w-1/3 border-l border-purple-500/30 bg-gray-900/50 backdrop-blur-md overflow-y-auto">
            <div className="p-6">
              <LiveLeaderboard 
                tournamentId={tournamentId}
                currentUserId={(session?.user as any)?.id}
                compact={true}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
