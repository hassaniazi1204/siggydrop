// utils/supabase/server.ts
// SERVICE ROLE key — bypasses RLS for secure server-side writes.
// ONLY used in API routes (server-side). Never exposed to the browser.
// Client-side components use utils/supabase/client.ts (anon key, READ only).

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createClient(_cookieStore?: any) {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
