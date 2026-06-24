import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';

// Single landing point for every Supabase auth email link — invites, password
// recovery, and magic links. Supabase delivers these in different shapes
// depending on project and email-template config, so we handle all of them
// instead of assuming one:
//   - ?code=...                   PKCE / server flow  → exchangeCodeForSession
//   - ?token_hash=...&type=...    OTP-style links     → verifyOtp
//   - ?error=...&error_description=...  expired/used  → surface the real reason
//
// Anything we can't turn into a session sends the user back to /login with a
// plain-language message that points them at "Forgot password" to self-serve a
// fresh link, rather than the old catch-all "Invalid or expired invite link".
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const code = params.get('code');
  const tokenHash = params.get('token_hash');
  const type = params.get('type') as EmailOtpType | null;
  const errorDescription = params.get('error_description') || params.get('error');

  const nextParam = params.get('next');
  const safeNext = nextParam && nextParam.startsWith('/') ? nextParam : '/dashboard';

  const expiredMessage =
    'That sign-in link has expired or was already used. Use "Forgot password" on the login page to get a fresh one.';

  // Supabase itself reported a problem (most often an expired or already-used
  // link). Don't bother exchanging — tell the user plainly.
  if (errorDescription) {
    console.error('[auth/callback] link error:', errorDescription);
    return NextResponse.redirect(
      new URL(`/login?message=${encodeURIComponent(expiredMessage)}`, request.url),
    );
  }

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, request.url));
    }
    console.error('[auth/callback] exchangeCodeForSession failed:', error.message);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, request.url));
    }
    console.error('[auth/callback] verifyOtp failed:', error.message);
  }

  return NextResponse.redirect(
    new URL(`/login?message=${encodeURIComponent(expiredMessage)}`, request.url),
  );
}
