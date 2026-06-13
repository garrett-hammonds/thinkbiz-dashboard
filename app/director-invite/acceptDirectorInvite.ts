'use server';

import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js';
import { verifyDirectorInviteToken } from '@/utils/inviteTokens';

export interface AcceptDirectorInviteInput {
  token: string;
}

export interface AcceptDirectorInviteResult {
  success: boolean;
  message?: string;
}

async function findAuthUserByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<{ id: string } | null> {
  const target = email.toLowerCase();
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users) return null;
    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (found) return { id: found.id };
    if (data.users.length < perPage) return null;
    page += 1;
    if (page > 50) return null;
  }
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

  let userId: string;
  let emailSent = true;

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    claims.email,
    {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback?next=/update-password`,
    },
  );

  if (inviteError && isUserAlreadyExistsError(inviteError)) {
    const existingAuthUser = await findAuthUserByEmail(admin, claims.email);
    if (!existingAuthUser) {
      console.error(
        '[acceptDirectorInvite] auth user reported as existing but lookup failed:',
        inviteError,
      );
      return {
        success: false,
        message: 'An account exists for this email but we could not look it up. Contact ThinkBiz Support.',
      };
    }
    userId = existingAuthUser.id;
    emailSent = false;
  } else if (inviteError || !inviteData?.user) {
    console.error('[acceptDirectorInvite] inviteUserByEmail failed:', inviteError);
    return {
      success: false,
      message: inviteError?.message
        ? `Could not send invite email: ${inviteError.message}`
        : 'Failed to send invite email. Try again.',
    };
  } else {
    userId = inviteData.user.id;
  }

  if (existingMember) {
    const { error: updateError } = await admin
      .from('members')
      .update({
        auth_user_id: userId,
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
    const { error: insertError } = await admin.from('members').insert({
      auth_user_id: userId,
      current_club_id: claims.clubId,
      email: claims.email,
      club_director: true,
      is_active: true,
    });

    if (insertError) {
      console.error('[acceptDirectorInvite] member insert failed:', insertError);
      return { success: false, message: 'Failed to create director profile.' };
    }
  }

  return {
    success: true,
    message: emailSent
      ? undefined
      : 'This email already has a ThinkBiz account — sign in with your existing password to finish setup.',
  };
}
