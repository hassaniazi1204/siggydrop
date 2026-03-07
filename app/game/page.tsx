'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import MergeGame from '@/components/MergeGame';

export default function GamePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    // Only redirect if we're SURE the user is unauthenticated
    if (status === 'unauthenticated') {
      console.log('User not authenticated, redirecting to home');
      router.push('/?play=true');
    } else if (status === 'authenticated') {
      console.log('User authenticated, rendering game');
      setShouldRender(true);
    }
  }, [status, router]);

  // Show loading while checking auth
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-purple-900">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">🎮</div>
          <div className="text-white text-2xl">Loading game...</div>
        </div>
      </div>
    );
  }

  // Don't render anything if unauthenticated (will redirect)
  if (status === 'unauthenticated' || !shouldRender) {
    return null;
  }

  // User is authenticated - render game
  return <MergeGame />;
}
