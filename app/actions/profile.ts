'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const company_name = formData.get('company_name') as string;
  const title = formData.get('title') as string;
  const bio = formData.get('bio') as string;
  const website_url = formData.get('website_url') as string;
  const linkedin_url = formData.get('linkedin_url') as string;
  const booking_calendar_url = formData.get('booking_calendar_url') as string;
  const member_headshot = formData.get('member_headshot') as string;

  const skillsStr = formData.get('core_skills') as string;
  const core_skills = skillsStr ? skillsStr.split(',').map(s => s.trim()).filter(Boolean) : [];

  // Makes sure all URLs are good 'n proper
  const isValidUrl = (url: string) => {
    if (!url) return true; // allow empty strings if the field is optional
    try { new URL(url); return true; } catch { return false; }
  };

  if (!isValidUrl(website_url) || !isValidUrl(linkedin_url) || !isValidUrl(booking_calendar_url)) {
    return { success: false, message: 'Please provide valid URLs including http:// or https://' };
  }

  const { data: updatedMember, error } = await supabase
    .from('members')
    .update({
      company_name,
      title,
      bio,
      website_url,
      linkedin_url,
      booking_calendar_url,
      member_headshot,
      core_skills
    })
    .eq('auth_user_id', user.id)
    .select('id')
    .single();

  if (error) {
    return { success: false, message: error.message };
  }

  // Notification preferences ride the same form. A checkbox is present in the
  // FormData only when checked, so absence => false.
  const cb = (name: string) => formData.get(name) === 'on';
  if (updatedMember?.id) {
    const { error: prefsError } = await supabase
      .from('notification_preferences')
      .upsert(
        {
          member_id: updatedMember.id,
          email_enabled: cb('email_enabled'),
          push_enabled: cb('push_enabled'),
          email_chat: cb('email_chat'),
          email_log_reminder: cb('email_log_reminder'),
          email_application: cb('email_application'),
          push_chat: cb('push_chat'),
          push_log_reminder: cb('push_log_reminder'),
          push_application: cb('push_application'),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'member_id' },
      );
    if (prefsError) {
      // Don't fail the whole save — the profile itself updated fine.
      console.error('[updateProfile] notification_preferences upsert failed:', prefsError);
    }
  }

  revalidatePath('/profile');
  return { success: true };
}
