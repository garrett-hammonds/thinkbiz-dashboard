import 'server-only';
import type Stripe from 'stripe';
import { createAdminClient } from '@/utils/supabase/admin';
import { getStripe, getMembershipPriceId } from '@/lib/stripe/client';
import { applySubscriptionToMember } from '@/lib/stripe/sync';

function isActive(status: Stripe.Subscription.Status): boolean {
  return status === 'active' || status === 'trialing';
}

function onMembershipPrice(sub: Stripe.Subscription, priceId: string | null): boolean {
  if (!priceId) return true; // no specific price configured → accept any
  return sub.items.data.some((item) => item.price.id === priceId);
}

// Picks the subscription that should mark a member paid out of a customer's subs.
// Prefers one on the configured membership price, but falls back to ANY active or
// trialing subscription — matching the webhook (syncSubscriptionToMember), which
// marks a member paid off any active subscription regardless of price.
//
// The fallback is what keeps pre-existing subscribers out of the paywall. Members
// imported from GoHighLevel (or otherwise subscribed before the in-app checkout
// existed) sit on a LEGACY price, not STRIPE_PRICE_ID. Requiring the exact price
// here would wrongly gate them even though they are actively paying — the very
// people this reconciliation is meant to recognize.
function pickMembershipSubscription(
  subs: Stripe.Subscription[],
  priceId: string | null,
): Stripe.Subscription | null {
  const active = subs.filter((s) => isActive(s.status));
  return active.find((s) => onMembershipPrice(s, priceId)) ?? active[0] ?? null;
}

// Finds an existing active/trialing subscription for an email on the same Stripe
// account. This is how we recognize members who were ALREADY paying (e.g.
// subscribed via GoHighLevel) without asking them to subscribe again.
export async function findActiveSubscriptionForEmail(
  email: string,
): Promise<Stripe.Subscription | null> {
  const stripe = getStripe();
  if (!stripe || !email.trim()) return null;
  const priceId = getMembershipPriceId();

  try {
    // Stripe's email filter is exact; pass the address as stored on the member.
    const customers = await stripe.customers.list({ email: email.trim(), limit: 100 });
    for (const customer of customers.data) {
      const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 100 });
      const match = pickMembershipSubscription(subs.data, priceId);
      if (match) return match;
    }
  } catch (err) {
    console.error('[stripe] findActiveSubscriptionForEmail failed:', err);
  }
  return null;
}

// Lazy, per-member reconciliation: if this member already has an active
// subscription in Stripe, link it to their record. Returns true if linked.
export async function reconcileMemberSubscription(member: {
  id: string;
  email: string | null;
}): Promise<boolean> {
  if (!member.email) return false;
  const sub = await findActiveSubscriptionForEmail(member.email);
  if (!sub) return false;
  const admin = createAdminClient();
  await applySubscriptionToMember(admin, member.id, sub);
  return true;
}

export interface BackfillResult {
  scanned: number;
  linked: number;
  unmatchedEmails: string[];
}

// One-time backfill: walk every active/trialing subscription on the account and
// link each to its member by email. Lets you flip the paywall on for everyone at
// once without anyone being wrongly gated. Safe to re-run.
//
// This scans ALL active subscriptions, not just those on STRIPE_PRICE_ID, so
// pre-existing subscribers on a legacy/GoHighLevel price are linked too — same
// reasoning as pickMembershipSubscription above. A member on multiple active
// subscriptions is linked to whichever the price preference selects.
export async function reconcileAllSubscriptions(): Promise<BackfillResult> {
  const stripe = getStripe();
  const priceId = getMembershipPriceId();
  const result: BackfillResult = { scanned: 0, linked: 0, unmatchedEmails: [] };
  if (!stripe) return result;

  const admin = createAdminClient();

  // Group each customer's active subscriptions so we apply the same price
  // preference the lazy reconcile uses, instead of whichever page ordering hands
  // us first.
  const subsByCustomer = new Map<string, Stripe.Subscription[]>();
  for (const status of ['active', 'trialing'] as const) {
    for await (const sub of stripe.subscriptions.list({ status, limit: 100 })) {
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
      const list = subsByCustomer.get(customerId);
      if (list) list.push(sub);
      else subsByCustomer.set(customerId, [sub]);
    }
  }

  for (const [customerId, subs] of subsByCustomer) {
    const sub = pickMembershipSubscription(subs, priceId);
    if (!sub) continue;
    result.scanned += 1;

    let email: string | null = null;
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (!customer.deleted) email = customer.email ?? null;
    } catch (err) {
      console.error('[stripe] reconcileAll: customer retrieve failed:', err);
    }
    if (!email) continue;

    const { data: member } = await admin.from('members').select('id').ilike('email', email).maybeSingle();
    if (!member) {
      result.unmatchedEmails.push(email);
      continue;
    }
    await applySubscriptionToMember(admin, member.id, sub);
    result.linked += 1;
  }

  return result;
}
