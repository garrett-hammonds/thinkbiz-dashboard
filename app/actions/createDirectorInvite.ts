'use server';

import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { createDirectorInviteToken } from '@/utils/inviteTokens';

export interface CreateDirectorInviteResult {
  success: boolean;
  message?: string;
  inviteUrl?: string;
}

export async function createDirectorInvite(
  email: string,
  clubId: string,
): Promise<CreateDirectorInviteResult> {
  const trimmedEmail = (email || '').trim().toLowerCase();
  const trimmedClubId = (clubId || '').trim();

  if (!trimmedEmail || !trimmedClubId) {
    return { success: false, message: 'Email and club are required.' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return { success: false, message: 'Please enter a valid email address.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: 'You must be signed in.' };
  }

  const member = await getMemberForUser(supabase, user);
  if (!member?.is_admin) {
    return { success: false, message: 'Only admins can invite directors.' };
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: club, error: clubError } = await admin
    .from('clubs')
    .select('id')
    .eq('id', trimmedClubId)
    .maybeSingle();

  if (clubError || !club) {
    return { success: false, message: 'Selected club does not exist.' };
  }

  let token: string;
  try {
    token = await createDirectorInviteToken({ email: trimmedEmail, clubId: trimmedClubId });
  } catch (err) {
    console.error('[createDirectorInvite] token signing failed:', err);
    return {
      success: false,
      message: 'Server is missing DIRECTOR_INVITE_SECRET. Set it and redeploy.',
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const inviteUrl = `${baseUrl}/director-invite?token=${encodeURIComponent(token)}`;

  return { success: true, inviteUrl };
}
