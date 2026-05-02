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

  const { error } = await supabase
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
    .eq('auth_user_id', user.id);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath('/profile');
  return { success: true };
}
