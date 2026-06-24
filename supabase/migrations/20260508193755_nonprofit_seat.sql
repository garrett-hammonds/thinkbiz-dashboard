-- Nonprofit / one-seat-per-industry constraint (backfill)
--
-- BACKFILL — see 20260508185345_seat_roster.sql for why these reconstructed
-- files exist. Registered remotely as 20260508193755_nonprofit_seat.
--
-- Enforces a single seat per (club, industry) so each industry is represented
-- once per club.
--
-- Guarded + idempotent.

DO $mig$
BEGIN
  IF to_regclass('public.club_seats') IS NULL THEN
    RAISE NOTICE 'nonprofit_seat migration skipped: club_seats not present';
    RETURN;
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS club_seats_club_industry_unique
    ON club_seats (club_id, industry_slug);
END;
$mig$;
