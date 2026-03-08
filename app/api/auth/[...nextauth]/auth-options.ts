import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import DiscordProvider from "next-auth/providers/discord"

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }),
  ],
  
  // Session configuration - Users stay logged in for 30 days
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
    updateAge: 24 * 60 * 60, // Update session every 24 hours
  },
  
  // JWT configuration
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  
  // Cookie configuration for Vercel
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true,
        maxAge: 30 * 24 * 60 * 60, // 30 days
      },
    },
  },
  
  callbacks: {
    async jwt({ token, user, account }) {
      // Add access token from OAuth provider
      if (account) {
        token.accessToken = account.access_token
      }
      
      // Add user ID to token on first sign in
      if (user) {
        token.id = user.id || user.email
      }
      
      return token
    },
    
    async session({ session, token }) {
      // Add user id to session from token
      if (session.user) {
        (session.user as any).id = token.id || token.sub
      }
      return session
    },
  },
  
  pages: {
    signIn: '/game',
  },
  
  secret: process.env.NEXTAUTH_SECRET,
}
