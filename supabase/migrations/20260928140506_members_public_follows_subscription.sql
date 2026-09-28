-- Website visibility follows the membership subscription.
--
-- The marketing website shows a member only when members.is_public (and
-- is_active) is true. Nothing kept is_public in step with billing: new members
-- default to hidden (is_public DEFAULT false) and the dashboard has no control
-- to publish them, while members who canceled stayed public. Rule:
--   * subscription_status becomes 'active'   -> is_public = true
--   * subscription_status becomes 'canceled' -> is_public = false
-- Other statuses (NULL, past_due, ...) and billing-exempt members are left as
-- they are. The trigger fires only when the status actually changes, so a
-- manual is_public edit sticks until the next billing status change.
--
-- NOTE: applied to production on 2026-09-28 via the Supabase MCP and committed
-- here under the same version (20260928140506) so the repo's migration directory
-- matches the remote migration history.
--
-- The to_regclass guard mirrors the other migrations so this no-ops on Supabase
-- preview branches that spin up without the baseline schema, and is safe to replay.

DO $mig$
BEGIN
  IF to_regclass('public.members') IS NULL THEN
    RAISE NOTICE 'members_public_follows_subscription migration skipped: baseline schema not present';
    RETURN;
  END IF;

  CREATE OR REPLACE FUNCTION public.sync_member_public_from_subscription()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
  AS $fn$
  BEGIN
    IF TG_OP = 'UPDATE'
       AND NEW.subscription_status IS NOT DISTINCT FROM OLD.subscription_status THEN
      RETURN NEW;
    END IF;
    IF NEW.subscription_status = 'active' THEN
      NEW.is_public := true;
    ELSIF NEW.subscription_status = 'canceled' THEN
      NEW.is_public := false;
    END IF;
    RETURN NEW;
  END;
  $fn$;

  DROP TRIGGER IF EXISTS members_public_follows_subscription ON public.members;
  CREATE TRIGGER members_public_follows_subscription
    BEFORE INSERT OR UPDATE OF subscription_status ON public.members
    FOR EACH ROW EXECUTE FUNCTION public.sync_member_public_from_subscription();

  -- Bring existing rows in line with the rule.
  UPDATE public.members
     SET is_public = (subscription_status = 'active')
   WHERE subscription_status IN ('active', 'canceled')
     AND is_public IS DISTINCT FROM (subscription_status = 'active');
END;
$mig$;
