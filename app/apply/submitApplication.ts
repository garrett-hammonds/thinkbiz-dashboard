'use server';

import { createClient } from '@supabase/supabase-js';

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
            return { success: false, message: 'An application with this email already exists.' };
        }
        console.error('Error inserting application:', error);
        return { success: false, message: 'Failed to submit application.' };
    }

    return { success: true };
}