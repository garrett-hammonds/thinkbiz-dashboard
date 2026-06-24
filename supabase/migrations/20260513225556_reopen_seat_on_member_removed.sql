-- Reopen seats when a member is deleted (backfill)
--
-- BACKFILL — see 20260508185345_seat_roster.sql for why these reconstructed
-- files exist. Registered remotely as 20260513225556_reopen_seat_on_member_removed.
--
-- Frees a member's seats on hard delete, reusing reopen_seats_for_removed_member()
-- from 20260513225212_reopen_seat_on_inactive.
--
-- Guarded + idempotent.

DO $mig$
BEGIN
  IF to_regclass('public.club_seats') IS NULL
     OR to_regclass('public.members') IS NULL THEN
    RAISE NOTICE 'reopen_seat_on_member_removed migration skipped: baseline schema not present';
    RETURN;
  END IF;

  DROP TRIGGER IF EXISTS trg_members_reopen_seats_on_delete ON members;
  CREATE TRIGGER trg_members_reopen_seats_on_delete
    BEFORE DELETE ON members
    FOR EACH ROW
    EXECUTE FUNCTION reopen_seats_for_removed_member();
END;
$mig$;
