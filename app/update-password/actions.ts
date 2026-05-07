'use server';

import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export async function updateUserPassword(formData: FormData) {
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (!password || password.length < 6) {
    redirect('/update-password?message=Password must be at least 6 characters');
  }
  if (password !== confirmPassword){
    redirect('/update-password?message=Passwords do not match');
  }
  
  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/update-password?message=${encodeURIComponent(error.message)}`);
  }

  redirect('/dashboard');
}
