'use client';

// Native push enrollment for the Capacitor shell, shared by the first-launch
// prompt (NativeBridge), the profile notification settings, and the
// getting-started checklist. The browser equivalent lives in
// lib/notifications/push-client.ts; NotificationSettings picks one by host.

import { registerNativePushToken, removeNativePushToken } from '@/app/actions/nativePush';
import { getPlugin, platform, PREF_PUSH_TOKEN, PUSH_CHANNEL_ID } from '@/lib/native/bridge';

export type NativeEnrollResult =
  | 'granted' // permission granted and the token is registered
  | 'denied'
  | 'prompt' // the person dismissed the sheet without deciding
  | 'unauthenticated' // permission granted, but no session yet to register against
  | 'unsupported'; // the messaging plugin is not in this build

export function isNativePushSupported(): boolean {
  return getPlugin('FirebaseMessaging') !== null;
}

// Android shows notifications only on an existing channel; iOS ignores this.
export async function ensurePushChannel(): Promise<void> {
  if (platform() !== 'android') return;
  try {
    await getPlugin('FirebaseMessaging')?.createChannel({
      id: PUSH_CHANNEL_ID,
      name: 'ThinkBiz notifications',
      description: 'Chat messages, weekly log reminders, and application updates',
      importance: 4,
    });
  } catch {
    // The channel already exists or the platform has no channels.
  }
}

// Registers an FCM token with the server and remembers it on the device only
// once the server accepted it, so a signed-out attempt retries on the next
// signed-in load.
export async function syncNativeToken(token: string): Promise<'ok' | 'unauthenticated' | 'error'> {
  const prefs = getPlugin('Preferences');
  const stored = prefs ? (await prefs.get({ key: PREF_PUSH_TOKEN })).value : null;
  if (stored === token) return 'ok';
  const result = await registerNativePushToken({ platform: platform(), token });
  if (result.success) {
    await prefs?.set({ key: PREF_PUSH_TOKEN, value: token });
    return 'ok';
  }
  return result.reason === 'unauthenticated' ? 'unauthenticated' : 'error';
}

// Asks the OS for permission (a no-op if already decided), fetches the FCM
// token, and registers it.
export async function enrollNativePush(): Promise<NativeEnrollResult> {
  const push = getPlugin('FirebaseMessaging');
  if (!push) return 'unsupported';
  await ensurePushChannel();
  const perm = await push.requestPermissions();
  if (perm.receive === 'denied') return 'denied';
  if (perm.receive !== 'granted') return 'prompt';
  const { token } = await push.getToken();
  if (!token) throw new Error('The phone did not return a push token.');
  const synced = await syncNativeToken(token);
  if (synced === 'unauthenticated') return 'unauthenticated';
  if (synced === 'error') throw new Error('Could not save the enrollment.');
  return 'granted';
}

// Whether this phone currently holds a registered token (permission granted
// and the server accepted it at some point).
export async function hasNativeEnrollment(): Promise<boolean> {
  const push = getPlugin('FirebaseMessaging');
  const prefs = getPlugin('Preferences');
  if (!push || !prefs) return false;
  try {
    const perm = await push.checkPermissions();
    if (perm.receive !== 'granted') return false;
    return !!(await prefs.get({ key: PREF_PUSH_TOKEN })).value;
  } catch {
    return false;
  }
}

// Turns push off for this phone: forgets the token server-side and locally,
// and invalidates it with Firebase so a stale copy can never deliver.
export async function unenrollNativePush(): Promise<void> {
  const push = getPlugin('FirebaseMessaging');
  const prefs = getPlugin('Preferences');
  const stored = prefs ? (await prefs.get({ key: PREF_PUSH_TOKEN })).value : null;
  if (stored) await removeNativePushToken(stored).catch(() => undefined);
  await prefs?.remove({ key: PREF_PUSH_TOKEN });
  await push?.deleteToken().catch(() => undefined);
}
