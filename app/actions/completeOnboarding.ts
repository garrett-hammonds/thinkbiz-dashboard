'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { firstLengthError } from '@/utils/validation';

export interface CompleteOnboardingResult {
  success: boolean;
  message?: string;
}

export async function completeOnboarding(formData: FormData): Promise<CompleteOnboardingResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'You must be signed in.' };
  }

  const first_name = (formData.get('first_name') as string | null)?.trim() ?? '';
  const last_name = (formData.get('last_name') as string | null)?.trim() ?? '';
  const phone_number = (formData.get('phone_number') as string | null)?.trim() ?? '';
  const company_name = (formData.get('company_name') as string | null)?.trim() ?? '';
  const title = (formData.get('title') as string | null)?.trim() ?? '';
  const bio = (formData.get('bio') as string | null)?.trim() ?? '';
  const skillsStr = (formData.get('core_skills') as string | null) ?? '';
  const core_skills = skillsStr.split(',').map((s) => s.trim()).filter(Boolean);

  const website_url = (formData.get('website_url') as string | null)?.trim() ?? '';
  const linkedin_url = (formData.get('linkedin_url') as string | null)?.trim() ?? '';
  const booking_calendar_url = (formData.get('booking_calendar_url') as string | null)?.trim() ?? '';
  const short_bio = (formData.get('short_bio') as string | null)?.trim() ?? '';
  const member_headshot = (formData.get('member_headshot') as string | null)?.trim() ?? '';

  const required: Array<[string, string]> = [
    ['First name', first_name],
    ['Last name', last_name],
    ['Phone number', phone_number],
    ['Company name', company_name],
    ['Title', title],
    ['Bio', bio],
  ];
  for (const [label, value] of required) {
    if (!value) return { success: false, message: `${label} is required.` };
  }
  if (core_skills.length === 0) {
    return { success: false, message: 'Add at least one core skill.' };
  }

  const lengthError = firstLengthError([
    ['First name', first_name, 'name'],
    ['Last name', last_name, 'name'],
    ['Phone number', phone_number, 'phone'],
    ['Company name', company_name, 'shortText'],
    ['Title', title, 'shortText'],
    ['Bio', bio, 'longText'],
    ['Short bio', short_bio, 'shortText'],
    ['Core skills', skillsStr, 'skills'],
    ['Website URL', website_url, 'shortText'],
    ['LinkedIn URL', linkedin_url, 'shortText'],
    ['Booking calendar URL', booking_calendar_url, 'shortText'],
  ]);
  if (lengthError) {
    return { success: false, message: lengthError };
  }

  const isValidUrl = (url: string) => {
    if (!url) return true;
    try { new URL(url); return true; } catch { return false; }
  };
  if (!isValidUrl(website_url) || !isValidUrl(linkedin_url) || !isValidUrl(booking_calendar_url)) {
    return { success: false, message: 'Please provide valid URLs including http:// or https://' };
  }

  const { error } = await supabase
    .from('members')
    .update({
      first_name,
      last_name,
      phone_number,
      company_name,
      title,
      bio,
      core_skills,
      website_url: website_url || null,
      linkedin_url: linkedin_url || null,
      booking_calendar_url: booking_calendar_url || null,
      short_bio: short_bio || null,
      member_headshot: member_headshot || null,
      profile_completed_at: new Date().toISOString(),
    })
    .eq('auth_user_id', user.id);

  if (error) {
    console.error('[completeOnboarding] update failed:', error);
    return { success: false, message: 'We couldn’t save your details. Please try again.' };
  }

  revalidatePath('/dashboard');
  revalidatePath('/profile');
  return { success: true };
}
