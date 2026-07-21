-- Member directory: starred profiles + direct messages
--
-- Two additions backing the in-app membership directory:
--   * member_stars   — per-member bookmarks ("star" a profile, filter by starred)
--   * DM channels    — chat_channels grows is_dm/dm_key so a 1:1 conversation is
--                      just a channel whose only two members are the pair.
--                      dm_key = 'least_uuid:greatest_uuid' makes the pair unique.
--
-- DM privacy rules (tightened over the open-channel rules from
-- 20260612_member_chat.sql):
--   * Only the two participants can see a DM channel or its messages — admins
--     included: a DM is a personal conversation, not a moderated space.
--   * Nobody can browse or self-join a DM (creation goes through a service-role
--     server action that inserts both membership rows), and nobody can leave or
--     delete one, so read-state rows stay put.
--   * Participants keep INSERT rights on their own chat_channel_members row so
--     the client's last_read_at upsert continues to work.
--
-- The to_regclass guard mirrors the other migrations: Supabase preview branches
-- spin up without the baseline schema, so this must no-op there.

DO $mig$
BEGIN
  IF to_regclass('public.members') IS NULL OR to_regclass('public.chat_channels') IS NULL THEN
    RAISE NOTICE 'member_directory_dms migration skipped: baseline schema not present';
    RETURN;
  END IF;

  ------------------------------------------------------------------
  -- Starred profiles
  ------------------------------------------------------------------

  CREATE TABLE IF NOT EXISTS member_stars (
    member_id         uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    starred_member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    created_at        timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (member_id, starred_member_id),
    CHECK (member_id <> starred_member_id)
  );

  ALTER TABLE member_stars ENABLE ROW LEVEL SECURITY;

  -- Own rows only, in every direction. Stars are private bookmarks: nobody can
  -- see who starred them.
  DROP POLICY IF EXISTS member_stars_select ON member_stars;
  CREATE POLICY member_stars_select ON member_stars FOR SELECT TO authenticated
    USING (member_id = chat_member_id());

  DROP POLICY IF EXISTS member_stars_insert ON member_stars;
  CREATE POLICY member_stars_insert ON member_stars FOR INSERT TO authenticated
    WITH CHECK (member_id = chat_member_id());

  DROP POLICY IF EXISTS member_stars_delete ON member_stars;
  CREATE POLICY member_stars_delete ON member_stars FOR DELETE TO authenticated
    USING (member_id = chat_member_id());

  GRANT SELECT, INSERT, DELETE ON member_stars TO authenticated;

  ------------------------------------------------------------------
  -- DM channels
  ------------------------------------------------------------------

  ALTER TABLE chat_channels ADD COLUMN IF NOT EXISTS is_dm boolean NOT NULL DEFAULT false;
  ALTER TABLE chat_channels ADD COLUMN IF NOT EXISTS dm_key text;

  CREATE UNIQUE INDEX IF NOT EXISTS chat_channels_dm_key_idx
    ON chat_channels (dm_key) WHERE dm_key IS NOT NULL;

  -- Participant check for DM policies (SECURITY DEFINER, like the other chat
  -- helpers, so policies can consult chat_channel_members without recursion).
  CREATE OR REPLACE FUNCTION chat_is_dm_participant(ch uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
    SELECT EXISTS (
      SELECT 1 FROM chat_channel_members m
      WHERE m.channel_id = ch AND m.member_id = chat_member_id()
    );
  $fn$;

  GRANT EXECUTE ON FUNCTION chat_is_dm_participant(uuid) TO authenticated;

  -- Joinable = open channels (self-join) or your club channel (read-state row).
  -- DM participants also pass so the client's last_read_at upsert keeps working;
  -- non-participants can never insert themselves into a DM.
  CREATE OR REPLACE FUNCTION chat_can_join(ch uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
    SELECT EXISTS (
      SELECT 1 FROM chat_channels c
      WHERE c.id = ch
        AND (
          (c.is_dm AND chat_is_dm_participant(ch))
          OR (NOT c.is_dm AND (c.club_id IS NULL OR c.club_id = chat_member_club()))
        )
    );
  $fn$;

  -- Same access rules as before for club/open channels, but DMs are
  -- participants-only — the admin override deliberately does not apply.
  CREATE OR REPLACE FUNCTION chat_can_access_channel(ch uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
    SELECT EXISTS (
      SELECT 1 FROM chat_channels c
      WHERE c.id = ch
        AND (
          (c.is_dm AND chat_is_dm_participant(ch))
          OR (NOT c.is_dm AND (
            chat_is_admin()
            OR (c.club_id IS NOT NULL AND c.club_id = chat_member_club())
            OR (c.club_id IS NULL AND chat_is_dm_participant(ch))
          ))
        )
    );
  $fn$;

  -- Moderation never applies inside a DM (each author can still delete their
  -- own messages via the chat_messages_delete policy's author arm).
  CREATE OR REPLACE FUNCTION chat_can_moderate(ch uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
    SELECT EXISTS (
      SELECT 1
      FROM chat_channels c
      WHERE c.id = ch
        AND NOT c.is_dm
        AND (
          chat_is_admin()
          OR EXISTS (
            SELECT 1 FROM members me
            WHERE me.auth_user_id = auth.uid()
              AND me.club_director = true
              AND c.club_id IS NOT NULL
              AND c.club_id = me.current_club_id
          )
        )
    );
  $fn$;

  -- Channel visibility: DMs only for their participants; everything else as
  -- before (open channels browseable, club channel for its members, admins all).
  DROP POLICY IF EXISTS chat_channels_select ON chat_channels;
  CREATE POLICY chat_channels_select ON chat_channels FOR SELECT TO authenticated
    USING (
      chat_member_id() IS NOT NULL
      AND (
        (is_dm AND chat_is_dm_participant(id))
        OR (NOT is_dm AND (club_id IS NULL OR club_id = chat_member_club() OR chat_is_admin()))
      )
    );

  -- Client-side channel creation stays open-channels-only; DMs are created by
  -- the service role in the startDirectMessage server action.
  DROP POLICY IF EXISTS chat_channels_insert ON chat_channels;
  CREATE POLICY chat_channels_insert ON chat_channels FOR INSERT TO authenticated
    WITH CHECK (chat_is_admin() AND club_id IS NULL AND NOT is_dm AND created_by = chat_member_id());

  DROP POLICY IF EXISTS chat_channels_update ON chat_channels;
  CREATE POLICY chat_channels_update ON chat_channels FOR UPDATE TO authenticated
    USING (chat_is_admin() AND NOT is_dm);

  DROP POLICY IF EXISTS chat_channels_delete ON chat_channels;
  CREATE POLICY chat_channels_delete ON chat_channels FOR DELETE TO authenticated
    USING (chat_is_admin() AND club_id IS NULL AND NOT is_dm);

  -- Unread counts: same rules as before, except the admin arm no longer
  -- surfaces other people's DM channels (ids/counts would leak that a
  -- conversation exists). A DM the caller participates in still counts via
  -- its chat_channel_members row.
  CREATE OR REPLACE FUNCTION chat_unread_counts()
  RETURNS TABLE (channel_id uuid, unread bigint)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
    SELECT c.id, count(m.id)
    FROM chat_channels c
    LEFT JOIN chat_channel_members cm
      ON cm.channel_id = c.id AND cm.member_id = chat_member_id()
    JOIN chat_messages m
      ON m.channel_id = c.id
     AND m.created_at > COALESCE(cm.last_read_at, '-infinity'::timestamptz)
     AND m.member_id <> chat_member_id()
    WHERE cm.member_id IS NOT NULL
       OR (NOT c.is_dm AND (c.club_id = chat_member_club() OR chat_is_admin()))
    GROUP BY c.id;
  $fn$;

  -- Leaving stays open-channels-only: DM membership rows carry read state for a
  -- conversation the other person still sees, so they stay put.
  DROP POLICY IF EXISTS chat_channel_members_delete ON chat_channel_members;
  CREATE POLICY chat_channel_members_delete ON chat_channel_members FOR DELETE TO authenticated
    USING (
      (member_id = chat_member_id() OR chat_is_admin())
      AND EXISTS (
        SELECT 1 FROM chat_channels c
        WHERE c.id = channel_id AND c.club_id IS NULL AND NOT c.is_dm
      )
    );

END;
$mig$;
