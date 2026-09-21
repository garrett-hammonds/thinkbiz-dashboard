-- Native push tokens for the iOS / Android shells (thinkbiz-mobile-app)
--
-- The phone apps register a Firebase Cloud Messaging device token instead of a
-- browser PushSubscription. Kept in its own table because push_subscriptions'
-- p256dh/auth columns are NOT NULL and meaningless for a device token.
-- lib/notifications/dispatch.ts fans out to both tables.
--
-- Writes go through server actions (app/actions/nativePush.ts) on the
-- signed-in member's own client, so the RLS policies mirror push_subscriptions:
-- a member manages only their own rows. Sending and pruning run on the
-- service-role client, which bypasses RLS.
--
-- The to_regclass guard mirrors the other migrations: Supabase preview branches
-- spin up without the baseline schema, so this must no-op there.

DO $mig$
BEGIN
  IF to_regclass('public.members') IS NULL THEN
    RAISE NOTICE 'native_push_tokens migration skipped: baseline schema not present';
    RETURN;
  END IF;

  CREATE TABLE IF NOT EXISTS native_push_tokens (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id    uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    platform     text NOT NULL CHECK (platform IN ('ios', 'android')),
    -- Unique so a re-register never duplicates; a token that moves to another
    -- signed-in member (shared phone) follows the new member via the upsert.
    token        text NOT NULL UNIQUE,
    app_version  text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz
  );

  CREATE INDEX IF NOT EXISTS native_push_tokens_member_idx
    ON native_push_tokens (member_id);

  ALTER TABLE native_push_tokens ENABLE ROW LEVEL SECURITY;

  -- notif_member_id() is defined by 20260619_notifications.sql.
  DROP POLICY IF EXISTS native_push_select ON native_push_tokens;
  CREATE POLICY native_push_select ON native_push_tokens FOR SELECT TO authenticated
    USING (member_id = notif_member_id());

  DROP POLICY IF EXISTS native_push_insert ON native_push_tokens;
  CREATE POLICY native_push_insert ON native_push_tokens FOR INSERT TO authenticated
    WITH CHECK (member_id = notif_member_id());

  DROP POLICY IF EXISTS native_push_update ON native_push_tokens;
  CREATE POLICY native_push_update ON native_push_tokens FOR UPDATE TO authenticated
    USING (member_id = notif_member_id())
    WITH CHECK (member_id = notif_member_id());

  DROP POLICY IF EXISTS native_push_delete ON native_push_tokens;
  CREATE POLICY native_push_delete ON native_push_tokens FOR DELETE TO authenticated
    USING (member_id = notif_member_id());

  GRANT SELECT, INSERT, UPDATE, DELETE ON native_push_tokens TO authenticated;
END;
$mig$;
