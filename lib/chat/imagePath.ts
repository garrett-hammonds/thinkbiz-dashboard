// Chat image attachments are stored in the (now private) `chat-images` bucket.
//
// The value persisted on `chat_messages.image_url` comes in two shapes:
//   - New messages store the raw object path: "<authUserId>/<uuid>.webp".
//   - Legacy messages (from when the bucket was public) stored the full public
//     URL: "https://<proj>.supabase.co/storage/v1/object/public/chat-images/<path>".
//
// Both need to resolve to the same object path so we can mint a signed URL for
// either. This extracts that path.
export function chatImageStoragePath(stored: string): string {
  const marker = '/chat-images/';
  const idx = stored.indexOf(marker);
  if (idx !== -1) {
    // Drop any query string a legacy URL might carry.
    return stored.slice(idx + marker.length).split('?')[0];
  }
  return stored;
}
