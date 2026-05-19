-- Director claim flow + onboarding gate
--
-- Adds profile_completed_at to gate the dashboard behind a one-time
-- onboarding form, and removes the legacy `phone` column that the old
-- director invite code referenced. New writes use `phone_number`.
--
-- Apply via Supabase SQL editor or `supabase db push` if using the CLI.

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS profile_completed_at timestamptz;

ALTER TABLE members
  DROP COLUMN IF EXISTS phone;
