'use server';

import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { buildOnboardingLink } from '@/utils/supabase/authLinks';
import { sendEmail } from '@/lib/email/client';
import { memberInviteEmail } from '@/lib/email/templates';

export interface ResendInviteResult {
  success: boolean;
  message?: string;
}

// Re-sends an app invitation to a member who hasn't joined yet. We mint a fresh
// sign-in link (invite for brand-new auth users, magic link for ones that
// already exist) and email it with our branded template. The link is a
// token_hash pointing at /auth/confirm, so it works across devices — see
// utils/supabase/authLinks.ts.
export async function resendInvite(memberId: string): Promise<ResendInviteResult> {
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
    return { success: false, message: 'Only directors and admins can resend invites.' };
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return { success: false, message: 'Invites are temporarily unavailable. Contact ThinkBiz Support.' };
  }

  const admin: SupabaseClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
  );

  const { data: target, error: targetError } = await admin
    .from('members')
    .select('id, email, first_name, current_club_id')
    .eq('id', trimmedId)
    .maybeSingle();

  if (targetError || !target) {
    return { success: false, message: 'Member not found.' };
  }

  // Directors can only resend invites for members of their own club. Admins
  // are unrestricted.
  if (!viewer.is_admin && target.current_club_id !== viewer.current_club_id) {
    return { success: false, message: 'You can only resend invites for your own club.' };
  }

  if (!target.email) {
    return { success: false, message: 'This member has no email on file.' };
  }

  // Mint a fresh sign-in link (invite for a brand-new auth user, magic link for
  // one that already exists) and email it with our branded template.
  const link = await buildOnboardingLink(admin, target.email, '/update-password');
  if (!link) {
    return { success: false, message: 'Could not generate an invite link. Try again.' };
  }

  const email = memberInviteEmail({
    firstName: target.first_name ?? undefined,
    url: link.url,
  });

  const sent = await sendEmail({ to: target.email, ...email });
  if (!sent) {
    return { success: false, message: 'Could not send the invite email. Contact ThinkBiz Support.' };
  }

  return { success: true };
}
