-- Reopen seats when a member is deactivated (backfill)
--
-- BACKFILL — see 20260508185345_seat_roster.sql for why these reconstructed
-- files exist. Registered remotely as 20260513225212_reopen_seat_on_inactive.
--
-- When a member is marked inactive, free any seats they hold so the seat
-- returns to the open pool. The trigger function is shared with the
-- member-removed trigger (see 20260513225556_reopen_seat_on_member_removed).
--
-- Guarded + idempotent.

DO $mig$
BEGIN
  IF to_regclass('public.club_seats') IS NULL
     OR to_regclass('public.members') IS NULL THEN
    RAISE NOTICE 'reopen_seat_on_inactive migration skipped: baseline schema not present';
    RETURN;
  END IF;

  CREATE OR REPLACE FUNCTION reopen_seats_for_removed_member()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
  DECLARE
    v_member_id uuid := COALESCE(NEW.id, OLD.id);
  BEGIN
    UPDATE public.club_seats
       SET status = 'open',
           member_id = NULL
     WHERE member_id = v_member_id;
    RETURN COALESCE(NEW, OLD);
  END;
  $fn$;

  DROP TRIGGER IF EXISTS trg_members_reopen_seats_on_inactive ON members;
  CREATE TRIGGER trg_members_reopen_seats_on_inactive
    AFTER UPDATE OF is_active ON members
    FOR EACH ROW
    WHEN (NEW.is_active = false AND OLD.is_active IS DISTINCT FROM NEW.is_active)
    EXECUTE FUNCTION reopen_seats_for_removed_member();
END;
$mig$;
