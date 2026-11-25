-- Member Google review link, and chat channels that new members join
-- automatically.
--
-- 1. members.google_review_url. A profile link next to the booking calendar
--    link, shown on the member's directory profile as "Leave a Google review".
--    It is an ordinary profile column: members edit their own through
--    updateProfile, and it is not in the privileged-column lock list.
--
-- 2. chat_channels.auto_join. Open channels flagged with it (the company-wide
--    ones, e.g. announcements and subs) get every new member without a
--    director adding them by hand. A trigger on members adds the row when a
--    member is created active or becomes active again. Members can still leave
--    such a channel afterwards; nothing re-adds them unless they are
--    deactivated and reactivated.
--
--    The two existing company-wide channels are flagged by name, and every
--    currently active member who is missing from them is added once. Their
--    read marker starts at now(), so nobody gets a backlog of unread messages.
--
-- The to_regclass guard mirrors the other migrations: Supabase preview branches
-- spin up without the baseline schema, so this must no-op there.

DO $mig$
BEGIN
  IF to_regclass('public.members') IS NULL OR to_regclass('public.chat_channels') IS NULL THEN
    RAISE NOTICE 'google_review_url_chat_auto_join migration skipped: baseline schema not present';
    RETURN;
  END IF;

  ------------------------------------------------------------------
  -- 1. Google review link
  ------------------------------------------------------------------

  ALTER TABLE members ADD COLUMN IF NOT EXISTS google_review_url text;

  ------------------------------------------------------------------
  -- 2. Auto-join channels
  ------------------------------------------------------------------

  ALTER TABLE chat_channels ADD COLUMN IF NOT EXISTS auto_join boolean NOT NULL DEFAULT false;

  -- Only open channels can be auto-join: club channels follow the club roster
  -- and DMs have exactly two participants.
  ALTER TABLE chat_channels DROP CONSTRAINT IF EXISTS chat_channels_auto_join_open_only;
  ALTER TABLE chat_channels ADD CONSTRAINT chat_channels_auto_join_open_only
    CHECK (NOT auto_join OR (club_id IS NULL AND NOT is_dm));

  CREATE OR REPLACE FUNCTION chat_auto_join_member()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
  BEGIN
    IF NEW.is_active IS TRUE
       AND (TG_OP = 'INSERT' OR OLD.is_active IS DISTINCT FROM NEW.is_active) THEN
      INSERT INTO chat_channel_members (channel_id, member_id)
      SELECT c.id, NEW.id
      FROM chat_channels c
      WHERE c.auto_join AND c.club_id IS NULL AND NOT c.is_dm
      ON CONFLICT (channel_id, member_id) DO NOTHING;
    END IF;
    RETURN NEW;
  END;
  $fn$;

  DROP TRIGGER IF EXISTS chat_auto_join_member_trg ON members;
  CREATE TRIGGER chat_auto_join_member_trg
    AFTER INSERT OR UPDATE OF is_active ON members
    FOR EACH ROW EXECUTE FUNCTION chat_auto_join_member();

  -- Flag the company-wide channels.
  UPDATE chat_channels
  SET auto_join = true
  WHERE club_id IS NULL AND NOT is_dm
    AND lower(btrim(name)) IN ('subs', 'sub', 'announcements', 'thinkbiz announcements');

  -- One-time catch-up: active members who are not in those channels yet.
  INSERT INTO chat_channel_members (channel_id, member_id)
  SELECT c.id, m.id
  FROM chat_channels c
  CROSS JOIN members m
  WHERE c.auto_join AND m.is_active IS TRUE
  ON CONFLICT (channel_id, member_id) DO NOTHING;

END;
$mig$;
