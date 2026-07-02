// Normalizes a caller-supplied `next` redirect target to a safe in-app path.
//
// The auth email flow (callback → confirm) forwards a `next` query param so a
// link can land the member on, say, /update-password after verifying. Because
// that param rides on a link an attacker can craft (append `&next=…` to a real
// magic/recovery link), it must never be trusted as-is.
//
// The subtle case is a PROTOCOL-RELATIVE URL: `//evil.com` and `/\evil.com`
// both start with `/`, so a naive `startsWith('/')` check accepts them, yet the
// browser resolves them to an EXTERNAL origin — an open-redirect / phishing
// primitive. We therefore require a single leading `/` that is NOT followed by
// another `/` or a backslash, and reject everything else back to the default.
//
// A value that arrives still-encoded (older emails double-encoded the link, so
// `next` shows up as "%2Fupdate-password") is decoded once before checking, so
// those links keep working instead of silently falling back to the default.
export function safeNextPath(raw: string | null | undefined, fallback = '/dashboard'): string {
  let value = (raw ?? '').trim();

  // Decode a single layer of encoding for legacy double-encoded links.
  if (value && !value.startsWith('/')) {
    try {
      value = decodeURIComponent(value);
    } catch {
      // Malformed encoding — fall through to the fallback below.
    }
  }

  // Must be a same-origin absolute path: exactly one leading slash, and the
  // next character must not turn it into a protocol-relative ("//") or
  // backslash-tricked ("/\") external URL.
  if (value.length >= 2 && value[0] === '/' && value[1] !== '/' && value[1] !== '\\') {
    return value;
  }

  // A bare "/" is fine too, but anything else (external, empty, "//…") is not.
  return fallback;
}
