'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js';
import { getMemberForUser } from '@/utils/supabase/getMember';

export interface RemoveMemberResult {
  success: boolean;
  message?: string;
}

// Removes a member from a club roster. This is a soft removal: the member row
// is kept (so their logs, attendance, and chat history stay intact) but they
// are marked inactive and their public profile is hidden. Runs on the
// service-role client because is_active/is_public are privileged columns that
// client-role updates can't touch — so the authorization checks below are the
// only gate.
export async function removeMember(memberId: string): Promise<RemoveMemberResult> {
  const trimmedId = (memberId || '').trim();
  if (!trimmedId) {
    return { success: false, message: 'Missing member.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: 'You must be signed in.' };
  }

  const viewer = await getMemberForUser(supabase, user);
  if (!viewer || (!viewer.is_admin && !viewer.club_director)) {
    return { success: false, message: 'Only directors and admins can remove members.' };
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return { success: false, message: 'Removals are temporarily unavailable. Contact ThinkBiz Support.' };
  }

  const admin: SupabaseClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
  );

  const { data: target, error: targetError } = await admin
    .from('members')
    .select('id, current_club_id, is_admin, club_director, is_active')
    .eq('id', trimmedId)
    .maybeSingle();

  if (targetError || !target) {
    return { success: false, message: 'Member not found.' };
  }

  if (target.id === viewer.id) {
    return { success: false, message: 'You cannot remove yourself from the roster.' };
  }

  // Directors can only remove regular members of their own club. Admins are
  // unrestricted (aside from the self-check above).
  if (!viewer.is_admin) {
    if (target.current_club_id !== viewer.current_club_id) {
      return { success: false, message: 'You can only remove members of your own club.' };
    }
    if (target.is_admin || target.club_director) {
      return { success: false, message: 'Directors and admins can only be removed by an admin.' };
    }
  }

  if (!target.is_active) {
    // Already removed (e.g. double-click or a stale roster view) — nothing to do.
    revalidatePath('/dashboard/roster');
    return { success: true };
  }

  const { error: updateError } = await admin
    .from('members')
    .update({ is_active: false, is_public: false })
    .eq('id', trimmedId);

  if (updateError) {
    console.error('Error removing member:', updateError);
    return { success: false, message: 'Could not remove this member. Try again.' };
  }

  revalidatePath('/dashboard/roster');
  return { success: true };
}
