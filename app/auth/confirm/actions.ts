'use server';

import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { safeNextPath } from '@/utils/safeRedirect';

const EXPIRED_MESSAGE =
  'That sign-in link has expired or was already used. Use "Forgot password" on the login page to get a fresh one.';

// Verifies an auth email link's one-time token and establishes the session.
//
// This runs ONLY in response to the member pressing "Continue" on /auth/confirm,
// i.e. a POST. That's the whole point: a one-time token must never be spent by a
// passive GET, because email security scanners, antivirus, Gmail link-prefetch
// and chat link previews all issue GETs on links before the human clicks. Doing
// the verifyOtp here (POST, behind a real click) keeps the token alive for the
// member instead of letting a prefetch burn it. See app/auth/confirm/page.tsx.
export async function confirmAuthLink(formData: FormData) {
  const tokenHash = ((formData.get('token_hash') as string | null) ?? '').trim();
  const type = (formData.get('type') as EmailOtpType | null) ?? null;
  const next = safeNextPath(formData.get('next') as string | null);

  if (!tokenHash || !type) {
    redirect(`/login?message=${encodeURIComponent(EXPIRED_MESSAGE)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    console.error('[auth/confirm] verifyOtp failed:', error.message);
    redirect(`/login?message=${encodeURIComponent(EXPIRED_MESSAGE)}`);
  }

  redirect(next);
}
