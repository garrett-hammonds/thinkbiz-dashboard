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

// Finds an existing active/trialing membership subscription for an email on the
// same Stripe account. This is how we recognize members who were ALREADY paying
// (e.g. subscribed via GoHighLevel) without asking them to subscribe again.
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
      const match = subs.data.find((s) => isActive(s.status) && onMembershipPrice(s, priceId));
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

// One-time backfill: walk every active membership subscription on the account
// and link each to its member by email. Lets you flip the paywall on for
// everyone at once without anyone being wrongly gated. Safe to re-run.
export async function reconcileAllSubscriptions(): Promise<BackfillResult> {
  const stripe = getStripe();
  const priceId = getMembershipPriceId();
  const result: BackfillResult = { scanned: 0, linked: 0, unmatchedEmails: [] };
  if (!stripe || !priceId) return result;

  const admin = createAdminClient();

  for await (const sub of stripe.subscriptions.list({ price: priceId, status: 'active', limit: 100 })) {
    result.scanned += 1;
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

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
