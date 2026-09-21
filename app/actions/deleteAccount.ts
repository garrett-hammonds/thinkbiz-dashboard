'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { getStripe } from '@/lib/stripe/client';

export interface DeleteAccountResult {
  success: boolean;
  message?: string;
}

// Self-serve account deletion (App Store Review Guideline 5.1.1(v), Google
// Play's account-deletion policy). Reachable from /profile in the app and
// linked from the privacy policy.
//
// What it does, in order:
//   1. Cancels any live Stripe subscription so a deleted member is never
//      billed again (the webhook would otherwise keep syncing a status onto a
//      row nobody can see).
//   2. Deletes every push token (browser + phone) and the notification
//      preferences row.
//   3. Scrubs the members row: contact details, profile content, headshot,
//      billing ids, and the auth link are cleared; is_active/is_public go
//      false so the seat reopens (existing triggers) and the directory hides
//      them. First/last name stay so attendance, weekly logs, and chat history
//      keep their attribution — the privacy policy says so.
//   4. Deletes the Supabase auth user, which also invalidates every session.
//
// Directors and admins are refused: they run clubs, and deleting one out from
// under a roster would strand it. They hand off first (support handles it).
export async function deleteAccount(formData: FormData): Promise<DeleteAccountResult> {
  const confirm = String(formData.get('confirm') ?? '').trim().toUpperCase();
  if (confirm !== 'DELETE') {
    return { success: false, message: 'Type DELETE to confirm.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'You must be signed in.' };

  const member = await getMemberForUser(supabase, user);
  if (!member) return { success: false, message: 'We could not find your membership profile.' };

  if (member.is_admin || member.club_director) {
    return {
      success: false,
      message:
        'Directors and admins can’t delete their own account here because a club depends on it. Email team@thinkbiz.solutions and we’ll hand off your club and remove the account.',
    };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    console.error('[deleteAccount] admin client unavailable:', err);
    return { success: false, message: 'Account deletion is temporarily unavailable. Contact ThinkBiz Support.' };
  }

  // 1. Stop billing. Best effort: Stripe may already have cancelled it.
  const stripe = getStripe();
  if (stripe && member.stripe_subscription_id) {
    try {
      await stripe.subscriptions.cancel(member.stripe_subscription_id);
    } catch (err) {
      console.warn('[deleteAccount] subscription cancel failed (continuing):', err);
    }
  }

  // 2. Notification surfaces.
  await Promise.allSettled([
    admin.from('push_subscriptions').delete().eq('member_id', member.id),
    admin.from('native_push_tokens').delete().eq('member_id', member.id),
    admin.from('notification_preferences').delete().eq('member_id', member.id),
    admin.from('member_stars').delete().or(`member_id.eq.${member.id},starred_member_id.eq.${member.id}`),
  ]);

  // 3. Headshot file, then the row. The email is replaced with a tombstone
  //    that can never match a real sign-in (getMemberForUser auto-links by
  //    email) and keeps any NOT NULL / UNIQUE constraint satisfied.
  await admin.storage.from('Member Images').remove([`${user.id}/headshot.webp`]).catch(() => undefined);

  const { error: scrubError } = await admin
    .from('members')
    .update({
      email: `deleted-${member.id}@removed.invalid`,
      phone_number: null,
      company_name: null,
      title: null,
      bio: null,
      short_bio: null,
      website_url: null,
      linkedin_url: null,
      booking_calendar_url: null,
      member_headshot: null,
      core_skills: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      subscription_status: null,
      subscription_current_period_end: null,
      is_active: false,
      is_public: false,
      auth_user_id: null,
    })
    .eq('id', member.id);
  if (scrubError) {
    console.error('[deleteAccount] members scrub failed:', scrubError);
    return { success: false, message: 'We couldn’t delete your account. Please try again or contact ThinkBiz Support.' };
  }

  // 4. The auth identity. This also revokes every session for the user.
  const { error: authError } = await admin.auth.admin.deleteUser(user.id);
  if (authError) {
    console.error('[deleteAccount] auth user delete failed:', authError);
    return { success: false, message: 'Your profile was removed but sign-in could not be deleted. Contact ThinkBiz Support.' };
  }

  await supabase.auth.signOut();
  redirect('/login?message=' + encodeURIComponent('Your account has been deleted.'));
}
