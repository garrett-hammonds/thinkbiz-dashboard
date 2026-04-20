'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function submitApplicationAction(formData: any) {
    const cookieStore = await cookies();

    const supabaseAdmin = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: any) {
                    try {
                        cookieStore.set({ name, value, ...options });
                    } catch (error) {}
                },
                remove(name: string, options: any) {
                    try {
                        cookieStore.set({ name, value: '', ...options });
                    } catch (error) {}
                },
            },
        }
    );

    const { data, error } = await supabaseAdmin
        .from('pending_applications')
        .insert([{
            first_name: formData.firstName,
            last_name: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            club_name: formData.clubName,
            company_name: formData.companyName,
            title: formData.title,
            bio: formData.bio,
            core_skills: formData.coreSkills,
        }]);

    if (error) {
        console.error('Error inserting application:', error);
        return { success: false, message: 'Failed to submit application.' };
    }

    return { success: true };
}