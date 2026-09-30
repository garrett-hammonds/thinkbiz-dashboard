-- Chat safety: reports, DM blocks, chat suspensions, guidelines acceptance
--
-- App Store Guideline 1.2 (user-generated content) requires a way to report
-- objectionable content, a way to block abusive users, a published
-- no-tolerance policy, and timely action on reports. This adds:
--
--   * chat_message_reports  — a member reports a message. The message is
--                             snapshotted (content + attachments + author) so
--                             the report survives the message being edited or
--                             deleted, and so DM reports are reviewable even
--                             though moderators can't read DMs.
--                             Reviewed at /dashboard/chat-reports by admins
--                             (everything) and club directors (reports about
--                             members of their own club).
--   * member_dm_blocks      — any member can block another member from direct
--                             messaging them. Enforced both ways inside that DM:
--                             neither side can post while a block exists.
--   * chat_suspensions      — the moderator-level block: an admin, or a
--                             director for a member of their own club, can
--                             suspend a member from posting anywhere in chat
--                             (channels and DMs). Reading stays allowed.
--   * members.chat_guidelines_accepted_at — members accept the chat
--                             guidelines (zero tolerance for abusive content)
--                             once, before chat opens for the first time.
--
-- Reports and suspensions are written and read only by server actions through
-- the service role, so their RLS has no client policies (deny by default).
-- Blocks are the member's own rows, same shape as member_stars.
--
-- The to_regclass guard mirrors the other migrations: Supabase preview branches
-- spin up without the baseline schema, so this must no-op there.

DO $mig$
BEGIN
  IF to_regclass('public.members') IS NULL OR to_regclass('public.chat_messages') IS NULL THEN
    RAISE NOTICE 'chat_safety migration skipped: baseline schema not present';
    RETURN;
  END IF;

  ------------------------------------------------------------------
  -- Guidelines acceptance
  ------------------------------------------------------------------

  ALTER TABLE members ADD COLUMN IF NOT EXISTS chat_guidelines_accepted_at timestamptz;

  ------------------------------------------------------------------
  -- Reports
  ------------------------------------------------------------------

  CREATE TABLE IF NOT EXISTS chat_message_reports (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- SET NULL: the report (and its snapshot) outlives the message.
    message_id         uuid REFERENCES chat_messages(id) ON DELETE SET NULL,
    channel_id         uuid REFERENCES chat_channels(id) ON DELETE SET NULL,
    reporter_id        uuid REFERENCES members(id) ON DELETE SET NULL,
    reported_member_id uuid REFERENCES members(id) ON DELETE SET NULL,
    reason             text NOT NULL CHECK (reason IN ('harassment', 'spam', 'inappropriate', 'other')),
    details            text,
    -- { content, attachments, image_url, created_at } at report time
    message_snapshot   jsonb NOT NULL DEFAULT '{}'::jsonb,
    status             text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
    resolution         text,
    resolved_by        uuid REFERENCES members(id) ON DELETE SET NULL,
    resolved_at        timestamptz,
    created_at         timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS chat_message_reports_open_idx
    ON chat_message_reports (created_at DESC) WHERE status = 'open';
  CREATE INDEX IF NOT EXISTS chat_message_reports_reported_idx
    ON chat_message_reports (reported_member_id);

  -- One open report per reporter per message; re-reporting is a no-op.
  CREATE UNIQUE INDEX IF NOT EXISTS chat_message_reports_once_idx
    ON chat_message_reports (message_id, reporter_id) WHERE status = 'open';

  ALTER TABLE chat_message_reports ENABLE ROW LEVEL SECURITY;

  ------------------------------------------------------------------
  -- DM blocks
  ------------------------------------------------------------------

  CREATE TABLE IF NOT EXISTS member_dm_blocks (
    blocker_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    blocked_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker_id, blocked_id),
    CHECK (blocker_id <> blocked_id)
  );

  CREATE INDEX IF NOT EXISTS member_dm_blocks_blocked_idx ON member_dm_blocks (blocked_id);

  ALTER TABLE member_dm_blocks ENABLE ROW LEVEL SECURITY;

  -- Own rows only. Nobody can list who blocked them.
  DROP POLICY IF EXISTS member_dm_blocks_select ON member_dm_blocks;
  CREATE POLICY member_dm_blocks_select ON member_dm_blocks FOR SELECT TO authenticated
    USING (blocker_id = chat_member_id());

  DROP POLICY IF EXISTS member_dm_blocks_insert ON member_dm_blocks;
  CREATE POLICY member_dm_blocks_insert ON member_dm_blocks FOR INSERT TO authenticated
    WITH CHECK (blocker_id = chat_member_id());

  DROP POLICY IF EXISTS member_dm_blocks_delete ON member_dm_blocks;
  CREATE POLICY member_dm_blocks_delete ON member_dm_blocks FOR DELETE TO authenticated
    USING (blocker_id = chat_member_id());

  GRANT SELECT, INSERT, DELETE ON member_dm_blocks TO authenticated;

  ------------------------------------------------------------------
  -- Chat suspensions
  ------------------------------------------------------------------

  CREATE TABLE IF NOT EXISTS chat_suspensions (
    member_id    uuid PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
    suspended_by uuid REFERENCES members(id) ON DELETE SET NULL,
    reason       text,
    created_at   timestamptz NOT NULL DEFAULT now()
  );

  ALTER TABLE chat_suspensions ENABLE ROW LEVEL SECURITY;

  ------------------------------------------------------------------
  -- Helpers (SECURITY DEFINER, like the other chat helpers, so policies can
  -- consult these tables without granting clients read access to them)
  ------------------------------------------------------------------

  CREATE OR REPLACE FUNCTION chat_is_suspended()
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
    SELECT EXISTS (SELECT 1 FROM chat_suspensions s WHERE s.member_id = chat_member_id());
  $fn$;

  -- True when `ch` is a DM and either participant has blocked the other.
  CREATE OR REPLACE FUNCTION chat_dm_blocked(ch uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
    SELECT EXISTS (
      SELECT 1
      FROM chat_channels c
      JOIN chat_channel_members other
        ON other.channel_id = c.id AND other.member_id <> chat_member_id()
      JOIN member_dm_blocks b
        ON (b.blocker_id = chat_member_id() AND b.blocked_id = other.member_id)
        OR (b.blocker_id = other.member_id AND b.blocked_id = chat_member_id())
      WHERE c.id = ch AND c.is_dm
    );
  $fn$;

  GRANT EXECUTE ON FUNCTION chat_is_suspended(), chat_dm_blocked(uuid) TO authenticated;

  ------------------------------------------------------------------
  -- Enforcement on writes
  ------------------------------------------------------------------

  DROP POLICY IF EXISTS chat_messages_insert ON chat_messages;
  CREATE POLICY chat_messages_insert ON chat_messages FOR INSERT TO authenticated
    WITH CHECK (
      member_id = chat_member_id()
      AND chat_can_access_channel(channel_id)
      AND NOT chat_is_suspended()
      AND NOT chat_dm_blocked(channel_id)
    );

  -- A suspended member can't rewrite their old messages either.
  DROP POLICY IF EXISTS chat_messages_update ON chat_messages;
  CREATE POLICY chat_messages_update ON chat_messages FOR UPDATE TO authenticated
    USING (member_id = chat_member_id())
    WITH CHECK (
      member_id = chat_member_id()
      AND chat_can_access_channel(channel_id)
      AND NOT chat_is_suspended()
    );

  DROP POLICY IF EXISTS chat_message_reactions_insert ON chat_message_reactions;
  CREATE POLICY chat_message_reactions_insert ON chat_message_reactions FOR INSERT TO authenticated
    WITH CHECK (
      member_id = chat_member_id()
      AND chat_can_access_channel(chat_message_channel(message_id))
      AND NOT chat_is_suspended()
    );

END;
$mig$;
