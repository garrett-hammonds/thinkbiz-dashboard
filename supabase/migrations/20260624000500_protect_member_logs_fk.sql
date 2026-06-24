-- Protect member success-tracking history from accidental cascade deletes
--
-- When a `members` row was hard-deleted, the `weekly_logs` and
-- `closed_business_thanks` foreign keys were ON DELETE CASCADE, so all of a
-- member's success-tracking history was silently destroyed along with the row.
-- This bit a member whose account was accidentally deleted and recreated: their
-- weekly logs were unrecoverable from the live database (only a backup restore
-- could bring them back).
--
-- This migration re-points those foreign keys so history can't be lost by an
-- accidental member deletion:
--   * weekly_logs.member_id                      -> ON DELETE RESTRICT
--   * closed_business_thanks.thanking_member_id  -> ON DELETE RESTRICT
--   * closed_business_thanks.thanked_member_id   -> ON DELETE SET NULL (nullable)
--
-- A member that still has logs/thanks can no longer be deleted until that
-- history is explicitly reassigned or removed first — deletion fails loudly
-- instead of quietly erasing the record.
--
-- Guarded + idempotent: re-running drops and recreates the constraints, and the
-- to_regclass guard no-ops on empty Supabase preview branches (same approach as
-- 20260624000400_club_visitors.sql).

DO $mig$
BEGIN
  IF to_regclass('public.weekly_logs') IS NULL
     OR to_regclass('public.closed_business_thanks') IS NULL
     OR to_regclass('public.members') IS NULL THEN
    RAISE NOTICE 'protect_member_logs_fk migration skipped: baseline schema not present';
    RETURN;
  END IF;

  -- weekly_logs.member_id -> RESTRICT (column is NOT NULL)
  ALTER TABLE public.weekly_logs
    DROP CONSTRAINT IF EXISTS weekly_logs_member_id_fkey;
  ALTER TABLE public.weekly_logs
    ADD CONSTRAINT weekly_logs_member_id_fkey
    FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE RESTRICT;

  -- closed_business_thanks.thanking_member_id -> RESTRICT (column is NOT NULL)
  ALTER TABLE public.closed_business_thanks
    DROP CONSTRAINT IF EXISTS closed_business_thanks_thanking_member_id_fkey;
  ALTER TABLE public.closed_business_thanks
    ADD CONSTRAINT closed_business_thanks_thanking_member_id_fkey
    FOREIGN KEY (thanking_member_id) REFERENCES public.members(id) ON DELETE RESTRICT;

  -- closed_business_thanks.thanked_member_id -> SET NULL (column is nullable;
  -- preserves the revenue record even if the thanked member is later removed)
  ALTER TABLE public.closed_business_thanks
    DROP CONSTRAINT IF EXISTS closed_business_thanks_thanked_member_id_fkey;
  ALTER TABLE public.closed_business_thanks
    ADD CONSTRAINT closed_business_thanks_thanked_member_id_fkey
    FOREIGN KEY (thanked_member_id) REFERENCES public.members(id) ON DELETE SET NULL;
END;
$mig$;
