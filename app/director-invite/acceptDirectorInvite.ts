'use server';

import { createClient as createAdminClient } from '@supabase/supabase-js';
import { verifyDirectorInviteToken } from '@/utils/inviteTokens';
import { buildOnboardingLink } from '@/utils/supabase/authLinks';
import { sendEmail } from '@/lib/email/client';
import { memberInviteEmail } from '@/lib/email/templates';

export interface AcceptDirectorInviteInput {
  token: string;
}

export interface AcceptDirectorInviteResult {
  success: boolean;
  message?: string;
}

export async function acceptDirectorInvite(
  input: AcceptDirectorInviteInput,
): Promise<AcceptDirectorInviteResult> {
  if (!input.token) {
    return { success: false, message: 'Missing invite token.' };
  }

  let claims;
  try {
    claims = await verifyDirectorInviteToken(input.token);
  } catch (err) {
    console.warn('[acceptDirectorInvite] token verification failed:', err);
    return { success: false, message: 'This invite link is invalid or has expired.' };
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: club } = await admin
    .from('clubs')
    .select('id')
    .eq('id', claims.clubId)
    .maybeSingle();
  if (!club) {
    return { success: false, message: 'The club referenced by this invite no longer exists.' };
  }

  const { data: existingMember } = await admin
    .from('members')
    .select('id, auth_user_id')
    .ilike('email', claims.email)
    .maybeSingle();

  if (existingMember?.auth_user_id) {
    return {
      success: false,
      message: 'An account already exists for this email. Use the login page or contact ThinkBiz Support.',
    };
  }

  // Mint a sign-in link the same way member approval does: an invite link for a
  // brand-new auth user, or a magic link if the auth account already exists
  // (e.g. a prior claim attempt created it before the member row was saved).
  // Either way the recipient lands on /update-password to set a password.
  const link = await buildOnboardingLink(admin, claims.email, '/update-password');
  if (!link) {
    return { success: false, message: 'Could not create your sign-in link. Please try again.' };
  }

  if (existingMember) {
    const { error: updateError } = await admin
      .from('members')
      .update({
        auth_user_id: link.userId,
        current_club_id: claims.clubId,
        club_director: true,
        is_active: true,
      })
      .eq('id', existingMember.id);

    if (updateError) {
      console.error('[acceptDirectorInvite] member update failed:', updateError);
      return { success: false, message: 'Failed to link existing member to invite.' };
    }
  } else {
    // first_name / last_name are NOT NULL in the members schema. Director
    // invites only carry an email, so seed them empty — the onboarding form
    // (which gates the dashboard) requires real names and overwrites these,
    // and the slug trigger regenerates the slug from them on that update.
    const { error: insertError } = await admin.from('members').insert({
      auth_user_id: link.userId,
      current_club_id: claims.clubId,
      email: claims.email,
      first_name: '',
      last_name: '',
      club_director: true,
      is_active: true,
    });

    if (insertError) {
      console.error('[acceptDirectorInvite] member insert failed:', insertError);
      return { success: false, message: 'Failed to create director profile.' };
    }
  }

  const email = memberInviteEmail({ url: link.url });
  const sent = await sendEmail({ to: claims.email, ...email });
  if (!sent) {
    return {
      success: false,
      message:
        'Your account was set up but the sign-in email could not be sent. Use "Forgot password" on the login page to get in, or contact ThinkBiz Support.',
    };
  }

  return { success: true };
}
