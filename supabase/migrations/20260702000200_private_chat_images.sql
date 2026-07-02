-- Make the chat-images bucket private + enforce upload constraints server-side
--
-- The bucket was created `public = true` (20260612_member_chat.sql) with a read
-- policy of `USING (bucket_id = 'chat-images')` — i.e. anyone, with no auth,
-- could fetch any object by URL. Chat *messages* are RLS-protected per club
-- channel, but their image *attachments* were world-readable to anyone who had
-- (or guessed) the object URL, defeating the channel access model.
--
-- This migration:
--   1. Flips the bucket to private, so objects are no longer served without a
--      signed URL / valid session. The app now mints short-lived signed URLs
--      client-side (components/chat/ChatImage.tsx) using the member's own
--      session, so only signed-in members can view attachments. The object path
--      carries an unguessable UUID and is only obtainable from a chat message the
--      viewer is RLS-permitted to read, so per-channel isolation is preserved.
--   2. Restricts the SELECT policy to the `authenticated` role (was public).
--   3. Adds bucket-level `file_size_limit` and `allowed_mime_types`. This is the
--      real server-side upload guard: uploads go straight to Storage from the
--      browser client, so client-side compression is bypassable — but Storage
--      itself rejects anything over the size cap or outside the mime allow-list.
--
-- Guarded + idempotent, matching the other migrations.

DO $mig$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE NOTICE 'private_chat_images skipped: storage schema not present';
    RETURN;
  END IF;

  -- 1 + 3: private bucket with size / mime constraints (2 MB, images only).
  UPDATE storage.buckets
  SET public = false,
      file_size_limit = 2097152,
      allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png']
  WHERE id = 'chat-images';

  -- 2: reads now require a valid authenticated session (was public/anon).
  DROP POLICY IF EXISTS chat_images_read ON storage.objects;
  CREATE POLICY chat_images_read ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'chat-images');
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'private_chat_images: insufficient privilege to alter storage; apply the bucket change manually in the dashboard.';
END;
$mig$;
