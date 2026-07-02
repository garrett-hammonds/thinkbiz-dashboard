// Extracts the best-guess client IP from a request's headers for rate limiting.
// On Vercel, `x-forwarded-for` is a comma-separated list with the real client
// first. Falls back to `x-real-ip`, then a constant so a missing header buckets
// callers together rather than throwing.
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip')?.trim() || 'unknown';
}
