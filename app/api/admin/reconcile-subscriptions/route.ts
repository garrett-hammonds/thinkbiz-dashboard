import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { isBillingEnabled } from '@/lib/stripe/client';
import { reconcileAllSubscriptions } from '@/lib/stripe/reconcile';

export const dynamic = 'force-dynamic';

// One-time (re-runnable) backfill: links every existing active Stripe
// subscription to its member by email, so pre-existing subscribers (e.g. from
// GoHighLevel) are marked paid up front and never hit the paywall.
//
// Admin-only: just visit this URL while signed in as an admin. Returns a JSON
// summary including any subscriber emails that didn't match a member (those need
// a manual look — usually an email mismatch between Stripe and the member row).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const member = await getMemberForUser(supabase, user);
  if (!member?.is_admin) {
    return NextResponse.json({ error: 'Admins only' }, { status: 403 });
  }

  if (!isBillingEnabled()) {
    return NextResponse.json({ error: 'Billing is not configured (STRIPE_SECRET_KEY / STRIPE_PRICE_ID missing).' }, { status: 503 });
  }

  const result = await reconcileAllSubscriptions();
  return NextResponse.json({
    ok: true,
    ...result,
    note: result.unmatchedEmails.length
      ? 'Unmatched emails have an active Stripe subscription but no member row with that exact email. Reconcile manually.'
      : 'All active subscriptions were linked to a member.',
  });
}
