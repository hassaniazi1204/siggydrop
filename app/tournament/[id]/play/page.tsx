'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useSession } from 'next-auth/react';
import LiveLeaderboard from '@/components/LiveLeaderboard';
import MergeGame from '@/components/MergeGame';
import TournamentWaitingScreen from '@/components/TournamentWaitingScreen';

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
  const [isCreator, setIsCreator] = useState(false);
  const [playerFinished, setPlayerFinished] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [playerUsername, setPlayerUsername] = useState('');

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
        
        // Check if current user is creator
        const userId = (session?.user as any)?.id || session?.user?.email || localStorage.getItem('guestUserId');
        setIsCreator(userId === data.created_by);
        
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
  const submitScore = async (isFinal: boolean): Promise<number> => {
    if (!session || !tournamentId) return currentScore;

    const now = Date.now();
    if (!isFinal && now - lastScoreSubmission.current < 2000) {
      return currentScore;
    }
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
    
    return scoreToSubmit;
  };

  // Handle game end (player finishes early)
  const handleGameEnd = async (timeExpired: boolean) => {
    if (gameEnded) return;
    
    setGameEnded(true);
    const submittedScore = await submitScore(true);
    
    // If time expired for everyone, redirect to results
    if (timeExpired || timeRemaining <= 0) {
      setTimeout(() => {
        router.push(`/tournament/${tournamentId}/results`);
      }, 3000);
    } else {
      // Player finished early - show waiting screen
      setPlayerFinished(true);
      // Use the score that was just submitted, not currentScore state
      setFinalScore(submittedScore || currentScore);
      
      // Get username
      const username = (session?.user as any)?.name || 
                      (session?.user as any)?.email?.split('@')[0] ||
                      localStorage.getItem('guestUsername') ||
                      'Player';
      setPlayerUsername(username);
    }
  };

  // Handle when player's game is over (from MergeGame)
  const handlePlayerGameOver = async () => {
    console.log('Player game over in tournament mode');
    await handleGameEnd(false);
    
    // Check if all players have finished (for host)
    if (isCreator) {
      setTimeout(async () => {
        await checkIfAllPlayersFinished();
      }, 2000);
    }
  };

  // Check if all players have finished their games
  const checkIfAllPlayersFinished = async () => {
    try {
      // Get total participant count
      const { count: totalParticipants } = await supabase
        .from('tournament_participants')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournamentId);

      // Get count of players who have submitted final scores (game_duration_seconds > 0 means they finished)
      const { count: finishedPlayers } = await supabase
        .from('tournament_scores')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournamentId)
        .gt('game_duration_seconds', 0);

      console.log(`Tournament ${tournamentId}: ${finishedPlayers}/${totalParticipants} players finished`);

      // If all players have finished, auto-end the tournament
      if (finishedPlayers && totalParticipants && finishedPlayers >= totalParticipants) {
        console.log('All players finished! Auto-ending tournament...');
        
        // End the tournament
        const response = await fetch('/api/tournaments/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tournament_id: tournamentId }),
        });

        if (response.ok) {
          // Redirect to results
          setTimeout(() => {
            router.push(`/tournament/${tournamentId}/results`);
          }, 1000);
        }
      }
    } catch (error) {
      console.error('Error checking if all players finished:', error);
    }
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

  // End tournament (host only)
  const handleEndTournament = async () => {
    const confirmed = window.confirm('Are you sure you want to end this tournament now? All players will be redirected to results.');
    if (!confirmed) return;

    try {
      const response = await fetch('/api/tournaments/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: tournamentId,
        }),
      });

      if (response.ok) {
        router.push(`/tournament/${tournamentId}/results`);
      }
    } catch (error) {
      console.error('Error ending tournament:', error);
    }
  };

  if (!tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-white text-2xl">Loading tournament...</div>
      </div>
    );
  }

  // If player finished early, show waiting screen
  if (playerFinished) {
    return (
      <TournamentWaitingScreen
        tournamentId={tournamentId}
        playerScore={finalScore}
        playerUsername={playerUsername}
      />
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
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2 sm:py-3">
          {/* Mobile Layout */}
          <div className="flex sm:hidden items-center justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-black text-white truncate">{tournament.name}</h1>
              <div className="flex items-center gap-2">
                <div className={`px-2 py-1 rounded text-xs font-mono font-black ${
                  timeRemaining <= 60 ? 'bg-red-500/20 text-red-400' :
                  timeRemaining <= 300 ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-green-500/20 text-green-400'
                }`}>
                  ⏱️ {formatTime(timeRemaining)}
                </div>
                <div className="text-base font-black text-purple-400">
                  {currentScore.toLocaleString()}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowLeaderboard(!showLeaderboard)}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-colors text-xs"
              >
                {showLeaderboard ? '🎮' : '🏆'}
              </button>
              
              {isCreator && !gameEnded && (
                <button
                  onClick={handleEndTournament}
                  className="px-2 py-2 bg-red-600/20 text-red-400 rounded-lg font-bold transition-colors text-xs border border-red-500/30"
                >
                  🛑
                </button>
              )}
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden sm:flex items-center justify-between">
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

            {/* End Tournament Button (Host Only) */}
            {isCreator && !gameEnded && (
              <button
                onClick={handleEndTournament}
                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg font-bold transition-colors text-sm border-2 border-red-500/30 hover:border-red-500"
              >
                🛑 End Now
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-16 sm:pt-20 h-screen flex flex-col sm:flex-row">
        {/* Game Area */}
        <div className={`
          flex-1 
          ${showLeaderboard ? 'hidden sm:block sm:w-2/3' : 'w-full'} 
          transition-all duration-300
          overflow-hidden
        `}>
          <div className="h-full flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-purple-900">
            <MergeGame
              tournamentMode={true}
              onScoreChange={onScoreChange}
              onBallDropped={onBallDropped}
              onMerge={onMerge}
              onGameOver={handlePlayerGameOver}
              disabled={gameEnded}
            />
          </div>
        </div>

        {/* Leaderboard Sidebar - Desktop */}
        {showLeaderboard && (
          <div className="hidden sm:block sm:w-1/3 border-l border-purple-500/30 bg-gray-900/50 backdrop-blur-md overflow-y-auto">
            <div className="h-full p-4">
              <LiveLeaderboard 
                tournamentId={tournamentId}
                currentUserId={(session?.user as any)?.id || localStorage.getItem('guestUserId')}
                compact={true}
              />
            </div>
          </div>
        )}

        {/* Leaderboard Full Screen - Mobile */}
        {showLeaderboard && (
          <div className="sm:hidden fixed inset-0 top-16 bg-gray-900 z-50 overflow-y-auto">
            <div className="h-full p-4">
              <LiveLeaderboard 
                tournamentId={tournamentId}
                currentUserId={(session?.user as any)?.id || localStorage.getItem('guestUserId')}
                compact={false}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
