'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  absolute,
  detectHost,
  getPlugin,
  hostAdapter,
  platform,
  NATIVE_SCHEME,
  PREF_PUSH_ASKED,
  PREF_PUSH_TOKEN,
} from '@/lib/native/bridge';
import { enrollNativePush, ensurePushChannel, syncNativeToken } from '@/lib/native/push';

// Mounted once from the root layout. In a browser it renders nothing and does
// nothing. Inside the Capacitor shell it wires the native events the pages
// rely on: notification taps, universal links and the custom-scheme return,
// the Android back button, off-origin links, status bar and splash screen.
//
// Push permission is asked once, on the first launch after sign-in; after
// that this component keeps a granted token registered and fresh across
// sign-ins, reinstalls and app updates. The profile page covers a change of
// mind (NotificationSettings).
export default function NativeBridge() {
  const router = useRouter();

  useEffect(() => {
    if (detectHost() !== 'capacitor') return;
    const handles: Array<{ remove(): Promise<void> | void }> = [];
    const root = document.documentElement;
    root.dataset.native = platform();

    // Chrome: dark status-bar icons on our light header, splash away as soon
    // as we have painted.
    getPlugin('StatusBar')?.setStyle({ style: 'LIGHT' }).catch(() => undefined);
    if (platform() === 'android') {
      getPlugin('StatusBar')?.setBackgroundColor({ color: '#ffffff' }).catch(() => undefined);
    }
    getPlugin('SplashScreen')?.hide().catch(() => undefined);

    // Route an incoming URL (universal link, custom scheme) inside the app.
    function handleUrl(raw: string | undefined | null) {
      if (!raw) return;
      let url: URL;
      try {
        url = new URL(raw);
      } catch {
        return;
      }
      if (url.protocol === `${NATIVE_SCHEME}:`) {
        // thinkbiz://return?to=/dashboard — back from the system browser
        // (Stripe). Close the in-app browser if it is still up, then land on
        // the page the flow asked for (or re-render the current one).
        getPlugin('Browser')?.close().catch(() => undefined);
        const to = url.searchParams.get('to');
        if (to && to.startsWith('/') && !to.startsWith('//')) window.location.assign(to);
        else router.refresh();
        return;
      }
      if (url.origin === window.location.origin) {
        const target = url.pathname + url.search + url.hash;
        const current = window.location.pathname + window.location.search + window.location.hash;
        if (target !== current) window.location.assign(target);
      }
    }

    const app = getPlugin('App');
    if (app) {
      app.getLaunchUrl().then((r) => handleUrl(r?.url)).catch(() => undefined);
      Promise.resolve(app.addListener('appUrlOpen', (e) => handleUrl(e.url))).then((h) =>
        handles.push(h),
      );
      Promise.resolve(
        app.addListener('backButton', ({ canGoBack }) => {
          if (canGoBack && window.history.length > 1) window.history.back();
          else app.minimizeApp();
        }),
      ).then((h) => handles.push(h));
      // Returning to the foreground: server components re-render so a payment
      // made in the system browser, or a chat message that arrived while the
      // app was backgrounded, shows without a manual reload.
      Promise.resolve(
        app.addListener('appStateChange', ({ isActive }) => {
          if (isActive) router.refresh();
        }),
      ).then((h) => handles.push(h));
    }

    // Notification taps open the route the server put in data.url.
    const push = getPlugin('FirebaseMessaging');
    if (push) {
      Promise.resolve(
        push.addListener('notificationActionPerformed', ({ notification }) => {
          const target = notification.data?.url || '/dashboard';
          if (target.startsWith('/')) window.location.assign(target);
        }),
      ).then((h) => handles.push(h));

      // Permission is asked once, on the first launch. A granted permission
      // is the opt-in: the token registers as soon as a session exists (the
      // first attempt on the sign-in page fails with "unauthenticated" and
      // simply retries on the next load or the next return to the foreground).
      async function ensureEnrolled() {
        const prefs = getPlugin('Preferences');
        const asked = prefs ? (await prefs.get({ key: PREF_PUSH_ASKED })).value : '1';
        if (!asked) {
          await prefs?.set({ key: PREF_PUSH_ASKED, value: '1' });
          await enrollNativePush().catch(() => undefined);
          return;
        }
        const p = await push!.checkPermissions();
        if (p.receive !== 'granted') return;
        const stored = prefs ? (await prefs.get({ key: PREF_PUSH_TOKEN })).value : null;
        if (!stored) await enrollNativePush().catch(() => undefined);
      }
      ensureEnrolled()
        .then(async () => {
          const p = await push.checkPermissions();
          if (p.receive !== 'granted') return;
          await ensurePushChannel();
          // FCM rotates tokens after reinstalls and restores; keep the server's
          // copy current without prompting.
          handles.push(
            await push.addListener('tokenReceived', ({ token }) => void syncNativeToken(token)),
          );
          const { token } = await push.getToken();
          await syncNativeToken(token);
        })
        .catch(() => undefined);
      if (app) {
        Promise.resolve(
          app.addListener('appStateChange', ({ isActive }) => {
            if (isActive) void ensureEnrolled().catch(() => undefined);
          }),
        ).then((h) => handles.push(h));
      }
    }

    // Links that leave the app's origin (member websites, LinkedIn, booking
    // calendars, chat image originals) open in the system browser instead of
    // navigating the WebView away from the app.
    async function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const href = anchor.getAttribute('href') || '';
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      const url = new URL(anchor.href, window.location.origin);
      if (url.origin !== window.location.origin || anchor.target === '_blank') {
        event.preventDefault();
        await hostAdapter().openExternal(absolute(url.toString()));
      }
    }
    document.addEventListener('click', onClick, true);

    return () => {
      document.removeEventListener('click', onClick, true);
      handles.forEach((h) => Promise.resolve(h.remove()).catch(() => undefined));
      delete root.dataset.native;
    };
  }, [router]);

  return null;
}
