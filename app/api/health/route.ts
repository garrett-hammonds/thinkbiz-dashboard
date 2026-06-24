import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Liveness / readiness probe for uptime monitors and platform health checks.
// Returns 200 when the app is configured and can reach Supabase, 503 when the
// database round-trip fails. Never exposes secret values — only booleans and a
// coarse status — so it is safe to leave unauthenticated.
const DB_PROBE_TIMEOUT_MS = 3000;

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const checks: {
    supabaseConfigured: boolean;
    serviceRoleConfigured: boolean;
    database: 'ok' | 'error' | 'skipped';
  } = {
    supabaseConfigured: !!url && !!anonKey,
    serviceRoleConfigured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    database: 'skipped',
  };

  if (url && anonKey) {
    try {
      const supabase = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      // Cheap connectivity probe: a head-only count that returns no rows.
      const probe = supabase.from('clubs').select('id', { count: 'exact', head: true });
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('db probe timeout')), DB_PROBE_TIMEOUT_MS),
      );
      const { error } = (await Promise.race([probe, timeout])) as { error: unknown };
      checks.database = error ? 'error' : 'ok';
    } catch {
      checks.database = 'error';
    }
  }

  const healthy = checks.supabaseConfigured && checks.database !== 'error';
  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
