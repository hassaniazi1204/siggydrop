'use client'

import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface PlayModeModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function PlayModeModal({ isOpen, onClose }: PlayModeModalProps) {
  const router = useRouter()
  const [guestUsername, setGuestUsername] = useState('')
  const [selectedMode, setSelectedMode] = useState<'solo' | 'tournament' | null>(null)

  if (!isOpen) return null

  let tournamentCode: string | null = null
  let isTournamentJoin = false

  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    tournamentCode = params.get('code')
    isTournamentJoin = !!tournamentCode
  }

  const handleGuestPlay = () => {
    if (!guestUsername.trim()) {
      alert('Please enter a username!')
      return
    }

    const guestUserId = `guest_${guestUsername}_${Date.now()}`

    localStorage.setItem('guestUsername', guestUsername)
    localStorage.setItem('guestUserId', guestUserId)

    if (isTournamentJoin && tournamentCode) {
      router.push(`/tournament/join?code=${tournamentCode}&guest=true`)
    } else {
      router.push('/game')
    }

    onClose()
  }

  const handleOAuthLogin = async (provider: 'google' | 'discord') => {
    try {
      if (isTournamentJoin && tournamentCode) {
        localStorage.setItem('pendingTournamentJoin', tournamentCode)
        localStorage.setItem('authReturnUrl', `/tournament/join?code=${tournamentCode}`)
      } else {
        localStorage.setItem('authReturnUrl', '/game')
      }

      await signIn(provider, {
        callbackUrl: isTournamentJoin
          ? `/tournament/join?code=${tournamentCode}`
          : '/game'
      })
    } catch (error) {
      console.error('OAuth error:', error)
      alert('Login failed. Please try again.')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 border-2 border-purple-500/30 rounded-3xl p-8 max-w-md w-full shadow-2xl">

        <div className="text-center mb-8">
          <h2 className="text-4xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
            {isTournamentJoin ? '🏆 Join Tournament' : '🎮 Choose Play Mode'}
          </h2>

          {isTournamentJoin && (
            <p className="text-gray-400 text-sm">
              Code <span className="text-purple-400 font-mono font-bold">{tournamentCode}</span>
            </p>
          )}

          <p className="text-gray-300 text-sm mt-2">
            {isTournamentJoin
              ? 'Sign in or play as guest to join the tournament'
              : 'Sign in to save your progress or play as guest'}
          </p>
        </div>

        <div className="space-y-3 mb-6">

          <button
            onClick={() => handleOAuthLogin('google')}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-gray-100 text-gray-900 rounded-xl font-bold transition-all hover:scale-105 active:scale-95"
          >
            Continue with Google
          </button>

          <button
            onClick={() => handleOAuthLogin('discord')}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl font-bold transition-all hover:scale-105 active:scale-95"
          >
            Continue with Discord
          </button>

        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-gray-900 text-gray-400">
              or play as guest
            </span>
          </div>
        </div>

        <div className="space-y-3">

          <input
            type="text"
            placeholder="Enter your username"
            value={guestUsername}
            onChange={(e) => setGuestUsername(e.target.value.slice(0, 20))}
            className="w-full px-4 py-3 bg-gray-800 border-2 border-gray-700 focus:border-purple-500 rounded-xl text-white placeholder-gray-500 outline-none transition-colors"
            maxLength={20}
          />

          <button
            onClick={handleGuestPlay}
            disabled={!guestUsername.trim()}
            className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-700 disabled:to-gray-700 text-white rounded-xl font-bold transition-all hover:scale-105 active:scale-95"
          >
            {isTournamentJoin ? 'Join as Guest' : 'Play as Guest'}
          </button>

        </div>

        <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-yellow-400 text-xs text-center">
            Guest mode progress will not be saved
          </p>
        </div>

        {!isTournamentJoin && (
          <button
            onClick={() => router.push('/')}
            className="w-full mt-4 px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
          >
            Back to Home
          </button>
        )}

      </div>
    </div>
  )
}
