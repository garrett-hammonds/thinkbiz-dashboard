import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient as createAdminClient } from '@supabase/supabase-js';

// Looks up the members row for the signed-in auth user.
//
// Some member rows predate the invite flow and have a NULL `auth_user_id`
// even though their `email` matches a real Supabase auth user. On first
// login for such users the direct `auth_user_id` lookup misses and they
// get bounced to /access-denied. To self-heal that case, when the id
// lookup fails we look up the row by email via the service-role client
// (RLS would otherwise hide an unlinked row from its own owner) and, if
// it's unlinked, write the current auth user's id onto it.
//
// We only auto-link when `auth_user_id IS NULL` so we never overwrite a
// member already bound to a different auth user.
export async function getMemberForUser(supabase: SupabaseClient, user: User) {
  const { data: byId } = await supabase
    .from('members')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (byId) return byId;

  if (!user.email) return null;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error(
      '[getMemberForUser] SUPABASE_SERVICE_ROLE_KEY not set; cannot auto-link member by email.',
    );
    return null;
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
  );

  const { data: byEmail, error: byEmailError } = await admin
    .from('members')
    .select('*')
    .ilike('email', user.email)
    .maybeSingle();

  if (byEmailError) {
    console.error('[getMemberForUser] email lookup failed:', byEmailError);
    return null;
  }

  if (!byEmail) {
    console.warn(
      `[getMemberForUser] no members row for email=${user.email} (auth_user_id=${user.id}). User needs an approved application.`,
    );
    return null;
  }

  if (byEmail.auth_user_id && byEmail.auth_user_id !== user.id) {
    console.warn(
      `[getMemberForUser] members row for ${user.email} is bound to a different auth_user_id; refusing to relink.`,
    );
    return null;
  }

  if (byEmail.auth_user_id === user.id) return byEmail;

  const { data: linked, error: linkError } = await admin
    .from('members')
    .update({ auth_user_id: user.id })
    .eq('id', byEmail.id)
    .is('auth_user_id', null)
    .select('*')
    .maybeSingle();

  if (linkError) {
    console.error('[getMemberForUser] auto-link update failed:', linkError);
    return null;
  }

  return linked ?? { ...byEmail, auth_user_id: user.id };
}
