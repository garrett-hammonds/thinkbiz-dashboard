import { redirect } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { logout } from '@/app/actions/profile';
import { isBillingEnabled } from '@/lib/stripe/client';
import { isMemberPaid } from '@/utils/membership';
import { Navbar } from '@/components/navbar';
import CheckoutButton from './CheckoutButton';

const PERKS = [
  'Full access to your club dashboard and success metrics',
  'Member chat and your club directory',
  'Weekly activity logging and reminders',
];

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const member = await getMemberForUser(supabase, user);
  if (!member) redirect('/access-denied');

  // Onboarding still comes first.
  if (!member.profile_completed_at) redirect('/onboarding');

  // Already paid, or billing isn't configured — there's nothing to pay for here.
  if (isMemberPaid(member) || !isBillingEnabled()) {
    redirect('/dashboard');
  }

  const canceled = status === 'canceled';
  const processing = status === 'processing';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl border border-gray-100 shadow-card p-8">
          <h1 className="text-3xl font-bold leading-snug text-foreground text-center mb-2">
            Start your membership
          </h1>
          <p className="text-sm text-gray-500 text-center mb-6">
            {member.first_name ? `${member.first_name}, your` : 'Your'} profile is all set. Activate
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

          <form action={logout} className="mt-6 text-center">
            <button type="submit" className="text-sm text-gray-500 transition-colors hover:text-primary">
              Log out
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
