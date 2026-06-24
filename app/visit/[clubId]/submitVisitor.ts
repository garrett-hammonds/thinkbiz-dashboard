'use server';

import { createClient } from '@supabase/supabase-js';

export interface VisitorFormData {
  clubId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  title: string;
  notes: string;
}

export async function submitVisitorAction(formData: VisitorFormData) {
  if (!formData || !formData.clubId || !formData.firstName.trim()) {
    return { success: false, message: 'Please enter your name.' };
  }

  // A visitor must leave at least one way to be contacted, matching the
  // table's CHECK constraint.
  if (!formData.email.trim() && !formData.phone.trim()) {
    return { success: false, message: 'Please add an email or phone number so the club can reach you.' };
  }

  if (formData.email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      return { success: false, message: 'Please enter a valid email address.' };
    }
  }

  // Anon client: the check-in form is public (no login), and the visitors
  // INSERT policy allows the anon role. Mirrors app/apply/submitApplication.ts.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { error } = await supabase.from('visitors').insert([
    {
      club_id: formData.clubId,
      first_name: formData.firstName.trim(),
      last_name: formData.lastName.trim() || null,
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null,
      company_name: formData.companyName.trim() || null,
      title: formData.title.trim() || null,
      notes: formData.notes.trim() || null,
      source: 'meeting',
    },
  ]);

  if (error) {
    // 23503 = foreign key violation: the club id in the URL doesn't exist.
    if (error.code === '23503') {
      return { success: false, message: "We couldn't find that club. Please ask the host for an up-to-date check-in link." };
    }
    console.error('Error inserting visitor:', error);
    return { success: false, message: 'Something went wrong. Please try again.' };
  }

  return { success: true };
}
