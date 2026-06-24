'use server';

import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/utils/supabase/admin';
import { dispatchNotifications } from '@/lib/notifications/dispatch';
import { newApplicationEmail } from '@/lib/email/templates';

export interface ApplicationFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  clubId: string;
  companyName: string;
  title: string;
  bio: string;
  coreSkills: string;
}

export async function submitApplicationAction(formData: ApplicationFormData) {
    if (!formData || !formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.clubId || !formData.companyName || !formData.title || !formData.bio || !formData.coreSkills) {
        return { success: false, message: 'Invalid submission: Missing required fields.' };
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase
        .from('pending_applications')
        .insert([{
            first_name: formData.firstName,
            last_name: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            club_id: formData.clubId,
            company_name: formData.companyName,
            title: formData.title,
            bio: formData.bio,
            core_skills: formData.coreSkills,
        }]);

    if (error) {
        if (error.code === '23505') {
            return {
                success: false,
                message: "An application with this email is already on file. If you're already a ThinkBiz member, head to the login page and use \"Forgot password\" to get back in.",
            };
        }
        console.error('Error inserting application:', error);
        return { success: false, message: 'Failed to submit application.' };
    }

    // Best-effort: alert the club's directors (and platform admins) that a new
    // application is waiting. Never let a notification failure fail the
    // submission — the applicant has already done their part.
    try {
        await notifyDirectorsOfApplication(formData);
    } catch (notifyError) {
        console.error('[submitApplication] director notification failed:', notifyError);
    }

    return { success: true };
}

async function notifyDirectorsOfApplication(formData: ApplicationFormData): Promise<void> {
    const admin = createAdminClient();

    // Directors of the requested club, plus any platform admins, so the
    // application is never stranded if a club has no director assigned.
    const [{ data: directors }, { data: admins }, { data: club }] = await Promise.all([
        admin.from('members').select('id').eq('current_club_id', formData.clubId).eq('club_director', true),
        admin.from('members').select('id').eq('is_admin', true),
        admin.from('clubs').select('name').eq('id', formData.clubId).maybeSingle(),
    ]);

    const recipientIds = Array.from(
        new Set([...(directors ?? []), ...(admins ?? [])].map((r) => r.id as string)),
    );
    if (recipientIds.length === 0) return;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const applicantName = `${formData.firstName} ${formData.lastName}`.trim();

    await dispatchNotifications({
        category: 'application',
        recipientMemberIds: recipientIds,
        push: {
            title: 'New membership application',
            body: `${applicantName} applied to join${club?.name ? ` ${club.name}` : ''}.`,
            url: `${siteUrl}/dashboard/applications`,
            tag: 'application-submitted',
        },
        email: newApplicationEmail({
            applicantName,
            clubName: club?.name ?? undefined,
            url: `${siteUrl}/dashboard/applications`,
        }),
    });
}