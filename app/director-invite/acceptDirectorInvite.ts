'use server';

import { createClient as createAdminClient } from '@supabase/supabase-js';
import { verifyDirectorInviteToken } from '@/utils/inviteTokens';

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

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    claims.email,
    {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback?next=/update-password`,
    },
  );

  if (inviteError || !inviteData.user) {
    console.error('[acceptDirectorInvite] inviteUserByEmail failed:', inviteError);
    return { success: false, message: 'Failed to send invite email. Try again.' };
  }

  if (existingMember) {
    const { error: updateError } = await admin
      .from('members')
      .update({
        auth_user_id: inviteData.user.id,
        current_club_id: claims.clubId,
        club_director: true,
      })
      .eq('id', existingMember.id);

    if (updateError) {
      console.error('[acceptDirectorInvite] member update failed:', updateError);
      return { success: false, message: 'Failed to link existing member to invite.' };
    }
  } else {
    const { error: insertError } = await admin.from('members').insert({
      auth_user_id: inviteData.user.id,
      current_club_id: claims.clubId,
      email: claims.email,
      club_director: true,
    });

    if (insertError) {
      console.error('[acceptDirectorInvite] member insert failed:', insertError);
      return { success: false, message: 'Failed to create director profile.' };
    }
  }

  return { success: true };
}
