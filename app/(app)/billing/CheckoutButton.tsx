'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createCheckoutSession } from './actions';
import { isNative, hostAdapter } from '@/lib/native/bridge';

export default function CheckoutButton({ label = 'Start your membership' }: { label?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      // Inside the iOS / Android app, Checkout runs in the system browser and
      // hands focus back through the app's custom scheme when it finishes.
      const native = isNative();
      const result = await createCheckoutSession({ native });
      if (result.url) {
        if (native) {
          await hostAdapter().openExternal(result.url);
          setLoading(false);
          return;
        }
        window.location.href = result.url;
        return; // keep the spinner up through the redirect
      }
      setError(result.error || 'Could not start checkout. Please try again.');
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-white transition-colors duration-200 hover:bg-secondary focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading && <Loader2 className="h-5 w-5 animate-spin" />}
        {loading ? 'Redirecting to secure checkout…' : label}
      </button>
      {error && <p className="text-center text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}
