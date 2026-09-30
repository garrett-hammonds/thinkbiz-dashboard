import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import ProfileForm from '@/components/profile-form';
import MembershipCard from '@/components/MembershipCard';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { isBillingEnabled } from '@/lib/stripe/client';
import { isPaywallExempt } from '@/utils/membership';
import { DEFAULT_PREFS, type NotificationPrefs } from '@/components/NotificationSettings';
import DeleteAccountSection from '@/components/DeleteAccountSection';
import BlockedMembersSection, { type BlockedMember } from '@/components/BlockedMembersSection';
import { createAdminClient } from '@/utils/supabase/admin';
import Link from 'next/link';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const member = await getMemberForUser(supabase, user);

  if (!member) {
    redirect('/access-denied');
  }

  if (!member.profile_completed_at) {
    redirect('/onboarding');
  }

  // Load saved notification preferences; a missing row means the member has
  // never changed them, so fall back to the opt-out defaults (all on).
  const { data: prefsRow } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('member_id', member.id)
    .maybeSingle();

  // Members this member has blocked from DMing them (names via the service
  // role: a blocked member may be outside the viewer's club).
  const { data: blockRows } = await supabase
    .from('member_dm_blocks')
    .select('blocked_id')
    .eq('blocker_id', member.id);
  const blockedIds = (blockRows ?? []).map((b) => b.blocked_id as string);
  let blockedMembers: BlockedMember[] = [];
  if (blockedIds.length > 0) {
    const { data: blockedRows } = await createAdminClient()
      .from('members')
      .select('id, first_name, last_name')
      .in('id', blockedIds);
    blockedMembers = (blockedRows ?? []).map((m) => ({
      id: m.id as string,
      name: `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || 'Former member',
    }));
  }

  const prefs: NotificationPrefs = prefsRow
    ? {
        email_enabled: prefsRow.email_enabled,
        push_enabled: prefsRow.push_enabled,
        email_chat: prefsRow.email_chat,
        email_log_reminder: prefsRow.email_log_reminder,
        email_application: prefsRow.email_application,
        push_chat: prefsRow.push_chat,
        push_log_reminder: prefsRow.push_log_reminder,
        push_application: prefsRow.push_application,
      }
    : DEFAULT_PREFS;

  return (
      <main className="py-12 px-4 sm:px-6 lg:px-8">
        {isBillingEnabled() && (
          <div className="max-w-3xl mx-auto">
            <MembershipCard
              status={member.subscription_status ?? null}
              billable={!isPaywallExempt(member)}
              hasCustomer={!!member.stripe_customer_id}
              periodEnd={member.subscription_current_period_end ?? null}
            />
          </div>
        )}
        <ProfileForm member={member} prefs={prefs} />
        <div className="max-w-3xl mx-auto">
          <BlockedMembersSection initial={blockedMembers} />
          <DeleteAccountSection canDelete={!member.is_admin && !member.club_director} />
          <p className="text-center text-xs text-gray-400">
            <Link href="/privacy" className="hover:text-primary">Privacy Policy</Link>
            {' · '}
            <Link href="/terms" className="hover:text-primary">Terms of Use</Link>
            {' · '}
            <Link href="/support" className="hover:text-primary">Support</Link>
          </p>
        </div>
      </main>
  );
}
