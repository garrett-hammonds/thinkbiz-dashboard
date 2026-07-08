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

  if (!stripe || !sessionId) {
    return NextResponse.redirect(new URL('/billing?status=canceled', request.url));
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    const subscription = session.subscription;
    if (subscription && typeof subscription !== 'string') {
      await syncSubscriptionToMember(subscription);
      return NextResponse.redirect(new URL('/dashboard?status=membership_active', request.url));
    }
  } catch (err) {
    console.error('[billing/success] failed to confirm checkout session:', err);
  }

  // Couldn't confirm — send them back to the paywall. If they did pay, the
  // webhook will catch up and the gate will clear on their next visit.
  return NextResponse.redirect(new URL('/billing?status=processing', request.url));
}
