'use server';

import { type SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { findAuthUserByEmail } from '@/utils/supabase/authUsers';
import { dispatchNotifications } from '@/lib/notifications/dispatch';
import { sendEmail } from '@/lib/email/client';
import { applicationApprovedEmail } from '@/lib/email/templates';

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

// Produces the link a newly-approved member clicks to GET INTO the app for the
// first time. The link signs them in and drops them on /update-password so they
// can set a password — this is the piece that was missing before (the approval
// email pointed at /dashboard, which just bounced a passwordless member to
// /login with no way forward).
//
// We generate the link ourselves (rather than letting Supabase send its own
// invite email) so it can ride inside our branded approval email as the button.
// New auth users are created via an 'invite' link; members who already have an
// auth account get a 'magiclink' instead (invite would reject them).
async function generateOnboardingLink(
  admin: SupabaseClient,
  email: string,
  redirectTo: string,
): Promise<{ userId: string; actionLink: string } | { error: string }> {
  const invite = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo },
  });

  if (!invite.error && invite.data?.user && invite.data.properties?.action_link) {
    return { userId: invite.data.user.id, actionLink: invite.data.properties.action_link };
  }

  if (invite.error && !isUserAlreadyExistsError(invite.error)) {
    console.error('[approveApplication] generateLink(invite) failed:', invite.error);
    return { error: invite.error.message || 'Failed to create sign-in link.' };
  }

  // Auth user already exists → mint a magic link to the same destination.
  const magic = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo },
  });

  const actionLink = magic.data?.properties?.action_link;
  const userId = magic.data?.user?.id ?? (await findAuthUserByEmail(admin, email))?.id;

  if (magic.error || !actionLink || !userId) {
    console.error('[approveApplication] generateLink(magiclink) failed:', magic.error);
    return { error: magic.error?.message || 'Failed to create sign-in link.' };
  }

  return { userId, actionLink };
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

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const redirectTo = `${siteUrl}/auth/callback?next=/update-password`;

    const linkResult = await generateOnboardingLink(supabaseAdmin, application.email, redirectTo);
    if ('error' in linkResult) {
      return { success: false, message: `Failed to invite user: ${linkResult.error}` };
    }
    const { userId: newUserId, actionLink } = linkResult;

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

    // The welcome email IS the member's way into the app: its button is the
    // sign-in link generated above, which lands them on /update-password to set
    // a password. Send it directly (transactional) so it can't be suppressed by
    // notification preferences — without it, an approved member has no way in.
    const welcome = applicationApprovedEmail({
      firstName: application.first_name,
      url: actionLink,
    });
    const emailSent = await sendEmail({ to: application.email, ...welcome });

    // Best-effort push too (a no-op for brand-new members who haven't subscribed
    // a device yet, but covers re-approval of an existing member). Never let a
    // notification failure fail approval.
    if (memberId) {
      await dispatchNotifications({
        category: 'application',
        recipientMemberIds: [memberId],
        push: {
          title: 'Welcome to ThinkBiz!',
          body: 'Your application has been approved. Tap to get started.',
          url: `${siteUrl}/dashboard`,
          tag: 'application-approved',
        },
      });
    }

    return {
      success: true,
      message: emailSent
        ? undefined
        : "Approved, but the welcome email couldn't be sent. Use \"Resend invite\" on the roster so they get their sign-in link.",
    };
  } catch (err) {
    console.error('Error approving application:', err);
    return { success: false, message: 'An unexpected error occurred.' };
  }
}
