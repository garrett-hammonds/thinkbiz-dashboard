-- Admin chat unread counts
--
-- Admins have read/post access to every club channel (enforced by the
-- chat_channels / chat_messages RLS policies and chat_can_access_channel()),
-- but chat_unread_counts() only surfaced unread counts for the caller's own
-- club channel and channels they had explicitly joined. As a result, admins
-- never saw unread badges for other clubs' channels.
--
-- This patches the function's WHERE clause to also return counts for admins
-- across every visible channel, matching the access the rest of the chat RLS
-- already grants them.
--
-- The to_regclass guard mirrors the other migrations so this no-ops on empty
-- Supabase preview branches instead of failing.
--
-- Apply via Supabase SQL editor or `supabase db push`.

DO $mig$
BEGIN
  IF to_regclass('public.chat_channels') IS NULL THEN
    RAISE NOTICE 'admin chat unread migration skipped: chat_channels not present';
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
    WHERE c.club_id = chat_member_club()
       OR cm.member_id IS NOT NULL
       OR chat_is_admin()
    GROUP BY c.id;
  $fn$;
END;
$mig$;
