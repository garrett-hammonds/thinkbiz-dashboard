-- Rename the "President" member role to "Director".
--
-- The members.role check constraint allowed 'President' as a value; the product
-- now calls this role "Director" everywhere, so the allowed value list and all
-- existing rows are updated to match.
--
-- The to_regclass guard + idempotent statements mirror the other migrations so
-- this no-ops on Supabase preview branches that spin up without the baseline
-- schema, and is safe to replay.

DO $mig$
BEGIN
  IF to_regclass('public.members') IS NULL THEN
    RAISE NOTICE 'rename_president_role_to_director migration skipped: baseline schema not present';
    RETURN;
  END IF;

  ALTER TABLE members DROP CONSTRAINT IF EXISTS members_role_check;

  UPDATE members SET role = 'Director' WHERE role = 'President';

  ALTER TABLE members
    ADD CONSTRAINT members_role_check
    CHECK (role = ANY (ARRAY['Director'::text, 'Vice President'::text, 'Secretary'::text, 'Member'::text]));
END;
$mig$;
