'use client';

import { CheckCircle2 } from 'lucide-react';
import { useIsNative } from '@/lib/native/useIsNative';
import CheckoutButton from './CheckoutButton';

const PERKS = [
  'Full access to your club dashboard and success metrics',
  'Member chat and your club directory',
  'Weekly activity logging and reminders',
];

// The paywall body. Inside the iOS / Android app there is no way to buy or
// start a membership (App Store Guideline 3.1.1): no checkout button, no
// perks pitch, no pointer to the website. The member just sees that their
// membership isn't active. On the web it's the normal Stripe checkout.
export default function MembershipOffer({
  firstName,
  processing,
  canceled,
}: {
  firstName: string | null;
  processing: boolean;
  canceled: boolean;
}) {
  const native = useIsNative();

  // Host not known yet (server render / hydration): render nothing rather
  // than flash the checkout inside the app.
  if (native === null) return <div className="min-h-64" />;

  if (native) {
    return (
      <>
        <h1 className="text-3xl font-bold leading-snug text-foreground text-center mb-2">
          Membership not active
        </h1>
        <p className="text-sm text-gray-500 text-center">
          {firstName ? `${firstName}, your` : 'Your'} profile is all set, but your ThinkBiz
          membership isn&apos;t active yet. Please reach out to your club director if you have
          any questions.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-bold leading-snug text-foreground text-center mb-2">
        Start your membership
      </h1>
      <p className="text-sm text-gray-500 text-center mb-6">
        {firstName ? `${firstName}, your` : 'Your'} profile is all set. Activate
        your membership to unlock the app.
      </p>

      {processing && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-700">
          We&apos;re still confirming your payment. If you just paid, give it a moment and refresh.
        </div>
      )}
      {canceled && (
        <div className="mb-4 rounded-lg bg-gray-50 px-4 py-3 text-center text-sm font-medium text-gray-600">
          Checkout was canceled. You can start again whenever you&apos;re ready.
        </div>
      )}

      <ul className="mb-6 space-y-3">
        {PERKS.map((perk) => (
          <li key={perk} className="flex items-start gap-3 text-sm text-gray-700">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
            <span>{perk}</span>
          </li>
        ))}
      </ul>

      <CheckoutButton />

      <p className="mt-4 text-center text-xs text-gray-400">
        Secure checkout powered by Stripe. You can cancel anytime from your profile.
      </p>
    </>
  );
}
