'use client';

// Browser-side Web Push helpers used by the profile notification settings.
//
// Flow: registerServiceWorker() -> subscribeToPush() asks the browser for
// permission, creates a PushSubscription with the VAPID public key, and persists
// it via the savePushSubscription server action.

import { savePushSubscription, removePushSubscription } from '@/app/actions/pushSubscription';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export type PushSupport = 'supported' | 'unsupported';

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// iOS Safari only delivers web push when the site is installed to the Home Screen
// (running in standalone display mode). Used to show the "Add to Home Screen" hint.
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    // iOS-specific flag
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (err) {
    console.error('[push-client] SW registration failed:', err);
    return null;
  }
}

export interface SubscribeResult {
  ok: boolean;
  reason?: 'unsupported' | 'denied' | 'no-key' | 'error';
}

export async function subscribeToPush(): Promise<SubscribeResult> {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  if (!VAPID_PUBLIC_KEY) {
    console.error('[push-client] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set.');
    return { ok: false, reason: 'no-key' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'denied' };

  const registration = (await navigator.serviceWorker.ready) || (await registerServiceWorker());
  if (!registration) return { ok: false, reason: 'error' };

  try {
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, reason: 'error' };
    }

    const result = await savePushSubscription({
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      userAgent: navigator.userAgent,
    });
    return { ok: result.success, reason: result.success ? undefined : 'error' };
  } catch (err) {
    console.error('[push-client] subscribe failed:', err);
    return { ok: false, reason: 'error' };
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await removePushSubscription(endpoint);
    }
  } catch (err) {
    console.error('[push-client] unsubscribe failed:', err);
  }
}

export async function getExistingSubscription(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}
