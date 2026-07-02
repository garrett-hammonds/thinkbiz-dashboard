-- Club meeting attendance via member check-in QR codes
--
-- Two pieces:
--   * `clubs.meeting_day` — the weekday (0=Sunday..6=Saturday) the club
--     meets. Attendance is keyed to that day's date each week, so scans
--     on a moved meeting still land in the right weekly slot (the app
--     maps any scan to the nearest occurrence of the meeting day).
--   * `attendance` — one row per member per weekly meeting slot. Rows are
--     written either by the director's in-app QR scanner (source='scan')
--     or by the manual roster checklist / backfill (source='manual').
--
-- Attendance is a director-facing surface: only that club's directors and
-- global admins can read or write it. Regular members never query this
-- table directly — their check-in happens by showing their personal QR
-- code, which the director scans; the insert runs under the director's
-- session (or the service role after code-side gating, mirroring the
-- roster).
--
-- Apply via the Supabase SQL editor or `supabase db push`.
--
-- The to_regclass guard is intentional: Supabase preview branches spin up an
-- empty database with no baseline schema, so this migration must no-op there
-- instead of failing (same approach as 20260624000400_club_visitors.sql).

DO $mig$
BEGIN
  IF to_regclass('public.members') IS NULL OR to_regclass('public.clubs') IS NULL THEN
    RAISE NOTICE 'club_attendance migration skipped: baseline schema not present';
    RETURN;
  END IF;

  ------------------------------------------------------------------
  -- Club meeting day
  ------------------------------------------------------------------

  ALTER TABLE clubs
    ADD COLUMN IF NOT EXISTS meeting_day smallint
      CHECK (meeting_day BETWEEN 0 AND 6);

  COMMENT ON COLUMN clubs.meeting_day IS
    'Weekday the club meets: 0=Sunday .. 6=Saturday (JS Date#getDay convention). NULL until a director sets it.';

  ------------------------------------------------------------------
  -- Table
  ------------------------------------------------------------------

  CREATE TABLE IF NOT EXISTS attendance (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id      uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    member_id    uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    -- The date of the weekly meeting slot this check-in counts toward
    -- (an occurrence of the club's meeting_day), not necessarily the
    -- date the scan happened.
    meeting_date date NOT NULL,
    source       text NOT NULL DEFAULT 'scan'
                   CHECK (source IN ('scan', 'manual')),
    -- The director/admin whose scanner or checklist recorded the row.
    recorded_by  uuid REFERENCES members(id) ON DELETE SET NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    -- One check-in per member per meeting; re-scans upsert into this.
    UNIQUE (club_id, member_id, meeting_date)
  );

  CREATE INDEX IF NOT EXISTS attendance_club_date_idx
    ON attendance (club_id, meeting_date DESC);

  ------------------------------------------------------------------
  -- Helper function (SECURITY DEFINER so RLS policies can consult
  -- members without recursive policy evaluation; mirrors visitors)
  ------------------------------------------------------------------

  -- Admins anywhere; club directors within their own club.
  CREATE OR REPLACE FUNCTION attendance_can_manage(c uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
    SELECT EXISTS (
      SELECT 1 FROM members me
      WHERE me.auth_user_id = auth.uid()
        AND (me.is_admin = true
             OR (me.club_director = true AND me.current_club_id = c))
    );
  $fn$;

  GRANT EXECUTE ON FUNCTION attendance_can_manage(uuid) TO authenticated;

  ------------------------------------------------------------------
  -- Row Level Security
  ------------------------------------------------------------------

  ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

  -- Attendance is director/admin-only in both directions: reads power the
  -- dashboard stats and the roster checklist, writes come from the scanner
  -- and the checklist toggles.
  DROP POLICY IF EXISTS attendance_select ON attendance;
  CREATE POLICY attendance_select ON attendance FOR SELECT TO authenticated
    USING (attendance_can_manage(club_id));

  DROP POLICY IF EXISTS attendance_insert ON attendance;
  CREATE POLICY attendance_insert ON attendance FOR INSERT TO authenticated
    WITH CHECK (attendance_can_manage(club_id));

  DROP POLICY IF EXISTS attendance_delete ON attendance;
  CREATE POLICY attendance_delete ON attendance FOR DELETE TO authenticated
    USING (attendance_can_manage(club_id));

END;
$mig$;
