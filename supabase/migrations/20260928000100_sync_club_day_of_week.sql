-- Keep clubs.day_of_week in sync with clubs.meeting_day.
--
-- Directors set their club's meeting weekday in the dashboard, which writes the
-- numeric `meeting_day` (0=Sunday .. 6=Saturday, see 20260702000300_club_attendance).
-- The public marketing website (thinkbiz-marketing-website-v2) still renders the
-- older text column `day_of_week` ("Tuesday"), which nothing updated anymore — so
-- a meeting-day change in the dashboard never reached the website.
--
-- This trigger derives `day_of_week` from `meeting_day` on every write, and the
-- backfill brings existing rows that had already drifted back in line. When
-- `meeting_day` is NULL (not yet set by a director) the existing text is left alone.
--
-- The to_regclass guard mirrors the other migrations so this no-ops on Supabase
-- preview branches that spin up without the baseline schema, and is safe to replay.

DO $mig$
BEGIN
  IF to_regclass('public.clubs') IS NULL THEN
    RAISE NOTICE 'sync_club_day_of_week migration skipped: baseline schema not present';
    RETURN;
  END IF;

  CREATE OR REPLACE FUNCTION public.sync_club_day_of_week()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
  AS $fn$
  BEGIN
    IF NEW.meeting_day IS NOT NULL THEN
      NEW.day_of_week := (ARRAY['Sunday', 'Monday', 'Tuesday', 'Wednesday',
                                'Thursday', 'Friday', 'Saturday'])[NEW.meeting_day + 1];
    END IF;
    RETURN NEW;
  END;
  $fn$;

  DROP TRIGGER IF EXISTS clubs_sync_day_of_week ON public.clubs;
  CREATE TRIGGER clubs_sync_day_of_week
    BEFORE INSERT OR UPDATE OF meeting_day ON public.clubs
    FOR EACH ROW EXECUTE FUNCTION public.sync_club_day_of_week();

  -- Backfill rows that drifted. The UPDATE touches meeting_day so the trigger
  -- does the mapping in one place.
  UPDATE public.clubs
     SET meeting_day = meeting_day
   WHERE meeting_day IS NOT NULL
     AND day_of_week IS DISTINCT FROM (ARRAY['Sunday', 'Monday', 'Tuesday', 'Wednesday',
                                             'Thursday', 'Friday', 'Saturday'])[meeting_day + 1];
END;
$mig$;
