-- Chat: keep club channels in step with clubs, let admins clear unread in every
-- club channel, and let directors run the channels they create.
--
-- 1. Club channel sync. chat_provision_club_channel() only ran AFTER INSERT and
--    did nothing on conflict, so renaming a club (or repurposing it for a new
--    meeting time) left its channel under the old name — e.g. the
--    "Tuesday Evenings" club's channel still read "Oklahoma City - Monday
--    4:00pm". The trigger now also fires when a club's name or display_name
--    changes and upserts the channel's name/description, and the backfill
--    renames every channel that has drifted (and creates any that are missing).
--
-- 2. Admin read state. Admins can read every club channel and those channels
--    count toward their unread badge (20260629000100_admin_chat_unread.sql), but
--    chat_can_join() refused the chat_channel_members row that stores
--    last_read_at for any club other than the admin's own. Opening another
--    club's channel never cleared it, so the admin badge sat at 99+. Admins may
--    now hold a read-state row on any non-DM channel. Notifications are not
--    affected: club-channel recipients come from members.current_club_id.
--
-- 3. Director-managed channels. Directors (not only admins) can create open
--    channels. Whoever created an open channel — and any admin — can see, add
--    and remove its members and delete it. chat_can_manage_channel() is the
--    single rule for that.
--
-- The to_regclass guard mirrors the other migrations: Supabase preview branches
-- spin up without the baseline schema, so this must no-op there.

DO $mig$
BEGIN
  IF to_regclass('public.clubs') IS NULL OR to_regclass('public.chat_channels') IS NULL THEN
    RAISE NOTICE 'chat_club_sync_channel_management migration skipped: chat schema not present';
    RETURN;
  END IF;

  ------------------------------------------------------------------
  -- 1. Club channel sync
  ------------------------------------------------------------------

  CREATE OR REPLACE FUNCTION chat_provision_club_channel()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
  DECLARE
    channel_label text;
  BEGIN
    channel_label := COALESCE(NULLIF(btrim(NEW.display_name), ''), NULLIF(btrim(NEW.name), ''), 'Club chat');
    INSERT INTO chat_channels (name, description, club_id)
    VALUES (channel_label, 'Private channel for ' || channel_label || ' members', NEW.id)
    ON CONFLICT (club_id) DO UPDATE
      SET name = EXCLUDED.name, description = EXCLUDED.description
      WHERE chat_channels.name IS DISTINCT FROM EXCLUDED.name
         OR chat_channels.description IS DISTINCT FROM EXCLUDED.description;
    RETURN NEW;
  END;
  $fn$;

  DROP TRIGGER IF EXISTS chat_provision_club_channel_trg ON clubs;
  CREATE TRIGGER chat_provision_club_channel_trg
    AFTER INSERT OR UPDATE OF name, display_name ON clubs
    FOR EACH ROW EXECUTE FUNCTION chat_provision_club_channel();

  INSERT INTO chat_channels (name, description, club_id)
  SELECT l.label, 'Private channel for ' || l.label || ' members', l.id
  FROM (
    SELECT cl.id,
           COALESCE(NULLIF(btrim(cl.display_name), ''), NULLIF(btrim(cl.name), ''), 'Club chat') AS label
    FROM clubs cl
  ) l
  ON CONFLICT (club_id) DO UPDATE
    SET name = EXCLUDED.name, description = EXCLUDED.description
    WHERE chat_channels.name IS DISTINCT FROM EXCLUDED.name
       OR chat_channels.description IS DISTINCT FROM EXCLUDED.description;

  ------------------------------------------------------------------
  -- Helpers
  ------------------------------------------------------------------

  CREATE OR REPLACE FUNCTION chat_is_director()
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
    SELECT COALESCE((SELECT club_director FROM members WHERE auth_user_id = auth.uid() LIMIT 1), false);
  $fn$;

  -- Open (non-club, non-DM) channel that the caller created, or any open
  -- channel for admins: add/remove members, delete the channel.
  CREATE OR REPLACE FUNCTION chat_can_manage_channel(ch uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
    SELECT EXISTS (
      SELECT 1 FROM chat_channels c
      WHERE c.id = ch
        AND c.club_id IS NULL
        AND NOT c.is_dm
        AND (chat_is_admin() OR c.created_by = chat_member_id())
    );
  $fn$;

  ------------------------------------------------------------------
  -- 2. Admin read state: same as 20260721161243_member_directory_dms.sql plus
  --    the admin arm for non-DM channels.
  ------------------------------------------------------------------

  CREATE OR REPLACE FUNCTION chat_can_join(ch uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
    SELECT EXISTS (
      SELECT 1 FROM chat_channels c
      WHERE c.id = ch
        AND (
          (c.is_dm AND chat_is_dm_participant(ch))
          OR (NOT c.is_dm AND (c.club_id IS NULL OR c.club_id = chat_member_club() OR chat_is_admin()))
        )
    );
  $fn$;

  GRANT EXECUTE ON FUNCTION chat_is_director(), chat_can_manage_channel(uuid) TO authenticated;

  ------------------------------------------------------------------
  -- 3. Director-managed channels
  ------------------------------------------------------------------

  DROP POLICY IF EXISTS chat_channels_insert ON chat_channels;
  CREATE POLICY chat_channels_insert ON chat_channels FOR INSERT TO authenticated
    WITH CHECK (
      (chat_is_admin() OR chat_is_director())
      AND club_id IS NULL AND NOT is_dm AND created_by = chat_member_id()
    );

  DROP POLICY IF EXISTS chat_channels_delete ON chat_channels;
  CREATE POLICY chat_channels_delete ON chat_channels FOR DELETE TO authenticated
    USING (chat_can_manage_channel(id));

  -- Managers see who is in their channel. DELETE needs this too: Postgres
  -- only lets a policy-filtered DELETE touch rows the SELECT policy shows.
  DROP POLICY IF EXISTS chat_channel_members_select ON chat_channel_members;
  CREATE POLICY chat_channel_members_select ON chat_channel_members FOR SELECT TO authenticated
    USING (member_id = chat_member_id() OR chat_is_admin() OR chat_can_manage_channel(channel_id));

  -- Your own row (join / read state), or anyone's row in a channel you manage.
  -- Managers add people with ON CONFLICT DO NOTHING, so no UPDATE arm is needed.
  DROP POLICY IF EXISTS chat_channel_members_insert ON chat_channel_members;
  CREATE POLICY chat_channel_members_insert ON chat_channel_members FOR INSERT TO authenticated
    WITH CHECK (
      (member_id = chat_member_id() AND chat_can_join(channel_id))
      OR chat_can_manage_channel(channel_id)
    );

  DROP POLICY IF EXISTS chat_channel_members_delete ON chat_channel_members;
  CREATE POLICY chat_channel_members_delete ON chat_channel_members FOR DELETE TO authenticated
    USING (
      (
        (member_id = chat_member_id() OR chat_is_admin())
        AND EXISTS (
          SELECT 1 FROM chat_channels c
          WHERE c.id = channel_id AND c.club_id IS NULL AND NOT c.is_dm
        )
      )
      OR chat_can_manage_channel(channel_id)
    );

END;
$mig$;
