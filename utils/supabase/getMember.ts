import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient as createAdminClient } from '@supabase/supabase-js';

// Looks up the members row for the signed-in auth user.
//
// Some member rows predate the invite flow and have a NULL `auth_user_id`
// even though their `email` matches a real Supabase auth user. On first
// login for such users the direct `auth_user_id` lookup misses and they
// get bounced to /access-denied. To self-heal that case, when the id
// lookup fails we fall back to matching by email and, if the row is
// unlinked, write the current auth user's id back to it.
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

  const { data: byEmail } = await supabase
    .from('members')
    .select('*')
    .ilike('email', user.email)
    .maybeSingle();

  if (!byEmail) return null;
  if (byEmail.auth_user_id) return null;

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: linked } = await admin
    .from('members')
    .update({ auth_user_id: user.id })
    .eq('id', byEmail.id)
    .is('auth_user_id', null)
    .select('*')
    .maybeSingle();

  return linked ?? { ...byEmail, auth_user_id: user.id };
}
