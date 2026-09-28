'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { getActiveClubId } from '@/utils/activeClub';

export interface AssignSeatResult {
  success: boolean;
  message?: string;
}

// Puts a member in one of their club's industry seats (or takes them out of
// their seat when `seatId` is null). The marketing website's Member Directory is
// built from these seats, so this is how a member shows up there under their
// industry.
//
// A member holds at most one seat per club: assigning a new seat releases the
// one they held. Only open seats can be taken, so a director can't bump another
// member out by accident — they release that member's seat first.
//
// Runs on the service-role client (club_seats has no member-writable RLS), so
// the checks below are the only gate: directors and admins only, and only for
// members and seats of the club they're currently managing.
export async function assignSeat(
  memberId: string,
  seatId: string | null,
): Promise<AssignSeatResult> {
  const targetId = (memberId || '').trim();
  const targetSeatId = seatId ? seatId.trim() : null;
  if (!targetId) {
    return { success: false, message: 'Missing member.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: 'You must be signed in.' };
  }

  const viewer = await getMemberForUser(supabase, user);
  if (!viewer || (!viewer.is_admin && !viewer.club_director)) {
    return { success: false, message: 'Only directors and admins can assign seats.' };
  }

  const clubId = await getActiveClubId(viewer);
  if (!clubId) {
    return { success: false, message: 'Pick a club first.' };
  }

  const admin = createAdminClient();

  const { data: target } = await admin
    .from('members')
    .select('id, current_club_id, is_active')
    .eq('id', targetId)
    .maybeSingle();
  if (!target || !target.is_active || target.current_club_id !== clubId) {
    return { success: false, message: 'That member isn’t on this club’s roster.' };
  }

  if (targetSeatId) {
    const { data: seat } = await admin
      .from('club_seats')
      .select('id, club_id, status, member_id')
      .eq('id', targetSeatId)
      .maybeSingle();
    if (!seat || seat.club_id !== clubId) {
      return { success: false, message: 'That seat isn’t in this club.' };
    }
    if (seat.member_id === targetId) {
      return { success: true };
    }
    if (seat.status !== 'open' || seat.member_id) {
      return {
        success: false,
        message: 'That seat is already taken. Release it from its current member first.',
      };
    }
  }

  // Release whatever seat the member currently holds in this club.
  const { error: releaseError } = await admin
    .from('club_seats')
    .update({ status: 'open', member_id: null })
    .eq('club_id', clubId)
    .eq('member_id', targetId);
  if (releaseError) {
    console.error('[assignSeat] release failed:', releaseError);
    return { success: false, message: 'Could not update the seat. Try again.' };
  }

  if (targetSeatId) {
    // Guarded on the seat still being open, so two directors racing for the
    // same seat can't both win.
    const { data: taken, error: assignError } = await admin
      .from('club_seats')
      .update({ status: 'filled', member_id: targetId })
      .eq('id', targetSeatId)
      .eq('status', 'open')
      .is('member_id', null)
      .select('id');
    if (assignError) {
      console.error('[assignSeat] assign failed:', assignError);
      return { success: false, message: 'Could not update the seat. Try again.' };
    }
    if (!taken || taken.length === 0) {
      revalidatePath('/dashboard/roster');
      return { success: false, message: 'That seat was just taken. Pick another.' };
    }
  }

  revalidatePath('/dashboard/roster');
  return { success: true };
}
