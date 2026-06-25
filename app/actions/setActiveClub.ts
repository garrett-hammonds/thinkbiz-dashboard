'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { ACTIVE_CLUB_COOKIE } from '@/utils/activeClub';

// Sets (or clears, when passed null/empty) the admin's "active club" — the club
// whose director surfaces they are currently managing. Admin-only: a non-admin
// must never be able to point their views at another club.
export async function setActiveClub(
  clubId: string | null,
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: 'Unauthorized' };
  }

  const member = await getMemberForUser(supabase, user);
  if (!member?.is_admin) {
    return { success: false, message: 'Only admins can switch clubs.' };
  }

  const store = await cookies();

  if (!clubId) {
    // "All clubs" — drop the override and fall back to the admin's own club.
    store.delete(ACTIVE_CLUB_COOKIE);
  } else {
    // Validate the target is a real club so a stale or tampered value can't
    // silently blank out every club-scoped view.
    const admin = createAdminClient();
    const { data: club } = await admin
      .from('clubs')
      .select('id')
      .eq('id', clubId)
      .maybeSingle();
    if (!club) {
      return { success: false, message: 'That club no longer exists.' };
    }

    store.set(ACTIVE_CLUB_COOKIE, clubId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  // Every club-scoped page reads this cookie at request time, so refresh the
  // whole route tree to reflect the new selection.
  revalidatePath('/', 'layout');
  return { success: true };
}
