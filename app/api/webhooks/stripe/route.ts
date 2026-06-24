import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe/client';
import { syncSubscriptionToMember } from '@/lib/stripe/sync';

export const dynamic = 'force-dynamic';

// Stripe webhook. Keeps each member's billing columns in sync with the real
// state of their subscription in Stripe — this is the source of truth for
// renewals, payment failures, and cancellations, which never produce a redirect
// the app could react to on its own.
//
// Configure in the Stripe dashboard (or `stripe listen` locally) to send:
//   checkout.session.completed, customer.subscription.created/updated/deleted,
//   invoice.payment_failed
// and put the signing secret in STRIPE_WEBHOOK_SECRET.
export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    console.error('[stripe webhook] not configured (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET missing)');
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  // Signature verification requires the raw, unparsed body.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('[stripe webhook] signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id;
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncSubscriptionToMember(subscription);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await syncSubscriptionToMember(event.data.object as Stripe.Subscription);
        break;
      }
      case 'invoice.payment_failed': {
        // The matching subscription.updated (status → past_due/unpaid) carries the
        // authoritative state, but resync here too so the roster reflects it fast.
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | Stripe.Subscription };
        const subscriptionId =
          typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncSubscriptionToMember(subscription);
        }
        break;
      }
      default:
        // Ignore everything else.
        break;
    }
  } catch (err) {
    // Returning 500 tells Stripe to retry, which is what we want on a transient
    // failure (e.g. DB hiccup) so we don't drop a billing state change.
    console.error(`[stripe webhook] handler for ${event.type} failed:`, err);
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
