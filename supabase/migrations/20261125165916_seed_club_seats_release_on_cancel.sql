-- Every club gets its industry seats, and a canceled membership frees its seat.
--
-- Two gaps in the seat roster:
--
-- 1. Seats were only ever created by hand, for the clubs that existed when the
--    seat roster shipped. Clubs added later (and the demo club) had no rows in
--    club_seats, so the roster's seat picker offered nothing but "No seat" and
--    their directors couldn't seat anyone. Now a club gets one open seat per
--    active industry when it is created, and the clubs that were missed are
--    backfilled here.
--
-- 2. A canceled subscription hid the member's public profile (is_public) but
--    left them holding their seat as "filled", so the website's Member
--    Directory, which is built from seats, kept listing them. Now the seat is
--    reopened when the subscription becomes 'canceled'. Admins, directors and
--    billing-exempt members aren't billed, so their seats are left alone.
--
-- NOTE: applied to production on 2026-11-25 via the Supabase MCP and committed
-- here under the same version (20261125165916) so the repo's migration
-- directory matches the remote migration history.
--
-- The to_regclass guard mirrors the other migrations so this no-ops on Supabase
-- preview branches without the baseline schema, and is safe to replay.

DO $mig$
BEGIN
  IF to_regclass('public.clubs') IS NULL
     OR to_regclass('public.members') IS NULL
     OR to_regclass('public.industries') IS NULL
     OR to_regclass('public.club_seats') IS NULL THEN
    RAISE NOTICE 'seed_club_seats_release_on_cancel migration skipped: baseline schema not present';
    RETURN;
  END IF;

  -- 1. Seats for every club -------------------------------------------------

  -- Adds the open seats a club is missing: one per active industry. Seat order
  -- follows the clubs that already have seats, so every roster lists
  -- industries the same way.
  CREATE OR REPLACE FUNCTION public.seed_club_seats(p_club_id uuid)
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
  AS $fn$
    INSERT INTO club_seats (club_id, industry, industry_slug, status, sort_order)
    SELECT p_club_id,
           i.name,
           i.slug,
           'open',
           COALESCE(
             (SELECT min(s.sort_order) FROM club_seats s WHERE s.industry_slug = i.slug),
             i.sort_order,
             0
           )
    FROM industries i
    WHERE i.is_active
    ON CONFLICT DO NOTHING;
  $fn$;

  REVOKE ALL ON FUNCTION public.seed_club_seats(uuid) FROM PUBLIC, anon, authenticated;

  CREATE OR REPLACE FUNCTION public.seed_club_seats_on_insert()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $fn$
  BEGIN
    PERFORM seed_club_seats(NEW.id);
    RETURN NEW;
  END;
  $fn$;

  DROP TRIGGER IF EXISTS clubs_seed_seats ON clubs;
  CREATE TRIGGER clubs_seed_seats
    AFTER INSERT ON clubs
    FOR EACH ROW EXECUTE FUNCTION seed_club_seats_on_insert();

  -- Backfill the clubs that never got seats.
  PERFORM seed_club_seats(c.id)
  FROM clubs c
  WHERE NOT EXISTS (SELECT 1 FROM club_seats s WHERE s.club_id = c.id);

  -- 2. Canceled membership frees the seat -------------------------------------

  DROP TRIGGER IF EXISTS trg_members_reopen_seats_on_cancel ON members;
  CREATE TRIGGER trg_members_reopen_seats_on_cancel
    AFTER UPDATE OF subscription_status ON members
    FOR EACH ROW
    WHEN (NEW.subscription_status = 'canceled'
          AND OLD.subscription_status IS DISTINCT FROM NEW.subscription_status
          AND NEW.billing_exempt IS NOT TRUE
          AND NEW.club_director IS NOT TRUE
          AND NEW.is_admin IS NOT TRUE)
    EXECUTE FUNCTION reopen_seats_for_removed_member();

  -- Free the seats still held by members who already canceled.
  UPDATE club_seats s
     SET status = 'open',
         member_id = NULL
    FROM members m
   WHERE m.id = s.member_id
     AND m.subscription_status = 'canceled'
     AND m.billing_exempt IS NOT TRUE
     AND m.club_director IS NOT TRUE
     AND m.is_admin IS NOT TRUE;
END;
$mig$;
