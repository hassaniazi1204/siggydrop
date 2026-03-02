'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'

interface NextAuthModalProps {
  isOpen: boolean
  onGuestLogin: (username: string) => void
}

export default function NextAuthModal({ isOpen, onGuestLogin }: NextAuthModalProps) {
  const [guestUsername, setGuestUsername] = useState('')
  const [isGuest, setIsGuest] = useState(false)

  if (!isOpen) return null

  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl: '/game' })
  }

  const handleDiscordSignIn = () => {
    signIn('discord', { callbackUrl: '/game' })
  }

  const handleGuestSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (guestUsername.trim()) {
      onGuestLogin(guestUsername.trim())
    }
  }

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{
        background: 'rgba(0, 0, 0, 0.95)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div 
        className="w-full max-w-md rounded-2xl p-8 shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #0f0f23 100%)',
          border: '2px solid rgba(139, 92, 246, 0.3)',
        }}
      >
        <h2 
          className="text-3xl font-black text-center mb-6"
          style={{
            background: 'linear-gradient(90deg, #A78BFA, #EC4899)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontFamily: "'Barlow-ExtraBold', 'Barlow', sans-serif",
          }}
        >
          {isGuest ? 'Choose Username' : 'Welcome to SiggyDrop!'}
        </h2>

        {!isGuest ? (
          <div className="space-y-4">
            {/* Google Sign In */}
            <button
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white text-gray-800 rounded-xl font-bold hover:scale-105 transition-transform shadow-lg"
              style={{ fontFamily: "'Barlow-Bold', 'Barlow', sans-serif" }}
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            {/* Discord Sign In */}
            <button
              onClick={handleDiscordSignIn}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 text-white rounded-xl font-bold hover:scale-105 transition-transform shadow-lg"
              style={{ 
                background: '#5865F2',
                fontFamily: "'Barlow-Bold', 'Barlow', sans-serif",
              }}
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              Continue with Discord
            </button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-900 text-gray-400">or</span>
              </div>
            </div>

            {/* Guest Mode */}
            <button
              onClick={() => setIsGuest(true)}
              className="w-full px-6 py-4 text-black rounded-xl font-bold hover:scale-105 transition-transform shadow-lg"
              style={{ 
                background: 'linear-gradient(90deg, #10B981, #059669)',
                fontFamily: "'Barlow-Bold', 'Barlow', sans-serif",
              }}
            >
              🎮 Play as Guest
            </button>
          </div>
        ) : (
          <form onSubmit={handleGuestSubmit} className="space-y-4">
            <div>
              <label 
                className="block text-sm font-semibold text-gray-300 mb-2"
                style={{ fontFamily: "'Barlow-SemiBold', 'Barlow', sans-serif" }}
              >
                Choose a username
              </label>
              <input
                type="text"
                value={guestUsername}
                onChange={(e) => setGuestUsername(e.target.value)}
                placeholder="Enter username..."
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                style={{ fontFamily: "'Barlow-Regular', 'Barlow', sans-serif" }}
                maxLength={20}
                required
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsGuest(false)}
                className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-xl font-bold hover:bg-gray-600 transition-colors"
                style={{ fontFamily: "'Barlow-Bold', 'Barlow', sans-serif" }}
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3 text-black rounded-xl font-bold hover:scale-105 transition-transform"
                style={{ 
                  background: 'linear-gradient(90deg, #10B981, #059669)',
                  fontFamily: "'Barlow-Bold', 'Barlow', sans-serif",
                }}
              >
                Start Playing
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
