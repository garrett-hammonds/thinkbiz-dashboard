-- Membership billing (Stripe)
--
-- Tracks each member's Stripe subscription so the app can gate access behind an
-- active membership and so directors can see who has / hasn't paid on the
-- roster. The Stripe webhook (/api/webhooks/stripe) and the checkout-success
-- handler write these columns; everything else only reads them.
--
-- `subscription_status` mirrors Stripe's subscription.status
-- ('active', 'trialing', 'past_due', 'canceled', 'incomplete', ...). A member is
-- treated as paid when it is 'active' or 'trialing'. NULL means "never started".
--
-- `IF EXISTS` / `IF NOT EXISTS` keep this idempotent and a no-op on empty
-- Supabase preview branches, matching the other migrations in this folder.

ALTER TABLE IF EXISTS members
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end timestamptz;

-- The webhook looks members up by Stripe customer id on every subscription
-- event, so index it.
CREATE INDEX IF NOT EXISTS members_stripe_customer_id_idx
  ON members (stripe_customer_id);
