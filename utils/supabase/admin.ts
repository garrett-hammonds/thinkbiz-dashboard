import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Service-role Supabase client for trusted server-side work: cron jobs,
// database webhooks, notification dispatch, and admin actions. It bypasses RLS,
// so it must never be imported into client components.
//
// Centralized for two reasons:
//   1. The required env vars are validated in exactly one place, so a
//      misconfiguration fails loudly here ("admin client misconfigured")
//      instead of surfacing as an opaque "supabaseKey is required" deep inside
//      an unrelated query.
//   2. `persistSession` / `autoRefreshToken` are disabled — a service-role
//      client has no user session to persist, and leaving the auto-refresh
//      timer running needlessly keeps serverless invocations alive.
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase admin client misconfigured: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set.',
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
