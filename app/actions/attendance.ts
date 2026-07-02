'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { getActiveClubId } from '@/utils/activeClub';
import { verifyCheckinToken } from '@/utils/checkinTokens';
import {
  currentMeetingSlot,
  isValidMeetingSlot,
  MEETING_DAY_LABELS,
} from '@/utils/meetingWeek';

// All attendance mutations run through this gate: the caller must be a
// director or admin with a club in context. Reads/writes then go through the
// service-role client because a director working the door needs to look up
// *other* members' rows (name, headshot, club) that member-scoped RLS hides —
// the same reasoning as the roster page. Every query below is still locked to
// the caller's own active club.
async function getDirectorContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated.' as const };

  const member = await getMemberForUser(supabase, user);
  if (!member || (!member.is_admin && !member.club_director)) {
    return { error: 'Only club directors can manage attendance.' as const };
  }

  const clubId = await getActiveClubId(member);
  if (!clubId) return { error: 'No club selected.' as const };

  return { member, clubId, admin: createAdminClient() };
}

export interface ScanResult {
  success: boolean;
  message?: string;
  memberName?: string;
  headshot?: string | null;
  meetingDate?: string;
  alreadyCheckedIn?: boolean;
}

// Called by the director's scanner for each decoded QR code. Verifies the
// member's signed token, confirms they're an active member of the director's
// club, and records attendance for this week's meeting slot (idempotent —
// re-scanning someone reports "already checked in" rather than erroring).
export async function recordScanAction(token: string): Promise<ScanResult> {
  const ctx = await getDirectorContext();
  if ('error' in ctx) return { success: false, message: ctx.error };
  const { member: director, clubId, admin } = ctx;

  let memberId: string;
  try {
    memberId = await verifyCheckinToken(token);
  } catch {
    return {
      success: false,
      message: "That QR code isn't a ThinkBiz check-in code.",
    };
  }

  const { data: scanned } = await admin
    .from('members')
    .select('id, first_name, last_name, email, member_headshot, is_active, current_club_id')
    .eq('id', memberId)
    .maybeSingle();

  const name = scanned
    ? `${scanned.first_name ?? ''} ${scanned.last_name ?? ''}`.trim() || scanned.email
    : '';

  if (!scanned || !scanned.is_active) {
    return { success: false, message: 'This code belongs to an inactive member.' };
  }

  if (scanned.current_club_id !== clubId) {
    return {
      success: false,
      message: `${name} isn't a member of this club.`,
      memberName: name,
    };
  }

  const { data: club } = await admin
    .from('clubs')
    .select('meeting_day')
    .eq('id', clubId)
    .maybeSingle();

  if (club?.meeting_day == null) {
    return {
      success: false,
      message: "Set your club's meeting day on the Attendance page first.",
    };
  }

  const meetingDate = currentMeetingSlot(club.meeting_day);

  // `ignoreDuplicates` + the (club, member, meeting_date) unique constraint
  // makes re-scans a no-op; a returned row means this scan created the record.
  const { data: inserted, error } = await admin
    .from('attendance')
    .upsert(
      {
        club_id: clubId,
        member_id: scanned.id,
        meeting_date: meetingDate,
        source: 'scan',
        recorded_by: director.id,
      },
      { onConflict: 'club_id,member_id,meeting_date', ignoreDuplicates: true },
    )
    .select('id');

  if (error) {
    console.error('[recordScanAction] insert failed:', error);
    return { success: false, message: 'Could not record attendance. Try again.' };
  }

  revalidatePath('/dashboard/attendance');
  revalidatePath('/dashboard');

  return {
    success: true,
    memberName: name,
    headshot: scanned.member_headshot ?? null,
    meetingDate,
    alreadyCheckedIn: !inserted || inserted.length === 0,
  };
}

// Manual roster checklist: mark a member present or absent for a given
// meeting slot. Also the backfill path when nobody could scan at the door.
export async function setAttendanceAction(input: {
  memberId: string;
  meetingDate: string;
  present: boolean;
}): Promise<{ success: boolean; message?: string }> {
  const { memberId, meetingDate, present } = input;
  if (!memberId || !meetingDate) {
    return { success: false, message: 'Missing member or meeting date.' };
  }

  const ctx = await getDirectorContext();
  if ('error' in ctx) return { success: false, message: ctx.error };
  const { member: director, clubId, admin } = ctx;

  const { data: club } = await admin
    .from('clubs')
    .select('meeting_day')
    .eq('id', clubId)
    .maybeSingle();

  if (club?.meeting_day == null) {
    return { success: false, message: "Set your club's meeting day first." };
  }

  // Only real occurrences of the club's meeting day are valid slots, so a
  // tampered form can't scatter rows across arbitrary dates.
  if (!isValidMeetingSlot(meetingDate, club.meeting_day)) {
    return { success: false, message: 'Invalid meeting date.' };
  }

  // The member being toggled must belong to the director's club.
  const { data: target } = await admin
    .from('members')
    .select('id')
    .eq('id', memberId)
    .eq('current_club_id', clubId)
    .maybeSingle();

  if (!target) {
    return { success: false, message: 'That member is not in this club.' };
  }

  const { error } = present
    ? await admin.from('attendance').upsert(
        {
          club_id: clubId,
          member_id: memberId,
          meeting_date: meetingDate,
          source: 'manual',
          recorded_by: director.id,
        },
        { onConflict: 'club_id,member_id,meeting_date', ignoreDuplicates: true },
      )
    : await admin
        .from('attendance')
        .delete()
        .eq('club_id', clubId)
        .eq('member_id', memberId)
        .eq('meeting_date', meetingDate);

  if (error) {
    console.error('[setAttendanceAction] write failed:', error);
    return { success: false, message: 'Could not update attendance.' };
  }

  revalidatePath('/dashboard/attendance');
  revalidatePath('/dashboard');
  return { success: true };
}

// Directors set (or correct) which weekday their club meets.
export async function setMeetingDayAction(
  formData: FormData,
): Promise<void> {
  const raw = formData.get('meeting_day');
  const day = Number(raw);
  if (!Number.isInteger(day) || day < 0 || day > 6) return;

  const ctx = await getDirectorContext();
  if ('error' in ctx) return;
  const { clubId, admin } = ctx;

  const { error } = await admin
    .from('clubs')
    .update({ meeting_day: day })
    .eq('id', clubId);

  if (error) {
    console.error(
      `[setMeetingDayAction] failed to set meeting_day=${MEETING_DAY_LABELS[day]}:`,
      error,
    );
    return;
  }

  revalidatePath('/dashboard/attendance');
  revalidatePath('/dashboard');
}
