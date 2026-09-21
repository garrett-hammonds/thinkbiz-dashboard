import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe/client';
import { syncSubscriptionToMember } from '@/lib/stripe/sync';

// Where Stripe Checkout redirects after a successful payment. We confirm the
// session and write the member's subscription state immediately, so the access
// gate lets them straight into the dashboard instead of bouncing them back to
// the paywall while the webhook is still in flight. The webhook stays the source
// of truth for everything afterward.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');
  const stripe = getStripe();

  // Checkout started inside the phone app runs in the system browser; the
  // final destination is reached through /billing/return, which hands focus
  // back to the app (see that route). In a browser it's a plain redirect.
  const native = url.searchParams.get('native') === '1';
  const finish = (path: string) =>
    NextResponse.redirect(
      new URL(native ? `/billing/return?to=${encodeURIComponent(path)}` : path, request.url),
    );

  if (!stripe || !sessionId) {
    return finish('/billing?status=canceled');
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    const subscription = session.subscription;
    if (subscription && typeof subscription !== 'string') {
      await syncSubscriptionToMember(subscription);
      return finish('/dashboard?status=membership_active');
    }
  } catch (err) {
    console.error('[billing/success] failed to confirm checkout session:', err);
  }

  // Couldn't confirm — send them back to the paywall. If they did pay, the
  // webhook will catch up and the gate will clear on their next visit.
  return finish('/billing?status=processing');
}
