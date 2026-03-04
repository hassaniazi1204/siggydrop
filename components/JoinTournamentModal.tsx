'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface JoinTournamentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function JoinTournamentModal({ isOpen, onClose }: JoinTournamentModalProps) {
  const router = useRouter();
  const { data: session } = useSession();
  
  const [tournamentCode, setTournamentCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!session) {
      setError('You must be logged in to join tournaments');
      setLoading(false);
      return;
    }

    if (!tournamentCode.trim()) {
      setError('Please enter a tournament code');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/tournaments/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournament_code: tournamentCode.trim().toUpperCase() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join tournament');
      }

      // Redirect to tournament lobby
      router.push(`/tournament/${data.tournament.id}`);
      onClose();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Auto-uppercase and limit to 8 characters
    const value = e.target.value.toUpperCase().slice(0, 8);
    setTournamentCode(value);
    setError(null);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border-2 border-purple-500/30 rounded-2xl max-w-md w-full p-8 shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-black text-white">Join Tournament</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Info Box */}
        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
          <p className="text-blue-400 text-sm">
            💡 Enter the 8-character tournament code shared by the host
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tournament Code Input */}
          <div>
            <label className="block text-white font-semibold mb-3">
              Tournament Code
            </label>
            <input
              type="text"
              value={tournamentCode}
              onChange={handleCodeChange}
              placeholder="ABCD1234"
              maxLength={8}
              required
              autoFocus
              className="w-full px-6 py-4 bg-black/50 border-2 border-gray-700 rounded-xl text-white text-center font-mono text-2xl font-bold placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors tracking-widest"
              style={{ letterSpacing: '0.2em' }}
            />
            <p className="text-xs text-gray-400 mt-2 text-center">
              {tournamentCode.length}/8 characters
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-4 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || tournamentCode.length < 8}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Joining...' : '🎮 Join'}
            </button>
          </div>
        </form>

        {/* Additional Info */}
        <div className="mt-8 pt-6 border-t border-gray-700">
          <p className="text-gray-400 text-sm text-center">
            Don't have a code? Ask the tournament host to share it with you
          </p>
        </div>
      </div>
    </div>
  );
}

