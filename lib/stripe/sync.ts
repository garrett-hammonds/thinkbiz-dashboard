import 'server-only';
import type Stripe from 'stripe';
import { createAdminClient } from '@/utils/supabase/admin';

// Writes a Stripe subscription's current state onto the member row. This is the
// one place that translates Stripe → our `members` billing columns, shared by
// the webhook (lifecycle events) and the checkout-success route (immediate
// confirmation so the access gate doesn't bounce a member who just paid).
//
// The member is resolved by the subscription's metadata.member_id when present
// (we stamp it at checkout), falling back to stripe_customer_id.
export async function syncSubscriptionToMember(subscription: Stripe.Subscription): Promise<void> {
  const admin = createAdminClient();

  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const memberId = subscription.metadata?.member_id;

  // Read via an unknown-cast so a future Stripe SDK/API bump that relocates this
  // field can't break the typecheck — we just store null if it's absent.
  const periodEndUnix = (subscription as unknown as { current_period_end?: number }).current_period_end;
  const periodEnd = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null;

  const update = {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    subscription_status: subscription.status,
    subscription_current_period_end: periodEnd,
  };

  const query = memberId
    ? admin.from('members').update(update).eq('id', memberId)
    : admin.from('members').update(update).eq('stripe_customer_id', customerId);

  const { error } = await query;
  if (error) {
    console.error('[stripe] syncSubscriptionToMember failed:', error);
  }
}
