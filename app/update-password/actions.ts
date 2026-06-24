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
  // getUser() validates the token with Supabase, unlike getSession() which just
  // reads the cookie. If the recovery/invite link didn't establish a session
  // (expired or already used), send them to "Forgot password" to self-serve.
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?message=Your link expired before you set a password. Use "Forgot password" to get a fresh one.');
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/update-password?message=${encodeURIComponent(error.message)}`);
  }

  await supabase.auth.signOut();
  redirect('/login?message=Password updated successfully. Please log in.');
}
