import 'server-only';
import webpush from 'web-push';

// Web Push payload the service worker (public/sw.js) expects.
export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

export interface StoredSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const from = process.env.EMAIL_FROM || 'admin@thinkbiz.example';
  if (!publicKey || !privateKey) {
    console.warn('[push] VAPID keys not set; skipping push send.');
    return false;
  }
  // web-push wants a mailto: or https: subject. EMAIL_FROM may be a display-name
  // form ("ThinkBiz <a@b.com>"), so extract the bare address if present.
  const match = from.match(/<([^>]+)>/);
  const contact = match ? match[1] : from;
  webpush.setVapidDetails(`mailto:${contact}`, publicKey, privateKey);
  configured = true;
  return true;
}

export function isPushEnabled(): boolean {
  return !!process.env.VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;
}

export interface PushResult {
  ok: boolean;
  // Set when the endpoint is gone (404/410) and the subscription row should be pruned.
  stale: boolean;
}

// Sends one push. Never throws. Returns { stale: true } when the endpoint is
// expired/unsubscribed so the caller can delete the row.
export async function sendPush(sub: StoredSubscription, payload: PushPayload): Promise<PushResult> {
  if (!ensureConfigured()) return { ok: false, stale: false };
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    );
    return { ok: true, stale: false };
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number })?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      return { ok: false, stale: true };
    }
    console.error('[push] sendNotification failed:', err);
    return { ok: false, stale: false };
  }
}
