import 'server-only';
import { type SupabaseClient } from '@supabase/supabase-js';

// Builds Supabase auth email links the robust way.
//
// The default Supabase email links route through `/auth/v1/verify` and come back
// to the app as a PKCE `?code=`, which `exchangeCodeForSession` can only redeem
// with a code-verifier cookie that lives in the *one* browser that started the
// flow. Open the email on your phone (or a different browser) and the exchange
// fails — the member gets dumped on /login. It also depends on the project's
// redirect allow-list being configured.
//
// Instead we generate the link as a `token_hash` and point it at our own
// /auth/confirm page, which verifies it server-side via `verifyOtp`. That is
// stateless: it works across devices and browsers and doesn't touch the
// allow-list or any cookie. This is Supabase's recommended server-side pattern.
//
// Crucially, /auth/confirm does NOT verify on page load — it verifies only when
// the member presses "Continue" (a POST). A one-time token verified on a plain
// GET gets spent by the first automated GET that touches the link (email
// scanners, antivirus, Gmail link-prefetch, chat link previews), leaving the
// real member with "link expired or already used". The button gate prevents that.

type OtpType = 'invite' | 'magiclink' | 'recovery';

function callbackUrl(tokenHash: string, type: OtpType, next: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const url = new URL(`${siteUrl}/auth/confirm`);
  url.searchParams.set('token_hash', tokenHash);
  url.searchParams.set('type', type);
  url.searchParams.set('next', next);
  return url.toString();
}

function isUserAlreadyExistsError(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  if (err.code === 'email_exists' || err.code === 'user_already_exists') return true;
  const msg = (err.message || '').toLowerCase();
  return msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already');
}

// Password-reset link for an email that already has an auth account.
export async function buildRecoveryLink(
  admin: SupabaseClient,
  email: string,
  next: string,
): Promise<string | null> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    console.error('[authLinks] generateLink(recovery) failed:', error);
    return null;
  }
  return callbackUrl(tokenHash, 'recovery', next);
}

// "Get into the app" link for a member being onboarded. Creates the auth user
// via an invite link if they don't have one yet, or mints a magic link if they
// do. Returns the link plus the auth user id so callers can stamp it on the
// member row.
export async function buildOnboardingLink(
  admin: SupabaseClient,
  email: string,
  next: string,
): Promise<{ url: string; userId: string } | null> {
  // New auth user → invite (this also creates the account).
  const invite = await admin.auth.admin.generateLink({ type: 'invite', email });
  const inviteToken = invite.data?.properties?.hashed_token;
  if (!invite.error && inviteToken && invite.data?.user) {
    return { url: callbackUrl(inviteToken, 'invite', next), userId: invite.data.user.id };
  }
  if (invite.error && !isUserAlreadyExistsError(invite.error)) {
    console.error('[authLinks] generateLink(invite) failed:', invite.error);
    return null;
  }

  // Existing auth user → magic link to the same destination.
  const magic = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const magicToken = magic.data?.properties?.hashed_token;
  const userId = magic.data?.user?.id;
  if (magic.error || !magicToken || !userId) {
    console.error('[authLinks] generateLink(magiclink) failed:', magic.error);
    return null;
  }
  return { url: callbackUrl(magicToken, 'magiclink', next), userId };
}
