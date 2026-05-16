'use server';

import { createClient as createAdminClient } from '@supabase/supabase-js';
import { verifyDirectorInviteToken } from '@/utils/inviteTokens';

export interface AcceptDirectorInviteInput {
  token: string;
  firstName: string;
  lastName: string;
  phone: string;
  companyName: string;
  title: string;
  bio: string;
  coreSkills: string;
}

export interface AcceptDirectorInviteResult {
  success: boolean;
  message?: string;
}

export async function acceptDirectorInvite(
  input: AcceptDirectorInviteInput,
): Promise<AcceptDirectorInviteResult> {
  const required: Array<[string, string | undefined]> = [
    ['token', input.token],
    ['First name', input.firstName],
    ['Last name', input.lastName],
    ['Phone', input.phone],
    ['Company name', input.companyName],
    ['Title', input.title],
    ['Bio', input.bio],
    ['Core skills', input.coreSkills],
  ];
  for (const [label, value] of required) {
    if (!value || !value.trim()) {
      return { success: false, message: `${label} is required.` };
    }
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
    .select('id')
    .ilike('email', claims.email)
    .maybeSingle();
  if (existingMember) {
    return {
      success: false,
      message: 'An account already exists for this email. Use the login page.',
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

  const { error: insertError } = await admin.from('members').insert({
    auth_user_id: inviteData.user.id,
    current_club_id: claims.clubId,
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    email: claims.email,
    phone: input.phone.trim(),
    company_name: input.companyName.trim(),
    title: input.title.trim(),
    bio: input.bio.trim(),
    core_skills: input.coreSkills
      .split(',')
      .map((skill) => skill.trim())
      .filter(Boolean),
    club_director: true,
  });

  if (insertError) {
    console.error('[acceptDirectorInvite] member insert failed:', insertError);
    return { success: false, message: 'Failed to create director profile.' };
  }

  return { success: true };
}
