'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, CreditCard, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { createBillingPortalSession } from '@/app/(app)/billing/actions';

interface MembershipCardProps {
  status: string | null;
  // Regular members are billed; directors/admins aren't.
  billable: boolean;
  // Whether the member has a Stripe customer yet (can open the portal).
  hasCustomer: boolean;
  periodEnd: string | null;
}

const ACTIVE = ['active', 'trialing'];

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function MembershipCard({ status, billable, hasCustomer, periodEnd }: MembershipCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = !!status && ACTIVE.includes(status);
  const isPastDue = status === 'past_due' || status === 'unpaid' || status === 'incomplete';
  const renews = formatDate(periodEnd);

  async function openPortal() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await createBillingPortalSession();
      if (res.url) {
        window.location.href = res.url; // keep spinner through the redirect
        return;
      }
      setError(res.error || 'Could not open the billing portal. Please try again.');
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-card p-8 mb-6">
      <h3 className="text-2xl font-bold leading-snug text-foreground mb-6">Membership</h3>

      {!billable ? (
        <p className="text-sm text-gray-500">
          As a director, your membership isn&apos;t billed — there&apos;s nothing to manage here.
        </p>
      ) : (
        <>
          <div className="mb-6 flex items-center gap-3">
            <StatusBadge isActive={isActive} isPastDue={isPastDue} />
            {isActive && renews && (
              <span className="text-sm text-gray-500">
                {status === 'trialing' ? 'Trial ends' : 'Renews'} {renews}
              </span>
            )}
          </div>

          {isPastDue && (
            <p className="mb-4 text-sm text-red-700">
              Your last payment didn&apos;t go through. Update your card to keep your membership active.
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            {hasCustomer && (
              <button
                type="button"
                onClick={openPortal}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-secondary focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
                {loading ? 'Opening…' : 'Manage membership'}
              </button>
            )}

            {!isActive && (
              <Link
                href="/billing"
                className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-primary px-6 py-3 font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
              >
                {hasCustomer ? 'Restart membership' : 'Start membership'}
              </Link>
            )}
          </div>

          {hasCustomer && (
            <p className="mt-4 text-xs text-gray-400">
              Update your card, add a backup payment method, view invoices, or cancel — all in the
              secure Stripe portal.
            </p>
          )}

          {error && <p className="mt-4 text-sm font-medium text-destructive">{error}</p>}
        </>
      )}
    </div>
  );
}

function StatusBadge({ isActive, isPastDue }: { isActive: boolean; isPastDue: boolean }) {
  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
        <CheckCircle2 className="h-4 w-4" />
        Active
      </span>
    );
  }
  if (isPastDue) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700">
        <AlertCircle className="h-4 w-4" />
        Payment past due
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
      <Clock className="h-4 w-4" />
      No active membership
    </span>
  );
}
