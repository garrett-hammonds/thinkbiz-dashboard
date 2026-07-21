-- Chat attachments: multiple photos + document uploads per message
--
-- The original chat schema (20260612_member_chat.sql) allowed a single image
-- attachment per message via chat_messages.image_url, stored in the private
-- `chat-images` bucket (images only, 2 MB).
--
-- This migration lets a message carry up to five attachments (enforced in the
-- app), each either a photo or a document (PDF, CSV, XLSX, DOCX, …):
--
--   1. Adds chat_messages.attachments (jsonb array). Each element is
--      { path, kind: 'image'|'file', name, mime, size }. `path` is the private
--      bucket object path — chat-images for photos, chat-files for documents.
--      image_url is kept for backward compatibility: legacy single-image
--      messages still render from it, new messages write `attachments` instead.
--
--   2. Relaxes the "message must have a body" CHECK so a message is valid when it
--      has text, a legacy image_url, OR at least one attachment.
--
--   3. Creates a private `chat-files` bucket for document attachments, mirroring
--      the chat-images security model: uploads land in a per-user folder
--      (foldername[1] = auth.uid()), reads require an authenticated session and
--      go through short-lived signed URLs. A curated mime allow-list + 10 MB
--      size cap are the real server-side upload guard (uploads go straight to
--      Storage from the browser, so client-side checks are bypassable).
--
-- Guarded + idempotent, matching the other migrations. The to_regclass guard
-- lets this no-op on Supabase preview branches that have no baseline schema.

DO $mig$
BEGIN
  IF to_regclass('public.chat_messages') IS NULL THEN
    RAISE NOTICE 'chat_attachments migration skipped: chat schema not present';
    RETURN;
  END IF;

  ------------------------------------------------------------------
  -- 1. attachments column
  ------------------------------------------------------------------

  ALTER TABLE chat_messages
    ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

  -- Defensive: attachments must always be a JSON array.
  ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_attachments_is_array;
  ALTER TABLE chat_messages
    ADD CONSTRAINT chat_messages_attachments_is_array
    CHECK (jsonb_typeof(attachments) = 'array');

  ------------------------------------------------------------------
  -- 2. Relax the "must have a body" CHECK constraint
  --
  -- The original constraint was created anonymously as
  --   CHECK (content <> '' OR image_url IS NOT NULL)
  -- so it carries a system-generated name. Drop whichever check constraint on
  -- the table references image_url, then add a named, broader replacement.
  ------------------------------------------------------------------

  DECLARE
    con_name text;
  BEGIN
    FOR con_name IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.chat_messages'::regclass
        AND contype = 'c'
        AND conname <> 'chat_messages_attachments_is_array'
        AND pg_get_constraintdef(oid) ILIKE '%image_url%'
    LOOP
      EXECUTE format('ALTER TABLE chat_messages DROP CONSTRAINT %I', con_name);
    END LOOP;
  END;

  ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_has_body;
  ALTER TABLE chat_messages
    ADD CONSTRAINT chat_messages_has_body
    CHECK (
      content <> ''
      OR image_url IS NOT NULL
      OR jsonb_array_length(attachments) > 0
    );

  ------------------------------------------------------------------
  -- 3. Private chat-files bucket for document attachments
  ------------------------------------------------------------------

  BEGIN
    IF to_regclass('storage.buckets') IS NOT NULL THEN
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES (
        'chat-files',
        'chat-files',
        false,
        10485760, -- 10 MB
        ARRAY[
          'application/pdf',
          'text/csv',
          'text/plain',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        ]
      )
      ON CONFLICT (id) DO UPDATE
        SET public = EXCLUDED.public,
            file_size_limit = EXCLUDED.file_size_limit,
            allowed_mime_types = EXCLUDED.allowed_mime_types;

      -- Uploads: authenticated members, into their own auth.uid() folder only.
      DROP POLICY IF EXISTS chat_files_upload ON storage.objects;
      CREATE POLICY chat_files_upload ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'chat-files' AND (storage.foldername(name))[1] = auth.uid()::text);

      -- Reads: any authenticated session (paths carry unguessable UUIDs and are
      -- only reachable via an RLS-permitted message, so per-channel isolation
      -- holds). The app mints short-lived signed URLs client-side.
      DROP POLICY IF EXISTS chat_files_read ON storage.objects;
      CREATE POLICY chat_files_read ON storage.objects FOR SELECT TO authenticated
        USING (bucket_id = 'chat-files');
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'chat-files bucket/policies not created (insufficient privilege); create the private bucket manually.';
  END;

END;
$mig$;
