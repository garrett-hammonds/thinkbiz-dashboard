'use server';

import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { sendEmail } from '@/lib/email/client';
import { memberInviteEmail } from '@/lib/email/templates';

export interface ResendInviteResult {
  success: boolean;
  message?: string;
}

function isUserAlreadyExistsError(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  if (err.code === 'email_exists' || err.code === 'user_already_exists') return true;
  const msg = (err.message || '').toLowerCase();
  return (
    msg.includes('already registered') ||
    msg.includes('already exists') ||
    msg.includes('user already')
  );
}

// Re-sends an app invitation to a member who hasn't joined yet. Most invited
// members already have an auth user (created when their application was
// approved), so Supabase's inviteUserByEmail would reject them — in that case
// we mint a fresh magic link and email it ourselves with our branded template.
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

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const redirectTo = `${baseUrl}/auth/callback?next=/update-password`;

  // Brand-new auth user (e.g. legacy member with no auth account): let Supabase
  // create the user and send its invite email, mirroring the approval flow.
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    target.email,
    { redirectTo },
  );

  if (!inviteError) {
    return { success: true };
  }

  if (!isUserAlreadyExistsError(inviteError)) {
    console.error('[resendInvite] inviteUserByEmail failed:', inviteError);
    return {
      success: false,
      message: inviteError.message
        ? `Could not send invite: ${inviteError.message}`
        : 'Could not send invite. Try again.',
    };
  }

  // Auth user already exists but hasn't joined — mint a fresh sign-in link and
  // email it with our own template (Supabase won't re-send its invite email).
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: target.email,
    options: { redirectTo },
  });

  const actionLink = linkData?.properties?.action_link;
  if (linkError || !actionLink) {
    console.error('[resendInvite] generateLink failed:', linkError);
    return { success: false, message: 'Could not generate an invite link. Try again.' };
  }

  const email = memberInviteEmail({
    firstName: target.first_name ?? undefined,
    url: actionLink,
  });

  const sent = await sendEmail({ to: target.email, ...email });
  if (!sent) {
    return { success: false, message: 'Could not send the invite email. Contact ThinkBiz Support.' };
  }

  return { success: true };
}
