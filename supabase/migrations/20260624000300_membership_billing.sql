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
-- The to_regclass guard mirrors the other migrations: Supabase preview branches
-- spin up an empty database with no baseline schema, so this must no-op there
-- instead of failing. The guard is required because `CREATE INDEX ... ON members`
-- errors when the members table is absent (CREATE INDEX IF NOT EXISTS only skips
-- when the index already exists, not when the table is missing). All statements
-- are idempotent, so this is also safe to replay where the columns/index exist.

DO $mig$
BEGIN
  IF to_regclass('public.members') IS NULL THEN
    RAISE NOTICE 'membership_billing migration skipped: baseline schema not present';
    RETURN;
  END IF;

  ALTER TABLE members
    ADD COLUMN IF NOT EXISTS stripe_customer_id text,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
    ADD COLUMN IF NOT EXISTS subscription_status text,
    ADD COLUMN IF NOT EXISTS subscription_current_period_end timestamptz;

  -- The webhook looks members up by Stripe customer id on every subscription
  -- event, so index it.
  CREATE INDEX IF NOT EXISTS members_stripe_customer_id_idx
    ON members (stripe_customer_id);
END;
$mig$;
