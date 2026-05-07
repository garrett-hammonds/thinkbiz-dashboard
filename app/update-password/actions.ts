'use server';

import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export async function updateUserPassword(formData: FormData) {
  const password = formData.get('password') as string;

  if (!password || password.length < 6) {
    redirect('/update-password?message=Password must be at least 6 characters');
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/update-password?message=${encodeURIComponent(error.message)}`);
  }

  redirect('/dashboard');
}
