'use client';

import { useEffect } from 'react';
import { registerServiceWorker } from '@/lib/notifications/push-client';

// Registers the push service worker once for signed-in users. Mounted in the
// Navbar (which only renders on authenticated pages), so it never runs on /login.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      registerServiceWorker();
    }
  }, []);

  return null;
}
