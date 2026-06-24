'use server';

import { type SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { dispatchNotifications } from '@/lib/notifications/dispatch';
import { applicationApprovedEmail } from '@/lib/email/templates';

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

export async function approveApplication(applicationId: string) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: 'Unauthorized' };
    }

    const supabaseAdmin = createAdminClient();

    const { data: application, error } = await supabaseAdmin
      .from('pending_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (error || !application || application.status === 'approved') {
      return { success: false, message: 'Application not found or already approved.' };
    }

    let newUserId: string;
    let emailSent = true;

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      application.email,
      { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback?next=/update-password` }
    );

    if (inviteError && isUserAlreadyExistsError(inviteError)) {
      const existingAuthUser = await findAuthUserByEmail(supabaseAdmin, application.email);
      if (!existingAuthUser) {
        console.error(
          '[approveApplication] auth user reported as existing but lookup failed:',
          inviteError,
        );
        return {
          success: false,
          message: 'An account exists for this email but we could not look it up. Contact ThinkBiz Support.',
        };
      }
      newUserId = existingAuthUser.id;
      emailSent = false;
    } else if (inviteError || !inviteData?.user) {
      console.error('[approveApplication] inviteUserByEmail failed:', inviteError);
      return {
        success: false,
        message: inviteError?.message
          ? `Failed to invite user: ${inviteError.message}`
          : 'Failed to invite user.',
      };
    } else {
      newUserId = inviteData.user.id;
    }

    const memberData = {
      auth_user_id: newUserId,
      current_club_id: application.club_id,
      first_name: application.first_name,
      last_name: application.last_name,
      email: application.email,
      company_name: application.company_name,
      title: application.title,
      bio: application.bio,
      core_skills: application.core_skills ? application.core_skills.split(',').map((skill: string) => skill.trim()) : [],
      // Active members are the ones surfaced in club directories (chat, the
      // weekly-log thank-you picker, the roster). Approving an application
      // makes them a member, so mark them active.
      is_active: true,
    };

    const { data: existingMember } = await supabaseAdmin
      .from('members')
      .select('id')
      .ilike('email', application.email)
      .maybeSingle();

    let memberId: string | undefined;

    if (existingMember) {
      const { error: updateMemberError } = await supabaseAdmin
        .from('members')
        .update(memberData)
        .eq('id', existingMember.id);

      if (updateMemberError) {
        console.error('[approveApplication] member update failed:', updateMemberError);
        return { success: false, message: 'Failed to update member profile.' };
      }
      memberId = existingMember.id;
    } else {
      const { data: insertedMember, error: insertError } = await supabaseAdmin
        .from('members')
        .insert(memberData)
        .select('id')
        .single();

      if (insertError || !insertedMember) {
        console.error('[approveApplication] member insert failed:', insertError);
        return { success: false, message: 'Failed to create member profile.' };
      }
      memberId = insertedMember.id;
    }

    const { error: updateError } = await supabaseAdmin
      .from('pending_applications')
      .update({ status: 'approved' })
      .eq('id', applicationId);

    if (updateError) {
      return { success: false, message: 'Failed to update application status.' };
    }

    // Best-effort "you're approved" notification (separate from the Supabase
    // auth invite email above). Never let a notification failure fail approval.
    if (memberId) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      const email = applicationApprovedEmail({
        firstName: application.first_name,
        url: `${siteUrl}/dashboard`,
      });
      await dispatchNotifications({
        category: 'application',
        recipientMemberIds: [memberId],
        push: {
          title: 'Welcome to ThinkBiz!',
          body: 'Your application has been approved. Tap to get started.',
          url: `${siteUrl}/dashboard`,
          tag: 'application-approved',
        },
        email,
      });
    }

    return {
      success: true,
      message: emailSent
        ? undefined
        : 'Approved. This email already had a ThinkBiz account, so no invite email was sent — they can sign in with their existing password.',
    };
  } catch (err) {
    console.error('Error approving application:', err);
    return { success: false, message: 'An unexpected error occurred.' };
  }
}
