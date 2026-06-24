'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { getStripe, getMembershipPriceId } from '@/lib/stripe/client';

export interface CheckoutResult {
  url?: string;
  error?: string;
}

// Starts a Stripe Checkout subscription for the signed-in member and returns the
// hosted Checkout URL for the client to redirect to. We reuse the member's
// Stripe customer across attempts (creating one the first time) so a member who
// bails and retries doesn't pile up duplicate customers.
export async function createCheckoutSession(): Promise<CheckoutResult> {
  const stripe = getStripe();
  const priceId = getMembershipPriceId();
  if (!stripe || !priceId) {
    return { error: 'Membership billing is not configured yet. Please contact ThinkBiz Support.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'You must be signed in.' };
  }

  const member = await getMemberForUser(supabase, user);
  if (!member) {
    return { error: 'We could not find your membership profile. Contact ThinkBiz Support.' };
  }

  const admin = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  try {
    // Reuse or create the Stripe customer for this member.
    let customerId: string | null = member.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: member.email ?? user.email ?? undefined,
        name: `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim() || undefined,
        metadata: { member_id: member.id, auth_user_id: user.id },
      });
      customerId = customer.id;
      await admin.from('members').update({ stripe_customer_id: customerId }).eq('id', member.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      // The success route confirms the session and updates the member
      // immediately so the access gate doesn't bounce them while the webhook is
      // still in flight. The webhook remains the source of truth afterward.
      success_url: `${siteUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/billing?status=canceled`,
      // Stamp the member id everywhere the webhook might read it.
      client_reference_id: member.id,
      metadata: { member_id: member.id },
      subscription_data: { metadata: { member_id: member.id } },
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return { error: 'Could not start checkout. Please try again.' };
    }
    return { url: session.url };
  } catch (err) {
    console.error('[billing] createCheckoutSession failed:', err);
    return { error: 'Could not start checkout. Please try again.' };
  }
}

// Opens the Stripe billing portal so an already-subscribed member can update
// their card, view invoices, or cancel.
export async function createBillingPortalSession(): Promise<CheckoutResult> {
  const stripe = getStripe();
  if (!stripe) {
    return { error: 'Membership billing is not configured yet.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'You must be signed in.' };
  }

  const member = await getMemberForUser(supabase, user);
  if (!member?.stripe_customer_id) {
    return { error: 'No billing account found for your membership yet.' };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: member.stripe_customer_id,
      return_url: `${siteUrl}/profile`,
    });
    return { url: session.url };
  } catch (err) {
    console.error('[billing] createBillingPortalSession failed:', err);
    return { error: 'Could not open the billing portal. Please try again.' };
  }
}
