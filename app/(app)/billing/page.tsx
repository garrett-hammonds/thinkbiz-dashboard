import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { logout } from '@/app/actions/profile';
import { isBillingEnabled } from '@/lib/stripe/client';
import { reconcileMemberSubscription } from '@/lib/stripe/reconcile';
import { isMemberPaid, isPaywallExempt } from '@/utils/membership';
import MembershipOffer from './MembershipOffer';

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

  // Already paid, exempt (admin/director/comped), or billing isn't configured —
  // there's nothing to pay for here.
  if (isMemberPaid(member) || isPaywallExempt(member) || !isBillingEnabled()) {
    redirect('/dashboard');
  }

  // Before showing the paywall, check whether this member is ALREADY subscribed
  // in Stripe (e.g. a pre-existing GoHighLevel subscription on the same account)
  // and just isn't linked yet. If so, link it and let them straight in — no one
  // who's already paying should ever be asked to pay again.
  if (await reconcileMemberSubscription(member)) {
    redirect('/dashboard');
  }

  const canceled = status === 'canceled';
  const processing = status === 'processing';

  return (
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl border border-gray-100 shadow-card p-8">
          <MembershipOffer
            firstName={member.first_name ?? null}
            processing={processing}
            canceled={canceled}
          />

          <form action={logout} className="mt-6 text-center">
            <button type="submit" className="text-sm text-gray-500 transition-colors hover:text-primary">
              Log out
            </button>
          </form>
        </div>
      </main>
  );
}
