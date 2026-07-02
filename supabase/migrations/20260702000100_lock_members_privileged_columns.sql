-- Lock privileged `members` columns against self-service escalation
--
-- The app updates a member's own row through the RLS-enforced, anon-key user
-- client (see app/actions/profile.ts and app/actions/completeOnboarding.ts),
-- scoped `.eq('auth_user_id', auth.uid())`. Browser-side Supabase clients are
-- also used elsewhere. Postgres RLS is ROW-level, not COLUMN-level: if the
-- members UPDATE policy is the expected `USING (auth_user_id = auth.uid())`
-- with no column restriction, a logged-in member can call the public REST
-- endpoint directly and flip a privileged column on their own row, e.g.
--
--   PATCH /rest/v1/members?auth_user_id=eq.<self>   body: {"is_admin": true}
--
-- Because all authorization reads members.is_admin / club_director and the
-- billing gate reads subscription_status, that would be full admin takeover +
-- paywall bypass.
--
-- This trigger closes that hole independently of however the RLS policy is
-- written. On any UPDATE issued by a PostgREST *client* role (`authenticated`
-- or `anon` — the roles PostgREST switches into for user/anon requests), it
-- rejects the statement if any protected column value changed. Trusted server
-- paths are unaffected: the service-role client (the Stripe webhook, admin
-- actions, getMemberForUser auto-link, cron) connects as `service_role`, and
-- migrations/dashboard run as `postgres`/`supabase_admin` — none of which are
-- `authenticated`/`anon`, so the guard is skipped for them.
--
-- The legitimate authenticated writes (updateProfile, completeOnboarding) only
-- touch profile columns, so this trigger never fires for them.
--
-- Implemented with a to_jsonb() diff over a protected-key list so it stays
-- correct even if some columns are absent on a given environment (missing keys
-- are simply skipped) — no hard column references that could break on preview
-- branches. Idempotent + guarded to no-op where the baseline schema is absent.

DO $mig$
BEGIN
  IF to_regclass('public.members') IS NULL THEN
    RAISE NOTICE 'lock_members_privileged_columns skipped: baseline schema not present';
    RETURN;
  END IF;

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
      'stripe_subscription_id'
    ];
    col text;
    old_json jsonb := to_jsonb(OLD);
    new_json jsonb := to_jsonb(NEW);
  BEGIN
    -- Only guard against client-role callers. Trusted server roles
    -- (service_role for the admin client, postgres/supabase_admin for
    -- migrations) are allowed to set these columns.
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

  DROP TRIGGER IF EXISTS members_lock_privileged_columns ON public.members;
  CREATE TRIGGER members_lock_privileged_columns
    BEFORE UPDATE ON public.members
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_members_privileged_columns();
END;
$mig$;
