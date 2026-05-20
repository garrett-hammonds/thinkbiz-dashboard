-- Director claim flow + onboarding gate
--
-- Adds profile_completed_at to gate the dashboard behind a one-time
-- onboarding form, and removes the legacy `phone` column that the old
-- director invite code referenced. New writes use `phone_number`.
--
-- Apply via Supabase SQL editor or `supabase db push` if using the CLI.
--
-- `IF EXISTS` on the table is intentional: Supabase preview branches
-- spin up an empty database that has no baseline schema, so this
-- migration must no-op there instead of failing. It still runs
-- normally against the real production database where `members`
-- already exists.

ALTER TABLE IF EXISTS members
  ADD COLUMN IF NOT EXISTS profile_completed_at timestamptz;

ALTER TABLE IF EXISTS members
  DROP COLUMN IF EXISTS phone;
