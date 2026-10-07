-- Unread counts skip messages from members the caller has blocked
--
-- App Store Guideline 1.2: blocking removes the blocked member's content from
-- the blocker's feed. The chat client already leaves blocked members' messages
-- out of every channel; this keeps the unread badges (chat sidebar and the
-- app shell) from counting messages the blocker will never see.
--
-- Function-only change: same signature and rules as the version in
-- 20260721161243_member_directory_dms.sql, plus the NOT EXISTS on
-- member_dm_blocks. One direction only: the blocked member's own counts still
-- include the blocker's messages.
--
-- The to_regclass guard mirrors the other migrations: Supabase preview branches
-- spin up without the baseline schema, so this must no-op there.

DO $mig$
BEGIN
  IF to_regclass('public.chat_messages') IS NULL OR to_regclass('public.member_dm_blocks') IS NULL THEN
    RAISE NOTICE 'chat_unread_hide_blocked migration skipped: chat schema not present';
    RETURN;
  END IF;

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
     AND NOT EXISTS (
       SELECT 1 FROM member_dm_blocks b
       WHERE b.blocker_id = chat_member_id() AND b.blocked_id = m.member_id
     )
    WHERE cm.member_id IS NOT NULL
       OR (NOT c.is_dm AND (c.club_id = chat_member_club() OR chat_is_admin()))
    GROUP BY c.id;
  $fn$;

END;
$mig$;
