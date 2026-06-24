-- Shared seats (backfill)
--
-- BACKFILL — see 20260508185345_seat_roster.sql for why these reconstructed
-- files exist. Registered remotely as 20260508195109_shared_seats.
--
-- Adds `club_seat_members` so a single seat can be shared by more than one
-- member, and relaxes the per-industry uniqueness for the catch-all 'other'
-- industry so a club can hold several 'other' seats.
--
-- Guarded + idempotent.

DO $mig$
BEGIN
  IF to_regclass('public.club_seats') IS NULL
     OR to_regclass('public.members') IS NULL THEN
    RAISE NOTICE 'shared_seats migration skipped: baseline schema not present';
    RETURN;
  END IF;

  CREATE TABLE IF NOT EXISTS club_seat_members (
    club_seat_id uuid NOT NULL REFERENCES club_seats(id) ON DELETE CASCADE,
    member_id    uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    created_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (club_seat_id, member_id)
  );

  -- Allow multiple 'other' seats per club while keeping named industries unique.
  CREATE UNIQUE INDEX IF NOT EXISTS club_seats_club_id_industry_slug_key
    ON club_seats (club_id, industry_slug)
    WHERE (industry_slug <> 'other');
END;
$mig$;
