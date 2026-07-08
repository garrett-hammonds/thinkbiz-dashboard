-- Per-member paywall exemption
--
-- Adds `members.billing_exempt`, a manual override that turns the membership
-- paywall OFF for a specific member without giving them a Stripe subscription.
-- Flip it to `true` from the Supabase dashboard (Table editor → members, or the
-- SQL editor) for anyone who should get in for free — comped members, staff,
-- special cases, etc. The membership gate treats an exempt member exactly like a
-- paid one (see utils/membership.ts).
--
-- Directors/presidents (`club_director`) and admins (`is_admin`) are ALREADY
-- exempt in code because they aren't billed monthly, so you do NOT need to set
-- this for them — it's only for regular members you want to wave through.
--
-- Security: this column is added to the privileged-column lock trigger from
-- 20260702000100 so a logged-in member can't PATCH their own row via PostgREST
-- to set billing_exempt = true and bypass the paywall themselves. Only trusted
-- roles (service_role, postgres/supabase_admin) can change it — which includes
-- editing it by hand in the Supabase dashboard.
--
-- The to_regclass guard + idempotent statements mirror the other migrations so
-- this no-ops on Supabase preview branches that spin up without the baseline
-- schema, and is safe to replay.

DO $mig$
BEGIN
  IF to_regclass('public.members') IS NULL THEN
    RAISE NOTICE 'member_billing_exempt migration skipped: baseline schema not present';
    RETURN;
  END IF;

  ALTER TABLE members
    ADD COLUMN IF NOT EXISTS billing_exempt boolean NOT NULL DEFAULT false;

  -- Re-create the privileged-column guard with billing_exempt added to the
  -- protected list. CREATE OR REPLACE keeps the existing trigger binding; we only
  -- swap the function body. Missing columns are skipped by the to_jsonb() diff, so
  -- this stays correct on environments that predate any given column.
  CREATE OR REPLACE FUNCTION public.enforce_members_privileged_columns()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $fn$
  DECLARE
    protected_cols text[] := ARRAY[
      'is_admin',
      'club_director',
      'is_active',
      'current_club_id',
      'club_id',
      'auth_user_id',
      'subscription_status',
      'subscription_current_period_end',
      'stripe_customer_id',
      'stripe_subscription_id',
      'billing_exempt'
    ];
    col text;
    old_json jsonb := to_jsonb(OLD);
    new_json jsonb := to_jsonb(NEW);
  BEGIN
    -- Only guard against client-role callers. Trusted server roles
    -- (service_role for the admin client, postgres/supabase_admin for
    -- migrations and dashboard edits) are allowed to set these columns.
    IF current_user NOT IN ('authenticated', 'anon') THEN
      RETURN NEW;
    END IF;

    FOREACH col IN ARRAY protected_cols LOOP
      -- Skip columns not present in this environment's schema.
      IF (old_json ? col) AND (new_json ? col)
         AND (old_json -> col) IS DISTINCT FROM (new_json -> col) THEN
        RAISE EXCEPTION
          'Updating members.% is not permitted for role %', col, current_user
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    END LOOP;

    RETURN NEW;
  END;
  $fn$;
END;
$mig$;
