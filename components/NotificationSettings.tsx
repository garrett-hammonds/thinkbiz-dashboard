'use client';

import { useEffect, useState } from 'react';
import {
  isPushSupported,
  isStandalone,
  subscribeToPush,
  unsubscribeFromPush,
  getExistingSubscription,
} from '@/lib/notifications/push-client';

export interface NotificationPrefs {
  email_enabled: boolean;
  push_enabled: boolean;
  email_chat: boolean;
  email_log_reminder: boolean;
  email_application: boolean;
  push_chat: boolean;
  push_log_reminder: boolean;
  push_application: boolean;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  email_enabled: true,
  push_enabled: true,
  email_chat: true,
  email_log_reminder: true,
  email_application: true,
  push_chat: true,
  push_log_reminder: true,
  push_application: true,
};

const CATEGORIES: { key: string; label: string; emailField: keyof NotificationPrefs; pushField: keyof NotificationPrefs }[] = [
  { key: 'chat', label: 'Chat messages & mentions', emailField: 'email_chat', pushField: 'push_chat' },
  { key: 'log_reminder', label: 'Weekly log reminders', emailField: 'email_log_reminder', pushField: 'push_log_reminder' },
  { key: 'application', label: 'Application updates', emailField: 'email_application', pushField: 'push_application' },
];

// Rendered inside the profile <form>: the checkboxes ride the existing
// updateProfile submit (checked => present in FormData, unchecked => absent).
// The push button is a separate, client-only action (type="button").
export default function NotificationSettings({ prefs }: { prefs: NotificationPrefs }) {
  const [pushState, setPushState] = useState<
    'loading' | 'unsupported' | 'subscribed' | 'unsubscribed' | 'denied' | 'busy'
  >('loading');
  const [needsHomeScreen, setNeedsHomeScreen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!isPushSupported()) {
        // On iOS, push only works once installed to the Home Screen.
        const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
        if (active) {
          setNeedsHomeScreen(iOS && !isStandalone());
          setPushState('unsupported');
        }
        return;
      }
      const existing = await getExistingSubscription();
      if (active) setPushState(existing ? 'subscribed' : 'unsubscribed');
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleEnable = async () => {
    setPushState('busy');
    const result = await subscribeToPush();
    if (result.ok) {
      setPushState('subscribed');
    } else if (result.reason === 'denied') {
      setPushState('denied');
    } else {
      setPushState('unsubscribed');
    }
  };

  const handleDisable = async () => {
    setPushState('busy');
    await unsubscribeFromPush();
    setPushState('unsubscribed');
  };

  return (
    <div className="space-y-6">
      {/* Browser push enrollment (separate from the saved preferences below) */}
      <div className="rounded-lg bg-gray-50 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-900">Browser push notifications</p>
            <p className="text-sm text-gray-500">
              {pushState === 'subscribed'
                ? 'This browser is set up to receive push notifications.'
                : 'Get notified in this browser even when the dashboard is closed.'}
            </p>
          </div>
          {pushState === 'subscribed' ? (
            <button
              type="button"
              onClick={handleDisable}
              className="shrink-0 rounded-lg border-2 border-primary text-primary hover:bg-primary hover:text-white px-4 py-2 text-sm font-semibold"
            >
              Disable on this device
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEnable}
              disabled={pushState === 'unsupported' || pushState === 'busy' || pushState === 'loading'}
              className="shrink-0 rounded-lg bg-primary text-white hover:bg-secondary px-4 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pushState === 'busy' ? 'Enabling…' : 'Enable push'}
            </button>
          )}
        </div>
        {pushState === 'denied' && (
          <p className="mt-3 text-sm text-red-700">
            Notifications are blocked for this site. Allow them in your browser settings, then try again.
          </p>
        )}
        {pushState === 'unsupported' && needsHomeScreen && (
          <p className="mt-3 text-sm text-gray-600">
            On iPhone or iPad, add this site to your Home Screen first (Share → Add to Home Screen), then
            open it from there to enable push.
          </p>
        )}
        {pushState === 'unsupported' && !needsHomeScreen && (
          <p className="mt-3 text-sm text-gray-600">This browser doesn&apos;t support push notifications.</p>
        )}
      </div>

      {/* Per-category preferences (saved with the profile form) */}
      <div>
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Notify me about</span>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 text-center w-16">Email</span>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 text-center w-16">Push</span>

          {/* Master switches — turning one off mutes that channel entirely. */}
          <Row label="All notifications" emailField="email_enabled" pushField="push_enabled" prefs={prefs} bold />

          {CATEGORIES.map((cat) => (
            <Row key={cat.key} label={cat.label} emailField={cat.emailField} pushField={cat.pushField} prefs={prefs} />
          ))}
        </div>
        <p className="mt-4 text-xs text-gray-400">
          Chat: you&apos;ll get a push for any new message in your channels, and an email only when someone
          @-mentions you.
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  emailField,
  pushField,
  prefs,
  bold,
}: {
  label: string;
  emailField: keyof NotificationPrefs;
  pushField: keyof NotificationPrefs;
  prefs: NotificationPrefs;
  bold?: boolean;
}) {
  return (
    <>
      <span className={`text-sm text-gray-900${bold ? ' font-semibold' : ''}`}>{label}</span>
      <span className="text-center w-16">
        <input
          type="checkbox"
          name={emailField}
          defaultChecked={prefs[emailField]}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
      </span>
      <span className="text-center w-16">
        <input
          type="checkbox"
          name={pushField}
          defaultChecked={prefs[pushField]}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
      </span>
    </>
  );
}
