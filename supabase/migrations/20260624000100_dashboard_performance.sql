-- Dashboard / cron query performance indexes
--
-- These back the heaviest read paths in the app, all of which currently filter
-- or join on columns that have no guaranteed supporting index (the weekly_logs
-- and closed_business_thanks tables predate the migration history, so only
-- whatever the baseline schema defined exists):
--
--   * Dashboard club view  — weekly_logs WHERE club_id = ?        (every load)
--   * Dashboard club view  — closed_business_thanks JOIN weekly_logs
--                            ON weekly_log_id, filtered by club_id (every load)
--   * Dashboard personal   — closed_business_thanks WHERE thanking_member_id = ?
--   * Weekly cron reminder — weekly_logs WHERE week_ending >= cutoff (full scan
--                            of the whole table once a week without this index)
--
-- weekly_logs(member_id) is intentionally omitted: the app relies on a unique
-- (member_id, week_ending) constraint (the "one log per week" guard in
-- submitLogAction), whose backing index already serves member_id-leading
-- lookups. Adding a standalone member_id index would just be redundant write
-- overhead. Add it here if that constraint turns out not to exist.
--
-- All indexes are additive and idempotent (IF NOT EXISTS). The to_regclass
-- guard mirrors the other migrations so this no-ops on empty Supabase preview
-- branches instead of failing.
--
-- Apply via Supabase SQL editor or `supabase db push`.

DO $mig$
BEGIN
  IF to_regclass('public.weekly_logs') IS NOT NULL THEN
    -- Club dashboard: all logs for a club.
    CREATE INDEX IF NOT EXISTS weekly_logs_club_id_idx
      ON weekly_logs (club_id);

    -- Weekly cron reminder: members with a log in the trailing 7-day window.
    CREATE INDEX IF NOT EXISTS weekly_logs_week_ending_idx
      ON weekly_logs (week_ending);
  END IF;

  IF to_regclass('public.closed_business_thanks') IS NOT NULL THEN
    -- Personal dashboard: a member's own closed-business revenue.
    CREATE INDEX IF NOT EXISTS cbt_thanking_member_idx
      ON closed_business_thanks (thanking_member_id);

    -- Club dashboard: join from closed_business_thanks back to weekly_logs.
    CREATE INDEX IF NOT EXISTS cbt_weekly_log_idx
      ON closed_business_thanks (weekly_log_id);
  END IF;
END;
$mig$;
