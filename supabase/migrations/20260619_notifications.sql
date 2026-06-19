-- Notifications: per-member preferences + web-push subscriptions
--
-- Adds the storage layer for email + web-push notifications:
--   * notification_preferences — one row per member; opt-out model (defaults true).
--                                Master email/push switches plus per-category toggles
--                                (chat, weekly-log reminders, application approval).
--   * push_subscriptions       — one row per browser/device that has granted the Web
--                                Push permission (endpoint + p256dh/auth keys).
--
-- The actual fan-out (lib/notifications/dispatch.ts) runs server-side with the
-- service-role client, which bypasses RLS so it can read every recipient's prefs
-- and subscriptions. The RLS policies below only govern the member-facing paths:
-- the profile toggles and the subscribe/unsubscribe actions, where a member may
-- only touch their own rows.
--
-- The to_regclass guard mirrors 20260612_member_chat.sql: Supabase preview branches
-- spin up an empty database with no baseline schema, so this migration must no-op
-- there instead of failing.
--
-- Apply via Supabase SQL editor or `supabase db push` if using the CLI.

DO $mig$
BEGIN
  IF to_regclass('public.members') IS NULL THEN
    RAISE NOTICE 'notifications migration skipped: baseline schema not present';
    RETURN;
  END IF;

  ------------------------------------------------------------------
  -- Tables
  ------------------------------------------------------------------

  -- One preferences row per member. All booleans default true (opt-out model):
  -- members are notified unless they explicitly turn a category off. A missing
  -- row is treated as all-true by the dispatcher, so members who never open
  -- their settings still get notified.
  CREATE TABLE IF NOT EXISTS notification_preferences (
    member_id          uuid PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
    email_enabled      boolean NOT NULL DEFAULT true,
    push_enabled       boolean NOT NULL DEFAULT true,
    email_chat         boolean NOT NULL DEFAULT true,
    email_log_reminder boolean NOT NULL DEFAULT true,
    email_application  boolean NOT NULL DEFAULT true,
    push_chat          boolean NOT NULL DEFAULT true,
    push_log_reminder  boolean NOT NULL DEFAULT true,
    push_application   boolean NOT NULL DEFAULT true,
    updated_at         timestamptz NOT NULL DEFAULT now()
  );

  -- One row per browser/device subscription. endpoint is unique so re-subscribing
  -- the same browser upserts rather than duplicating.
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id    uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    endpoint     text NOT NULL UNIQUE,
    p256dh       text NOT NULL,
    auth         text NOT NULL,
    user_agent   text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz
  );

  CREATE INDEX IF NOT EXISTS push_subscriptions_member_idx
    ON push_subscriptions (member_id);

  ------------------------------------------------------------------
  -- Helper (SECURITY DEFINER so RLS policies can resolve the caller's
  -- member id without recursive policy evaluation — mirrors chat_member_id())
  ------------------------------------------------------------------

  CREATE OR REPLACE FUNCTION notif_member_id()
  RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
    SELECT id FROM members WHERE auth_user_id = auth.uid() LIMIT 1;
  $fn$;

  GRANT EXECUTE ON FUNCTION notif_member_id() TO authenticated;

  ------------------------------------------------------------------
  -- Row Level Security: a member manages only their own rows
  ------------------------------------------------------------------

  ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
  ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS notif_prefs_select ON notification_preferences;
  CREATE POLICY notif_prefs_select ON notification_preferences FOR SELECT TO authenticated
    USING (member_id = notif_member_id());

  DROP POLICY IF EXISTS notif_prefs_insert ON notification_preferences;
  CREATE POLICY notif_prefs_insert ON notification_preferences FOR INSERT TO authenticated
    WITH CHECK (member_id = notif_member_id());

  DROP POLICY IF EXISTS notif_prefs_update ON notification_preferences;
  CREATE POLICY notif_prefs_update ON notification_preferences FOR UPDATE TO authenticated
    USING (member_id = notif_member_id())
    WITH CHECK (member_id = notif_member_id());

  DROP POLICY IF EXISTS push_subs_select ON push_subscriptions;
  CREATE POLICY push_subs_select ON push_subscriptions FOR SELECT TO authenticated
    USING (member_id = notif_member_id());

  DROP POLICY IF EXISTS push_subs_insert ON push_subscriptions;
  CREATE POLICY push_subs_insert ON push_subscriptions FOR INSERT TO authenticated
    WITH CHECK (member_id = notif_member_id());

  DROP POLICY IF EXISTS push_subs_update ON push_subscriptions;
  CREATE POLICY push_subs_update ON push_subscriptions FOR UPDATE TO authenticated
    USING (member_id = notif_member_id())
    WITH CHECK (member_id = notif_member_id());

  DROP POLICY IF EXISTS push_subs_delete ON push_subscriptions;
  CREATE POLICY push_subs_delete ON push_subscriptions FOR DELETE TO authenticated
    USING (member_id = notif_member_id());

END;
$mig$;
