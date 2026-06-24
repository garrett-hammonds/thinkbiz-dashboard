-- Chat notification idempotency
--
-- Chat notifications are dispatched from the web client right after a message is
-- inserted (app/actions/chat.ts -> notifyChatMessage), so they no longer depend
-- on a manually-configured Supabase Database Webhook. The webhook is kept as an
-- optional backstop, which means two triggers can fire for the same message.
--
-- `notified_at` lets the dispatcher claim a message atomically
-- (UPDATE ... WHERE notified_at IS NULL) so it is delivered exactly once no
-- matter how many triggers fire.
--
-- The to_regclass guard mirrors the other migrations so this no-ops on empty
-- Supabase preview branches instead of failing.
--
-- Apply via Supabase SQL editor or `supabase db push`.

DO $mig$
BEGIN
  IF to_regclass('public.chat_messages') IS NULL THEN
    RAISE NOTICE 'chat notified_at migration skipped: chat_messages not present';
    RETURN;
  END IF;

  ALTER TABLE chat_messages
    ADD COLUMN IF NOT EXISTS notified_at timestamptz;
END;
$mig$;
