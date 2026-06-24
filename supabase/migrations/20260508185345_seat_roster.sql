-- Seat roster (backfill)
--
-- BACKFILL of a migration that was originally applied to the production
-- database directly (recorded in the Supabase migration registry as
-- 20260508185345_seat_roster) but never committed as a file. Reconstructed
-- from the live schema so the local migrations directory matches the remote
-- registry — without this, the Supabase branching action aborts with
-- "Remote migration versions not found in local migrations directory" before
-- any migration runs.
--
-- Creates `club_seats`: one row per industry seat in a club, either open or
-- filled by a member.
--
-- Guarded + idempotent: the to_regclass check no-ops on a database without the
-- baseline schema (empty preview branch), and CREATE ... IF NOT EXISTS makes it
-- safe to replay against a database where the objects already exist.

DO $mig$
BEGIN
  IF to_regclass('public.clubs') IS NULL
     OR to_regclass('public.members') IS NULL
     OR to_regclass('public.industries') IS NULL THEN
    RAISE NOTICE 'seat_roster migration skipped: baseline schema not present';
    RETURN;
  END IF;

  CREATE TABLE IF NOT EXISTS club_seats (
    id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id       uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    industry      text NOT NULL,
    industry_slug text NOT NULL REFERENCES industries(slug),
    status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'filled')),
    member_id     uuid REFERENCES members(id) ON DELETE SET NULL,
    sort_order    integer DEFAULT 0,
    created_at    timestamptz DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS club_seats_club_id_idx ON club_seats (club_id);
  CREATE INDEX IF NOT EXISTS club_seats_member_id_idx ON club_seats (member_id);
END;
$mig$;
