import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'


export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;

  console.log('🔄 OAuth callback handler called');
  console.log('Code present:', !!code);

  if (code) {
    const cookieStore = await cookies();
    
    // Create Supabase server client with cookie handling
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch (error) {
              // Can't modify cookies from Server Component
              // This is expected in some contexts
            }
          },
        },
      }
    );

    // Exchange authorization code for session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      console.log('✅ Session created for:', data.session.user.email);
      
      // Success - redirect to game
      return NextResponse.redirect(`${origin}/game`);
    }

    console.error('❌ Auth exchange error:', error);
  }

  // Error or no code - redirect to home
  console.log('⚠️ No code or error - redirecting to home');
  return NextResponse.redirect(`${origin}/`);
}
