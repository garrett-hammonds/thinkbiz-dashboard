import 'server-only';

// Server-side verification of a Cloudflare Turnstile token for the public
// forms. The client renders a Turnstile widget (components/Turnstile.tsx) and
// sends the resulting token to the server action, which calls this to confirm a
// human solved the challenge before doing any work.
//
// Configured via TURNSTILE_SECRET_KEY (+ NEXT_PUBLIC_TURNSTILE_SITE_KEY on the
// client). When the secret is not set the check is a no-op that ALLOWS the
// request, so local dev and not-yet-provisioned environments keep working. When
// the secret IS set, verification is enforced and fails closed on a missing or
// invalid token.

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function isCaptchaConfigured(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

export async function verifyCaptcha(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not configured → allow
  if (!token) return false; // configured but no token → reject

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);
    const res = await fetch(VERIFY_URL, { method: 'POST', body });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    // A verification outage should not silently let challenges through when
    // captcha is deliberately enabled — fail closed.
    console.error('[captcha] verification request failed:', err);
    return false;
  }
}
