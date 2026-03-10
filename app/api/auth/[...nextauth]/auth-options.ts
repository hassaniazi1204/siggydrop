// app/api/auth/[...nextauth]/auth-options.ts
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

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },

  jwt: {
    maxAge: 30 * 24 * 60 * 60,
  },

  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true,
        maxAge: 30 * 24 * 60 * 60,
      },
    },
  },

  callbacks: {
    async jwt({ token, user, account }) {
      if (account) {
        token.accessToken = account.access_token
      }
      // On first sign-in, set token.id from provider
      if (user) {
        token.id = user.id || user.email
      }
      // ✅ KEY FIX: On every subsequent refresh, token.id must be preserved.
      // If it somehow got lost, fall back to token.sub (OAuth provider's user ID).
      if (!token.id) {
        token.id = token.sub
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        // Always use token.id — never undefined after the fix above
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
