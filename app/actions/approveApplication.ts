'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { buildOnboardingLink } from '@/utils/supabase/authLinks';
import { dispatchNotifications } from '@/lib/notifications/dispatch';
import { sendEmail } from '@/lib/email/client';
import { applicationApprovedEmail } from '@/lib/email/templates';

export async function approveApplication(applicationId: string) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: 'Unauthorized' };
    }

    // Only admins and club directors may approve. (This runs through the
    // service-role client below, which bypasses RLS, so the check must be
    // explicit here.)
    const member = await getMemberForUser(supabase, user);
    if (!member || (!member.is_admin && !member.club_director)) {
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

    // Admins can approve for any club; a director only for their own.
    if (!member.is_admin && application.club_id !== member.current_club_id) {
      return {
        success: false,
        message: 'You can only approve applications for your own club.',
      };
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const linkResult = await buildOnboardingLink(supabaseAdmin, application.email, '/update-password');
    if (!linkResult) {
      return { success: false, message: 'Failed to create the member sign-in link. Please try again.' };
    }
    const { userId: newUserId, url: actionLink } = linkResult;

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
