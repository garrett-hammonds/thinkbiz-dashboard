import 'server-only';
import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/utils/supabase/admin';
import { getStripe } from '@/lib/stripe/client';

interface SubscriptionUpdate {
  stripe_customer_id: string;
  stripe_subscription_id: string;
  subscription_status: string;
  subscription_current_period_end: string | null;
}

function customerIdOf(subscription: Stripe.Subscription): string {
  return typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
}

function buildUpdate(subscription: Stripe.Subscription): SubscriptionUpdate {
  // Read via an unknown-cast so a future Stripe SDK/API bump that relocates this
  // field can't break the typecheck — we just store null if it's absent.
  const periodEndUnix = (subscription as unknown as { current_period_end?: number }).current_period_end;
  return {
    stripe_customer_id: customerIdOf(subscription),
    stripe_subscription_id: subscription.id,
    subscription_status: subscription.status,
    subscription_current_period_end: periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null,
  };
}

// Writes a subscription's state onto a specific, already-resolved member row.
// Used by the reconciliation paths, which know the member id up front.
export async function applySubscriptionToMember(
  admin: SupabaseClient,
  memberId: string,
  subscription: Stripe.Subscription,
): Promise<void> {
  const { error } = await admin.from('members').update(buildUpdate(subscription)).eq('id', memberId);
  if (error) console.error('[stripe] applySubscriptionToMember failed:', error);
}

// Writes a Stripe subscription's state onto the matching member row. This is the
// one place that translates Stripe → our `members` billing columns for the
// webhook. It resolves the member three ways, in order:
//   1. subscription.metadata.member_id  (stamped at checkout)
//   2. members.stripe_customer_id        (set on a previous sync)
//   3. the Stripe customer's email ↔ members.email
// (3) is what lets pre-existing subscribers (e.g. created via GoHighLevel, with
// no member_id metadata and no stored customer id) be recognized automatically.
export async function syncSubscriptionToMember(subscription: Stripe.Subscription): Promise<void> {
  const admin = createAdminClient();
  const customerId = customerIdOf(subscription);

  // 1. metadata
  let memberId = subscription.metadata?.member_id || null;

  // 2. stored customer id
  if (!memberId) {
    const { data } = await admin
      .from('members')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    memberId = data?.id ?? null;
  }

  // 3. customer email → member email
  if (!memberId) {
    const email = await customerEmail(customerId);
    if (email) {
      const { data } = await admin.from('members').select('id').ilike('email', email).maybeSingle();
      memberId = data?.id ?? null;
    }
  }

  if (!memberId) {
    console.warn(`[stripe] syncSubscriptionToMember: no member matched for customer ${customerId}`);
    return;
  }

  await applySubscriptionToMember(admin, memberId, subscription);
}

async function customerEmail(customerId: string): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return null;
    return customer.email ?? null;
  } catch (err) {
    console.error('[stripe] customerEmail lookup failed:', err);
    return null;
  }
}
