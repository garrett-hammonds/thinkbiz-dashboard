import { isBillingEnabled } from '@/lib/stripe/client';

// A member counts as "paid" while their Stripe subscription is active or in a
// trial. Everything else (past_due, canceled, incomplete, unset) is unpaid.
export const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing'] as const;

export interface BillableMember {
  is_admin?: boolean | null;
  club_director?: boolean | null;
  subscription_status?: string | null;
}

export function isMemberPaid(member: BillableMember): boolean {
  return (
    !!member.subscription_status &&
    (ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(member.subscription_status)
  );
}

// The single source of truth for the membership paywall. Returns the path to
// redirect an unpaid member to, or null when they're allowed through.
//
// Three groups are never gated:
//   - everyone, when billing isn't configured yet (isBillingEnabled() === false),
//     so the app keeps working until you set the Stripe env vars;
//   - admins and club directors, who run the clubs and need roster/applications
//     access to chase down unpaid members (and shouldn't be billed themselves);
//   - members with an active/trialing subscription.
//
// Callers run this AFTER the profile-completion gate, so onboarding still comes
// first and the member has a profile before they're asked to pay.
export function membershipGateRedirect(member: BillableMember): string | null {
  if (!isBillingEnabled()) return null;
  if (member.is_admin || member.club_director) return null;
  if (isMemberPaid(member)) return null;
  return '/billing';
}
