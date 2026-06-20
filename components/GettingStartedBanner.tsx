'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Rocket, X } from 'lucide-react';
import {
  isPushSupported,
  isStandalone,
  getExistingSubscription,
} from '@/lib/notifications/push-client';

const DISMISS_KEY = 'tb_getting_started_dismissed';

// Lightweight prompt on the dashboard nudging members toward the getting-started
// checklist. Hides itself once every step is done (profile is already complete
// by the time the dashboard renders, so we only re-check the steps that can
// still be outstanding) or after the member dismisses it.
export default function GettingStartedBanner({
  hasLoggedSuccess,
}: {
  hasLoggedSuccess: boolean;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    let active = true;
    (async () => {
      const installed = isStandalone();
      const pushOn = isPushSupported() ? await getExistingSubscription() : false;
      const allDone = hasLoggedSuccess && installed && pushOn;
      if (active && !allDone) setShow(true);
    })();
    return () => {
      active = false;
    };
  }, [hasLoggedSuccess]);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setShow(false);
  };

  return (
    <div className="mb-8 flex items-center gap-4 rounded-xl border-t-4 border-primary bg-white p-5 shadow-card">
      <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:flex">
        <Rocket className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">Finish setting up your account</p>
        <p className="mt-0.5 text-sm text-gray-500">
          Add ThinkBiz to your phone, turn on push notifications, and log your
          first numbers — it only takes a couple of minutes.
        </p>
      </div>
      <Link
        href="/getting-started"
        className="hidden shrink-0 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-secondary sm:inline-flex"
      >
        Get started
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
