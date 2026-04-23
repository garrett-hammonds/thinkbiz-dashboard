'use server';

import { createServerClient } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function approveApplication(applicationId: string) {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch (error) {
              // Handle error
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch (error) {
              // Handle error
            }
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: 'Unauthorized' };
    }

    const supabaseAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { data: application, error } = await supabaseAdmin
      .from('pending_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (error || !application || application.status === 'approved') {
      return { success: false, message: 'Application not found or already approved.' };
    }

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      application.email
    );

    if (inviteError || !inviteData.user) {
      return { success: false, message: 'Failed to invite user.' };
    }

    const newUserId = inviteData.user.id;

    const { error: insertError } = await supabaseAdmin.from('members').insert({
      auth_user_id: newUserId,
      current_club_id: application.club_id,
      first_name: application.first_name,
      last_name: application.last_name,
      email: application.email,
      company_name: application.company_name,
      title: application.title,
      bio: application.bio,
      core_skills: application.core_skills ? application.core_skills.split(',').map((skill: string) => skill.trim()) : [],
    });

    if (insertError) {
      return { success: false, message: 'Failed to create member profile.' };
    }

    const { error: updateError } = await supabaseAdmin
      .from('pending_applications')
      .update({ status: 'approved' })
      .eq('id', applicationId);

    if (updateError) {
      return { success: false, message: 'Failed to update application status.' };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error approving application:', err);
    return { success: false, message: 'An unexpected error occurred.' };
  }
}
