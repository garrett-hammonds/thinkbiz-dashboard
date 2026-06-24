'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { findAuthUserByEmail } from '@/utils/supabase/authUsers';
import { buildRecoveryLink, buildOnboardingLink } from '@/utils/supabase/authLinks';
import { sendEmail } from '@/lib/email/client';
import { passwordResetEmail, memberInviteEmail } from '@/lib/email/templates';
import { redirect } from 'next/navigation';

// "Forgot password" is the universal "get me back into the app" path. Three
// kinds of people hit it, and all three must end up with a link that actually
// works — including across devices (request on a phone, open the email on a
// laptop), which the old Supabase default flow silently broke.
//
//   1. A member with a real auth account → branded password-reset link.
//   2. A legacy member (in `members`, no auth account yet) → an invite link that
//      creates their account and lets them set a password. A plain reset email
//      is silently dropped by Supabase for non-existent users, so these members
//      would otherwise wait forever.
//   3. Someone with no record at all → we send nothing, but show the same
//      confirmation so the form can't be used to probe which emails exist.
//
// Every link is generated as a `token_hash` and emailed by us (via Resend)
// pointing at /auth/confirm, which verifies it server-side after the member
// clicks "Continue" — stateless, device-independent, and safe from link
// prefetchers that would otherwise spend the one-time token. See
// utils/supabase/authLinks.ts.
export async function resetPassword(formData: FormData) {
  const email = ((formData.get('email') as string | null) ?? '').trim();
  if (!email) {
    redirect('/forgot-password?error=Email is required');
  }

  const next = '/update-password';

  // NOTE: never call redirect() inside the try block — it throws to work, and the
  // catch would swallow it. We set a flag and redirect after.
  let sendFailed = false;

  try {
    const admin = createAdminClient();
    const authUser = await findAuthUserByEmail(admin, email);

    if (authUser) {
      // Case 1: real auth account → password-reset link.
      const url = await buildRecoveryLink(admin, email, next);
      if (url) {
        const sent = await sendEmail({ to: email, ...passwordResetEmail({ url }) });
        if (!sent) sendFailed = true;
      } else {
        sendFailed = true;
      }
    } else {
      const { data: member } = await admin
        .from('members')
        .select('id, first_name')
        .ilike('email', email)
        .maybeSingle();

      if (member) {
        // Case 2: legacy member, no auth account → invite link.
        const result = await buildOnboardingLink(admin, email, next);
        if (result) {
          const sent = await sendEmail({
            to: email,
            ...memberInviteEmail({ firstName: member.first_name ?? undefined, url: result.url }),
          });
          if (!sent) sendFailed = true;
        } else {
          sendFailed = true;
        }
      }
      // Case 3: no record → send nothing, fall through to the generic success.
    }
  } catch (err) {
    console.error('[resetPassword] failed:', err);
    sendFailed = true;
  }

  if (sendFailed) {
    redirect('/forgot-password?error=Something went wrong sending your link. Please try again, or contact ThinkBiz Support.');
  }

  redirect(
    '/forgot-password?success=If that email is registered, we just sent a link to get you back in. Check your inbox (and your spam folder).',
  );
}
