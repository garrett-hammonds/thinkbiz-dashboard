'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

// Surfaces the `?message=` redirects that server actions emit after a write
// (e.g. submitLogAction). The dashboard and log pages previously redirected
// with a message that was never rendered, so members got no confirmation that
// their log saved — or that it failed. This renders a dismissible banner and
// strips the param from the URL so a refresh doesn't replay the message.

type Tone = 'success' | 'warning' | 'error';

// Infer tone from the message text so existing redirect call sites don't need
// to pass an extra param. Failures read as errors, "already"/"existing" as
// informational warnings, everything else as success.
function toneFor(message: string): Tone {
  const m = message.toLowerCase();
  if (m.includes('fail') || m.includes('could not') || m.includes('error')) {
    return 'error';
  }
  if (m.includes('already') || m.includes('existing')) {
    return 'warning';
  }
  return 'success';
}

const TONE_STYLES: Record<Tone, { wrap: string; icon: React.ReactNode }> = {
  success: {
    wrap: 'border-l-4 border-primary bg-primary/5 text-foreground',
    icon: <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden="true" />,
  },
  warning: {
    wrap: 'border-l-4 border-accent bg-accent/10 text-foreground',
    icon: <Info className="h-5 w-5 text-yellow-600" aria-hidden="true" />,
  },
  error: {
    wrap: 'border-l-4 border-destructive bg-destructive/5 text-foreground',
    icon: <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />,
  },
};

export default function FlashMessage({ message }: { message?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  // Snapshot the message on first render. Stripping the `?message=` param below
  // re-renders the server page with no message, so we render from this local
  // copy rather than the prop — otherwise the banner would vanish instantly.
  const [text, setText] = useState(message ?? '');

  // Drop the query param once shown, so reloading or navigating back doesn't
  // replay a stale confirmation. No setState here — only a URL cleanup.
  useEffect(() => {
    if (message) {
      router.replace(pathname, { scroll: false });
    }
  }, [message, pathname, router]);

  if (!text) return null;

  const tone = toneFor(text);
  const styles = TONE_STYLES[tone];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mb-6 flex items-start gap-3 rounded-lg p-4 shadow-sm ${styles.wrap}`}
    >
      <span className="mt-0.5 shrink-0">{styles.icon}</span>
      <p className="min-w-0 flex-1 text-sm font-medium">{text}</p>
      <button
        type="button"
        onClick={() => setText('')}
        aria-label="Dismiss"
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
