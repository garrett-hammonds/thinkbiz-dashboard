'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WifiOff } from 'lucide-react';
import { detectHost, getPlugin } from '@/lib/native/bridge';

// Connectivity notice for the native shell. A cold start with no network is
// handled by the shell's bundled offline page (www/error.html); this covers
// the mid-session drop, and refreshes the server render when the connection
// returns. Renders nothing in a browser.
export default function OfflineBanner() {
  const router = useRouter();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (detectHost() !== 'capacitor') return;
    const network = getPlugin('Network');
    if (!network) return;
    let handle: { remove(): Promise<void> | void } | null = null;
    network.getStatus().then((s) => setOffline(!s.connected)).catch(() => undefined);
    Promise.resolve(
      network.addListener('networkStatusChange', ({ connected }) => {
        setOffline((was) => {
          if (was && connected) router.refresh();
          return !connected;
        });
      }),
    ).then((h) => {
      handle = h;
    });
    return () => {
      if (handle) Promise.resolve(handle.remove()).catch(() => undefined);
    };
  }, [router]);

  if (!offline) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[60] flex items-center justify-center gap-2 bg-foreground px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-sm font-medium text-white"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      You&apos;re offline. Changes won&apos;t save until the connection returns.
    </div>
  );
}
