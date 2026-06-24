import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';

// Compatibility landing point for Supabase auth email links. New links we
// generate now point at /auth/confirm (a button-gated page) instead — see
// utils/supabase/authLinks.ts — but emails already sitting in members' inboxes
// still point here, and Supabase's own hosted emails (e.g. director invites) can
// land here too. We handle every shape Supabase delivers:
//   - ?token_hash=...&type=...    OTP-style links     → forward to /auth/confirm
//   - ?code=...                   PKCE / server flow  → exchangeCodeForSession
//   - ?error=...&error_description=...  expired/used  → surface the real reason
//
// IMPORTANT: we do NOT call verifyOtp here. A one-time token verified on this
// plain GET gets spent by the first automated request that touches the link
// (email scanners, antivirus, Gmail link-prefetch, chat link previews), so the
// member's own click then fails with "link expired or already used" — the exact
// bug this flow had. Instead we forward token_hash links to /auth/confirm, which
// only verifies after the member presses "Continue".
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

  // OTP-style links (the ones we generate): hand off to the button-gated
  // confirm page WITHOUT spending the token here. A passive prefetch that
  // follows this redirect just lands on the confirm page's harmless GET.
  if (tokenHash && type) {
    const confirmUrl = new URL('/auth/confirm', request.url);
    confirmUrl.searchParams.set('token_hash', tokenHash);
    confirmUrl.searchParams.set('type', type);
    confirmUrl.searchParams.set('next', safeNext);
    return NextResponse.redirect(confirmUrl);
  }

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, request.url));
    }
    console.error('[auth/callback] exchangeCodeForSession failed:', error.message);
  }

  return NextResponse.redirect(
    new URL(`/login?message=${encodeURIComponent(expiredMessage)}`, request.url),
  );
}
