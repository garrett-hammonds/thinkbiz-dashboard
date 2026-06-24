'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

// Supabase login errors are accurate but unhelpful to a stuck member. Most of
// our "I can't get in" reports are existing members who were invited but never
// set a password (so there's nothing to sign in with) — the raw "Invalid login
// credentials" gives them no way forward. Map the common cases to a message that
// sends them to "Forgot password", which now works for every existing member.
function friendlyLoginError(raw: string): string {
  const msg = raw.toLowerCase();
  if (msg.includes('invalid login credentials')) {
    return 'That email or password is incorrect. If you have never set a password, use "Forgot password" below and we will email you a link to get in.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Your email is not confirmed yet. Use "Forgot password" below and we will email you a fresh link to get in.';
  }
  return raw;
}

export async function login(formData: FormData) {
  const email = ((formData.get('email') as string | null) ?? '').trim();
  const password = (formData.get('password') as string | null) ?? '';

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('Supabase Login Error:', error.message);
    redirect(`/login?message=${encodeURIComponent(friendlyLoginError(error.message))}`);
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}