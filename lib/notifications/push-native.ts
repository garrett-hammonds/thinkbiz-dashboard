import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PushPayload } from '@/lib/notifications/push-server';

// Native (iOS / Android) push delivery through Firebase Cloud Messaging.
// One Firebase project fronts both platforms: Android tokens are FCM tokens
// natively, and iOS tokens are FCM tokens that Firebase relays to APNs with
// the .p8 key uploaded in the Firebase console. The service-account JSON
// (FIREBASE_SERVICE_ACCOUNT_JSON) is the only credential this side needs.
// Without it native push is silently off, mirroring the VAPID guard in
// push-server.ts — browser push and email keep working.

export function isNativePushEnabled(): boolean {
  return !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
}

// Must match PUSH_CHANNEL_ID in lib/native/bridge.ts and the shell's manifest.
const ANDROID_CHANNEL_ID = 'thinkbiz-default';

// FCM error codes that mean "this token will never work again".
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

interface TokenRow {
  id: string;
  token: string;
}

// What the shell receives. `notification` drives the system banner on both
// platforms; `data` carries the in-app route the tap should open (the web
// app's NativeBridge reads data.url) and the dedupe tag.
export function buildFcmMessage(tokens: string[], payload: PushPayload) {
  const tag = payload.tag || '';
  return {
    tokens,
    notification: { title: payload.title, body: payload.body || '' },
    data: { url: payload.url || '/dashboard', tag },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          ...(tag ? { 'thread-id': tag } : {}),
        },
      },
    },
    android: {
      priority: 'high' as const,
      notification: {
        channelId: ANDROID_CHANNEL_ID,
        ...(tag ? { tag } : {}),
      },
    },
  };
}

type Messaging = import('firebase-admin/messaging').Messaging;
let messagingClient: Messaging | null | undefined;

// Lazy firebase-admin bootstrap; the SDK is only loaded when a credential is
// configured so builds and browser-push-only deployments never touch it.
async function getMessaging(): Promise<Messaging | null> {
  if (messagingClient !== undefined) return messagingClient;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    messagingClient = null;
    return messagingClient;
  }
  try {
    const credential = JSON.parse(raw);
    const admin = await import('firebase-admin/app');
    const messaging = await import('firebase-admin/messaging');
    const app = admin.getApps()[0] ?? admin.initializeApp({ credential: admin.cert(credential) });
    messagingClient = messaging.getMessaging(app);
  } catch (err) {
    console.error('[push-native] firebase-admin init failed:', err);
    messagingClient = null;
  }
  return messagingClient;
}

// Sends one payload to every phone enrolled for the given members. Dead tokens
// are pruned so the table never accumulates uninstalled phones. Never throws.
export async function sendNativePushes(
  admin: SupabaseClient,
  memberIds: string[],
  payload: PushPayload,
): Promise<number> {
  if (memberIds.length === 0) return 0;
  const client = await getMessaging();
  if (!client) return 0;

  const { data, error } = await admin
    .from('native_push_tokens')
    .select('id, token')
    .in('member_id', memberIds);
  if (error) {
    console.error('[push-native] token lookup failed:', error);
    return 0;
  }
  const rows = (data ?? []) as TokenRow[];
  if (rows.length === 0) return 0;

  let delivered = 0;
  const dead: string[] = [];
  const live: string[] = [];

  // FCM caps a multicast at 500 tokens.
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    try {
      const res = await client.sendEachForMulticast(buildFcmMessage(batch.map((r) => r.token), payload));
      res.responses.forEach((r, j) => {
        const row = batch[j];
        if (!row) return;
        if (r.success) {
          delivered += 1;
          live.push(row.id);
        } else if (r.error?.code && DEAD_TOKEN_CODES.has(r.error.code)) {
          dead.push(row.id);
        }
        // Other failures are transient; the in-app surfaces still carry the message.
      });
    } catch (err) {
      console.error('[push-native] sendEachForMulticast failed:', err);
    }
  }

  const now = new Date().toISOString();
  if (live.length > 0) {
    await admin.from('native_push_tokens').update({ last_used_at: now }).in('id', live);
  }
  if (dead.length > 0) {
    await admin.from('native_push_tokens').delete().in('id', dead);
  }
  return delivered;
}

export interface NativePushDiagnostic {
  platform: string;
  tokenPrefix: string;
  appVersion: string | null;
  ok: boolean;
  errorCode?: string;
  errorMessage?: string;
}

// Like sendNativePushes but for one member and with Firebase's verdict per
// token, for the admin debug route. Never prunes; a dead token is reported so
// the admin can see it rather than silently disappearing.
export async function sendNativePushDiagnostic(
  admin: SupabaseClient,
  memberId: string,
  payload: PushPayload,
): Promise<{ configured: boolean; results: NativePushDiagnostic[] }> {
  const client = await getMessaging();
  const { data } = await admin
    .from('native_push_tokens')
    .select('platform, token, app_version')
    .eq('member_id', memberId);
  const rows = (data ?? []) as { platform: string; token: string; app_version: string | null }[];
  const base = rows.map((r) => ({
    platform: r.platform,
    tokenPrefix: `${r.token.slice(0, 12)}…`,
    appVersion: r.app_version,
  }));
  if (!client) {
    return { configured: false, results: base.map((b) => ({ ...b, ok: false, errorCode: 'not-configured' })) };
  }
  if (rows.length === 0) return { configured: true, results: [] };
  try {
    const res = await client.sendEachForMulticast(buildFcmMessage(rows.map((r) => r.token), payload));
    return {
      configured: true,
      results: res.responses.map((r, i) => ({
        ...base[i],
        ok: r.success,
        errorCode: r.error?.code,
        errorMessage: r.error?.message,
      })),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { configured: true, results: base.map((b) => ({ ...b, ok: false, errorCode: 'send-failed', errorMessage: message })) };
  }
}
