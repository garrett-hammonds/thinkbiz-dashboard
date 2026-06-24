import 'server-only';
import { type SupabaseClient } from '@supabase/supabase-js';

// Finds a Supabase auth user by email. The admin API has no direct
// "get user by email" lookup, so we page through listUsers and match
// case-insensitively. Returns null when no auth user has that email or on any
// lookup error (callers treat "not found" and "couldn't look up" the same way:
// fall back to a path that works without knowing the auth user id).
export async function findAuthUserByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<{ id: string } | null> {
  const target = email.trim().toLowerCase();
  if (!target) return null;

  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users) return null;
    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (found) return { id: found.id };
    if (data.users.length < perPage) return null;
    page += 1;
    if (page > 50) return null;
  }
}
