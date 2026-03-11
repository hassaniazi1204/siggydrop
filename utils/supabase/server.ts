// utils/supabase/server.ts
// Pure supabase-js with SERVICE ROLE key.
// Per Supabase docs: never use the SSR client with service role —
// cookies override the Authorization header.
// This file is ONLY imported by API routes (server-side).

import { createClient as _createClient } from '@supabase/supabase-js';

export function createClient(_cookieStore?: any) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      `Supabase env vars missing. ` +
      `URL: ${url ? 'OK' : 'MISSING'}, ` +
      `SERVICE_ROLE_KEY: ${key ? 'OK' : 'MISSING'}`
    );
  }

  return _createClient(url, key, {
    auth: {
      autoRefreshToken:  false,
      persistSession:    false,
      detectSessionInUrl: false,
    },
  });
}
