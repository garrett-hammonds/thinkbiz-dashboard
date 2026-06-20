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

export interface PushDiagnosticResult {
  ok: boolean;
  // HTTP status from the push service: 201 = accepted, 403/401 = VAPID
  // mismatch, 404/410 = expired endpoint.
  statusCode?: number;
  error?: string;
}

// Like sendPush but surfaces the push service's status code and error body for
// debugging. Used by the admin test-push endpoint; not part of the normal flow.
export async function sendPushDiagnostic(
  sub: StoredSubscription,
  payload: PushPayload,
): Promise<PushDiagnosticResult> {
  if (!ensureConfigured()) {
    return { ok: false, error: 'VAPID keys not set on the server' };
  }
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    );
    return { ok: true, statusCode: 201 };
  } catch (err: unknown) {
    const e = err as { statusCode?: number; body?: string; message?: string };
    return {
      ok: false,
      statusCode: e?.statusCode,
      error: (e?.body || e?.message || 'unknown error').toString().slice(0, 300),
    };
  }
}
