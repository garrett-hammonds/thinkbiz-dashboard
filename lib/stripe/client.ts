import 'server-only';
import Stripe from 'stripe';

// Lazily construct the Stripe client so a missing key during build (or in
// environments where billing isn't configured yet) doesn't crash the app.
// Billing is feature-flagged on the presence of both env vars — see
// isBillingEnabled() — so the whole flow stays dormant until you set them.
let cached: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!cached) {
    // Pin the API version the installed SDK was built against so Stripe-side
    // upgrades can't change behavior under us. Bump deliberately alongside the
    // `stripe` package when you adopt new features.
    cached = new Stripe(key, { apiVersion: '2025-02-24.acacia' });
  }
  return cached;
}

// The single recurring price every member subscribes to (one price for everyone).
export function getMembershipPriceId(): string | null {
  return process.env.STRIPE_PRICE_ID || null;
}

// Billing only switches on once BOTH the secret key and the membership price are
// configured. Until then, isBillingEnabled() is false and the access gate is a
// no-op, so the app behaves exactly as it did before Stripe was added.
export function isBillingEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_PRICE_ID;
}
