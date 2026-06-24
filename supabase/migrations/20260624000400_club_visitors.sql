-- Club visitor list + at-meeting check-in
--
-- Adds a single `visitors` table that unifies two capture paths:
--   * at-meeting walk-ins via the public in-app check-in form
--     (app/visit/[clubId]) shown as a QR code on meeting slides
--     (source = 'meeting')
--   * the marketing-site preregistration form, which can later be
--     re-pointed at this table (source = 'preregistration')
--
-- Visitors are scoped to a club. Any active member of that club can read
-- their club's visitors so they can follow up before/after meetings;
-- directors/admins can delete (spam/duplicates). Inserts are open to anon
-- so the public check-in form can write without a login, mirroring the
-- existing anon insert into `pending_applications` (app/apply).
--
-- Apply via the Supabase SQL editor or `supabase db push`.
--
-- The to_regclass guard is intentional: Supabase preview branches spin up an
-- empty database with no baseline schema, so this migration must no-op there
-- instead of failing (same approach as 20260612_member_chat.sql).

DO $mig$
BEGIN
  IF to_regclass('public.members') IS NULL OR to_regclass('public.clubs') IS NULL THEN
    RAISE NOTICE 'club_visitors migration skipped: baseline schema not present';
    RETURN;
  END IF;

  ------------------------------------------------------------------
  -- Table
  ------------------------------------------------------------------

  CREATE TABLE IF NOT EXISTS visitors (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id      uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    first_name   text NOT NULL,
    last_name    text,
    email        text,
    phone        text,
    company_name text,
    title        text,
    notes        text,
    source       text NOT NULL DEFAULT 'meeting'
                   CHECK (source IN ('meeting', 'preregistration')),
    visited_on   date NOT NULL DEFAULT current_date,
    created_at   timestamptz NOT NULL DEFAULT now(),
    -- A visitor must be reachable by at least one channel, otherwise the
    -- whole point (members contacting them) breaks.
    CHECK (email IS NOT NULL OR phone IS NOT NULL)
  );

  CREATE INDEX IF NOT EXISTS visitors_club_visited_idx
    ON visitors (club_id, visited_on DESC, created_at DESC);

  ------------------------------------------------------------------
  -- Helper functions (SECURITY DEFINER so RLS policies can consult
  -- members without recursive policy evaluation; mirrors member_chat)
  ------------------------------------------------------------------

  CREATE OR REPLACE FUNCTION visitor_member_club()
  RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
    SELECT current_club_id FROM members WHERE auth_user_id = auth.uid() LIMIT 1;
  $fn$;

  CREATE OR REPLACE FUNCTION visitor_is_admin()
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
    SELECT COALESCE((SELECT is_admin FROM members WHERE auth_user_id = auth.uid() LIMIT 1), false);
  $fn$;

  -- Moderation: admins anywhere; club directors within their own club.
  CREATE OR REPLACE FUNCTION visitor_can_moderate(c uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
    SELECT visitor_is_admin() OR EXISTS (
      SELECT 1 FROM members me
      WHERE me.auth_user_id = auth.uid()
        AND me.club_director = true
        AND me.current_club_id = c
    );
  $fn$;

  GRANT EXECUTE ON FUNCTION
    visitor_member_club(), visitor_is_admin(), visitor_can_moderate(uuid)
  TO authenticated;

  ------------------------------------------------------------------
  -- Row Level Security
  ------------------------------------------------------------------

  ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;

  -- Members see their own club's visitors; admins see all.
  DROP POLICY IF EXISTS visitors_select ON visitors;
  CREATE POLICY visitors_select ON visitors FOR SELECT TO authenticated
    USING (club_id = visitor_member_club() OR visitor_is_admin());

  -- Public check-in form inserts without a login. The FK guarantees a real
  -- club_id; mirrors the existing anon insert into pending_applications.
  DROP POLICY IF EXISTS visitors_insert ON visitors;
  CREATE POLICY visitors_insert ON visitors FOR INSERT TO anon, authenticated
    WITH CHECK (true);

  -- Directors/admins can remove spam or duplicates from their own club.
  DROP POLICY IF EXISTS visitors_delete ON visitors;
  CREATE POLICY visitors_delete ON visitors FOR DELETE TO authenticated
    USING (visitor_can_moderate(club_id));

END;
$mig$;
