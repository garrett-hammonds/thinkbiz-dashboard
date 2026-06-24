'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { findAuthUserByEmail } from '@/utils/supabase/authUsers';
import { redirect } from 'next/navigation';

// "Forgot password" is the universal "get me back into the app" path, and three
// kinds of people hit it — all three must end up with a link that works:
//
//   1. A member with a real Supabase auth account → send a normal password-reset
//      (recovery) email.
//   2. A legacy member: exists in our `members` table but was never given an auth
//      account (bulk-imported, or approved before the invite flow). Supabase
//      silently drops reset emails for addresses with no auth user, so these
//      members would wait forever for an email that never arrives. Instead we
//      send them an invite, which creates the auth account AND lets them set a
//      password — the same end state the reset flow gives everyone else.
//   3. Someone with no record at all → we send nothing, but still show the same
//      confirmation, so this form can't be used to probe which emails exist.
export async function resetPassword(formData: FormData) {
  const email = ((formData.get('email') as string | null) ?? '').trim();
  if (!email) {
    redirect('/forgot-password?error=Email is required');
  }

  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback?next=/update-password`;

  // Shown for every successful outcome below (including "no such email") so the
  // response never reveals whether an account exists.
  const successRedirect =
    '/forgot-password?success=If that email is registered, we just sent a link to get you back in. Check your inbox (and your spam folder).';

  const supabase = await createClient();

  // Decide what to send. NOTE: never call redirect() inside the try block — it
  // works by throwing, which the catch would swallow. We set flags and act after.
  let sendReset = false; // a recovery email is needed
  let alreadyHandled = false; // an invite was sent, or there's nothing to send

  try {
    const admin = createAdminClient();
    const authUser = await findAuthUserByEmail(admin, email);

    if (authUser) {
      // Case 1: real auth account → recovery email.
      sendReset = true;
    } else {
      const { data: member } = await admin
        .from('members')
        .select('id')
        .ilike('email', email)
        .maybeSingle();

      if (member) {
        // Case 2: legacy member, no auth account → invite to create one.
        const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
        if (inviteError) {
          // Most likely the auth user actually does exist (paged lookup missed
          // them); fall back to a normal recovery email.
          console.error('[resetPassword] invite for legacy member failed, falling back to reset:', inviteError.message);
          sendReset = true;
        } else {
          alreadyHandled = true;
        }
      } else {
        // Case 3: no record at all → send nothing, but show the same message.
        alreadyHandled = true;
      }
    }
  } catch (err) {
    // Admin client unavailable (e.g. missing service-role key) or an unexpected
    // failure. Degrade to the standard reset path so real accounts still get a
    // link — this is exactly the original behavior.
    console.error('[resetPassword] admin path unavailable; using plain reset:', err);
    sendReset = true;
  }

  if (sendReset && !alreadyHandled) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      console.error('[resetPassword] resetPasswordForEmail failed:', error.message);
      redirect('/forgot-password?error=Something went wrong sending your link. Please try again.');
    }
  }

  redirect(successRedirect);
}
