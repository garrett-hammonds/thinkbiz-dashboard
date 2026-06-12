-- Member chat (Slack-style channels)
--
-- Adds channel-based chat:
--   * chat_channels          — one private channel per club (auto-provisioned)
--                              plus open channels created by admins (club_id IS NULL)
--   * chat_channel_members   — membership for open channels + per-member read state
--                              (club-channel membership is implicit via members.current_club_id;
--                              a row here only tracks last_read_at)
--   * chat_messages          — flat stream per channel; <@member_uuid> tokens mark mentions
--   * chat_message_reactions — emoji reactions
--
-- Access rules (enforced by RLS, mirrored in the UI):
--   * Club channels: visible/writable only to members whose current_club_id matches (and admins).
--   * Open channels: browseable by any member; must join to read/post.
--   * Messages: author can edit/delete; admins can delete anywhere; club directors
--     can delete within their own club's channel.
--
-- Realtime: chat_messages and chat_message_reactions are added to the
-- supabase_realtime publication with REPLICA IDENTITY FULL so live
-- inserts/updates/deletes reach subscribed clients (RLS-filtered).
--
-- Apply via Supabase SQL editor or `supabase db push` if using the CLI.
--
-- The to_regclass guard is intentional: Supabase preview branches spin up an
-- empty database with no baseline schema, so this migration must no-op there
-- instead of failing (same approach as 20260519_director_claim_onboarding.sql).

DO $mig$
BEGIN
  IF to_regclass('public.members') IS NULL OR to_regclass('public.clubs') IS NULL THEN
    RAISE NOTICE 'member_chat migration skipped: baseline schema not present';
    RETURN;
  END IF;

  ------------------------------------------------------------------
  -- Tables
  ------------------------------------------------------------------

  CREATE TABLE IF NOT EXISTS chat_channels (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    description text,
    -- non-null = the private channel for that club; null = open channel
    club_id     uuid UNIQUE REFERENCES clubs(id) ON DELETE CASCADE,
    created_by  uuid REFERENCES members(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS chat_channel_members (
    channel_id   uuid NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    member_id    uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    joined_at    timestamptz NOT NULL DEFAULT now(),
    last_read_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (channel_id, member_id)
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id uuid NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    content    text NOT NULL DEFAULT '',
    image_url  text,
    mentions   uuid[] NOT NULL DEFAULT '{}',
    edited_at  timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (content <> '' OR image_url IS NOT NULL)
  );

  CREATE INDEX IF NOT EXISTS chat_messages_channel_created_idx
    ON chat_messages (channel_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS chat_message_reactions (
    message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    emoji      text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (message_id, member_id, emoji)
  );

  ------------------------------------------------------------------
  -- Helper functions (SECURITY DEFINER so RLS policies can consult
  -- members/chat_channels without recursive policy evaluation)
  ------------------------------------------------------------------

  CREATE OR REPLACE FUNCTION chat_member_id()
  RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
    SELECT id FROM members WHERE auth_user_id = auth.uid() LIMIT 1;
  $fn$;

  CREATE OR REPLACE FUNCTION chat_member_club()
  RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
    SELECT current_club_id FROM members WHERE auth_user_id = auth.uid() LIMIT 1;
  $fn$;

  CREATE OR REPLACE FUNCTION chat_is_admin()
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
    SELECT COALESCE((SELECT is_admin FROM members WHERE auth_user_id = auth.uid() LIMIT 1), false);
  $fn$;

  -- Open channel, or the caller's own club channel: the two cases where a
  -- chat_channel_members row may be created for yourself (join / read-state).
  CREATE OR REPLACE FUNCTION chat_can_join(ch uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
    SELECT EXISTS (
      SELECT 1 FROM chat_channels c
      WHERE c.id = ch
        AND (c.club_id IS NULL OR c.club_id = chat_member_club())
    );
  $fn$;

  -- Full read/post access: admins everywhere, club members in their club
  -- channel, joined members in open channels.
  CREATE OR REPLACE FUNCTION chat_can_access_channel(ch uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
    SELECT EXISTS (
      SELECT 1 FROM chat_channels c
      WHERE c.id = ch
        AND (
          chat_is_admin()
          OR (c.club_id IS NOT NULL AND c.club_id = chat_member_club())
          OR (c.club_id IS NULL AND EXISTS (
                SELECT 1 FROM chat_channel_members m
                WHERE m.channel_id = ch AND m.member_id = chat_member_id()
              ))
        )
    );
  $fn$;

  -- Moderation: admins anywhere; directors within their own club's channel.
  CREATE OR REPLACE FUNCTION chat_can_moderate(ch uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
    SELECT chat_is_admin() OR EXISTS (
      SELECT 1
      FROM chat_channels c
      JOIN members me ON me.auth_user_id = auth.uid()
      WHERE c.id = ch
        AND me.club_director = true
        AND c.club_id IS NOT NULL
        AND c.club_id = me.current_club_id
    );
  $fn$;

  CREATE OR REPLACE FUNCTION chat_message_channel(msg uuid)
  RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
    SELECT channel_id FROM chat_messages WHERE id = msg;
  $fn$;

  -- Unread counts per visible channel for the signed-in member. Channels with
  -- no read-state row yet count every message from other members.
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
    WHERE c.club_id = chat_member_club()
       OR cm.member_id IS NOT NULL
    GROUP BY c.id;
  $fn$;

  GRANT EXECUTE ON FUNCTION
    chat_member_id(), chat_member_club(), chat_is_admin(),
    chat_can_join(uuid), chat_can_access_channel(uuid),
    chat_can_moderate(uuid), chat_message_channel(uuid),
    chat_unread_counts()
  TO authenticated;

  ------------------------------------------------------------------
  -- Row Level Security
  ------------------------------------------------------------------

  ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
  ALTER TABLE chat_channel_members ENABLE ROW LEVEL SECURITY;
  ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
  ALTER TABLE chat_message_reactions ENABLE ROW LEVEL SECURITY;

  -- chat_channels: members browse open channels and see their own club channel
  DROP POLICY IF EXISTS chat_channels_select ON chat_channels;
  CREATE POLICY chat_channels_select ON chat_channels FOR SELECT TO authenticated
    USING (
      chat_member_id() IS NOT NULL
      AND (club_id IS NULL OR club_id = chat_member_club() OR chat_is_admin())
    );

  DROP POLICY IF EXISTS chat_channels_insert ON chat_channels;
  CREATE POLICY chat_channels_insert ON chat_channels FOR INSERT TO authenticated
    WITH CHECK (chat_is_admin() AND club_id IS NULL AND created_by = chat_member_id());

  DROP POLICY IF EXISTS chat_channels_update ON chat_channels;
  CREATE POLICY chat_channels_update ON chat_channels FOR UPDATE TO authenticated
    USING (chat_is_admin());

  DROP POLICY IF EXISTS chat_channels_delete ON chat_channels;
  CREATE POLICY chat_channels_delete ON chat_channels FOR DELETE TO authenticated
    USING (chat_is_admin() AND club_id IS NULL);

  -- chat_channel_members: own rows only (join, read-state, leave)
  DROP POLICY IF EXISTS chat_channel_members_select ON chat_channel_members;
  CREATE POLICY chat_channel_members_select ON chat_channel_members FOR SELECT TO authenticated
    USING (member_id = chat_member_id() OR chat_is_admin());

  DROP POLICY IF EXISTS chat_channel_members_insert ON chat_channel_members;
  CREATE POLICY chat_channel_members_insert ON chat_channel_members FOR INSERT TO authenticated
    WITH CHECK (member_id = chat_member_id() AND chat_can_join(channel_id));

  DROP POLICY IF EXISTS chat_channel_members_update ON chat_channel_members;
  CREATE POLICY chat_channel_members_update ON chat_channel_members FOR UPDATE TO authenticated
    USING (member_id = chat_member_id())
    WITH CHECK (member_id = chat_member_id());

  -- leaving is only meaningful for open channels; club-channel rows are
  -- read-state only and stay put
  DROP POLICY IF EXISTS chat_channel_members_delete ON chat_channel_members;
  CREATE POLICY chat_channel_members_delete ON chat_channel_members FOR DELETE TO authenticated
    USING (
      (member_id = chat_member_id() OR chat_is_admin())
      AND EXISTS (SELECT 1 FROM chat_channels c WHERE c.id = channel_id AND c.club_id IS NULL)
    );

  -- chat_messages
  DROP POLICY IF EXISTS chat_messages_select ON chat_messages;
  CREATE POLICY chat_messages_select ON chat_messages FOR SELECT TO authenticated
    USING (chat_can_access_channel(channel_id));

  DROP POLICY IF EXISTS chat_messages_insert ON chat_messages;
  CREATE POLICY chat_messages_insert ON chat_messages FOR INSERT TO authenticated
    WITH CHECK (member_id = chat_member_id() AND chat_can_access_channel(channel_id));

  DROP POLICY IF EXISTS chat_messages_update ON chat_messages;
  CREATE POLICY chat_messages_update ON chat_messages FOR UPDATE TO authenticated
    USING (member_id = chat_member_id())
    WITH CHECK (member_id = chat_member_id() AND chat_can_access_channel(channel_id));

  DROP POLICY IF EXISTS chat_messages_delete ON chat_messages;
  CREATE POLICY chat_messages_delete ON chat_messages FOR DELETE TO authenticated
    USING (member_id = chat_member_id() OR chat_can_moderate(channel_id));

  -- chat_message_reactions
  DROP POLICY IF EXISTS chat_message_reactions_select ON chat_message_reactions;
  CREATE POLICY chat_message_reactions_select ON chat_message_reactions FOR SELECT TO authenticated
    USING (chat_can_access_channel(chat_message_channel(message_id)));

  DROP POLICY IF EXISTS chat_message_reactions_insert ON chat_message_reactions;
  CREATE POLICY chat_message_reactions_insert ON chat_message_reactions FOR INSERT TO authenticated
    WITH CHECK (member_id = chat_member_id() AND chat_can_access_channel(chat_message_channel(message_id)));

  DROP POLICY IF EXISTS chat_message_reactions_delete ON chat_message_reactions;
  CREATE POLICY chat_message_reactions_delete ON chat_message_reactions FOR DELETE TO authenticated
    USING (member_id = chat_member_id());

  ------------------------------------------------------------------
  -- Club channel auto-provisioning (new clubs) + backfill (existing)
  ------------------------------------------------------------------

  CREATE OR REPLACE FUNCTION chat_provision_club_channel()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
  BEGIN
    INSERT INTO chat_channels (name, description, club_id)
    VALUES (
      COALESCE(NEW.display_name, NEW.name),
      'Private channel for ' || COALESCE(NEW.display_name, NEW.name) || ' members',
      NEW.id
    )
    ON CONFLICT (club_id) DO NOTHING;
    RETURN NEW;
  END;
  $fn$;

  DROP TRIGGER IF EXISTS chat_provision_club_channel_trg ON clubs;
  CREATE TRIGGER chat_provision_club_channel_trg
    AFTER INSERT ON clubs
    FOR EACH ROW EXECUTE FUNCTION chat_provision_club_channel();

  INSERT INTO chat_channels (name, description, club_id)
  SELECT
    COALESCE(cl.display_name, cl.name),
    'Private channel for ' || COALESCE(cl.display_name, cl.name) || ' members',
    cl.id
  FROM clubs cl
  WHERE NOT EXISTS (SELECT 1 FROM chat_channels c WHERE c.club_id = cl.id);

  ------------------------------------------------------------------
  -- Realtime
  ------------------------------------------------------------------

  ALTER TABLE chat_messages REPLICA IDENTITY FULL;
  ALTER TABLE chat_message_reactions REPLICA IDENTITY FULL;

  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_message_reactions'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE chat_message_reactions;
    END IF;
  END IF;

  ------------------------------------------------------------------
  -- Storage bucket for chat image attachments
  -- (If this block fails due to storage permissions in your project,
  -- create a public "chat-images" bucket in the dashboard instead and
  -- allow authenticated uploads.)
  ------------------------------------------------------------------

  BEGIN
    IF to_regclass('storage.buckets') IS NOT NULL THEN
      INSERT INTO storage.buckets (id, name, public)
      VALUES ('chat-images', 'chat-images', true)
      ON CONFLICT (id) DO NOTHING;

      DROP POLICY IF EXISTS chat_images_upload ON storage.objects;
      CREATE POLICY chat_images_upload ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'chat-images' AND (storage.foldername(name))[1] = auth.uid()::text);

      DROP POLICY IF EXISTS chat_images_read ON storage.objects;
      CREATE POLICY chat_images_read ON storage.objects FOR SELECT
        USING (bucket_id = 'chat-images');
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'chat-images bucket/policies not created (insufficient privilege); create the public bucket manually.';
  END;

END;
$mig$;
