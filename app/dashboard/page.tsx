import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { getActiveClubId } from '@/utils/activeClub';
import { membershipGateRedirect } from '@/utils/membership';

import { Navbar } from "@/components/navbar";
import { Scorecards } from "@/components/scorecards";
import { DashboardCharts } from "@/components/dashboard-charts";
import DashboardEmptyState from "@/components/DashboardEmptyState";
import GettingStartedBanner from "@/components/GettingStartedBanner";
import FlashMessage from "@/components/FlashMessage";
import type { WeeklyLog, RevenueLog } from "@/lib/types/metrics";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const memberData = await getMemberForUser(supabase, user);

  if (!memberData) {
    redirect('/access-denied');
  }

  if (!memberData.profile_completed_at) {
    redirect('/onboarding');
  }

  const gate = membershipGateRedirect(memberData);
  if (gate) {
    redirect(gate);
  }

  const member = memberData;

  // Only the columns the scorecards and charts actually read — avoids shipping
  // every weekly_logs column (ids, referrals_given, etc.) over the wire.
  const LOG_COLUMNS = 'visitors_brought, one_on_ones_had, week_ending, created_at';

  const logsPromise = supabase
    .from('weekly_logs')
    .select(LOG_COLUMNS)
    .eq('member_id', member.id);

  const revenuePromise = supabase
    .from('closed_business_thanks')
    .select('revenue_amount, created_at')
    .eq('thanking_member_id', member.id);
  
  const [{ data: logsData }, { data: revenueData }] = await Promise.all([
    logsPromise,
    revenuePromise
  ]);

  const logs = (logsData ?? []) as WeeklyLog[];
  const revenue = (revenueData ?? []) as RevenueLog[];

  // Admins can switch which club they're viewing; everyone else sees their own.
  const activeClubId = await getActiveClubId(member);

  let clubName = '';
  let clubLogs: WeeklyLog[] = [];
  let clubRevenue: RevenueLog[] = [];

  if (activeClubId) {
    // An admin viewing a club other than their own would be blanked out by the
    // member-scoped RLS on weekly_logs/closed_business_thanks, so route their
    // cross-club reads through the service-role client (same approach as the
    // roster). Directors read their own club via the normal user client.
    const clubReader =
      member.is_admin && process.env.SUPABASE_SERVICE_ROLE_KEY
        ? createAdminClient()
        : supabase;

    const { data: clubData } = await clubReader
      .from('clubs')
      .select('start_time, display_name')
      .eq('id', activeClubId)
      .single();

    if (clubData) {
      clubName = `${clubData.start_time} ${clubData.display_name}`;
    }

    const clubLogsPromise = clubReader
    .from('weekly_logs')
    .select(LOG_COLUMNS)
    .eq('club_id', activeClubId);

    const clubRevenuePromise = clubReader
      .from('closed_business_thanks')
      .select('revenue_amount, created_at, weekly_logs!inner(club_id)')
      .eq('weekly_logs.club_id', activeClubId);

    const [{ data: cLogs }, { data: cRevenue }] = await Promise.all([
      clubLogsPromise,
      clubRevenuePromise
    ]);

    if (cLogs) clubLogs = cLogs;
    if (cRevenue) clubRevenue = cRevenue;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {member ? `Welcome back, ${member.first_name}` : 'Dashboard'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your ThinkBiz performance at a glance.
          </p>
        </div>

        <FlashMessage message={message} />

        <GettingStartedBanner hasLoggedSuccess={logs.length > 0} />

        {logs.length === 0 && revenue.length === 0 ? (
          // Brand-new member: no logs and no revenue yet. A guided empty state
          // converts far better than four $0 cards and four empty charts.
          <section aria-label="Get started" className="mb-8">
            <DashboardEmptyState />
          </section>
        ) : (
          <>
            <section aria-label="Key metrics" className="mb-8">
              <Scorecards logsData={logs} revenueData={revenue} />
            </section>

            <section aria-label="Monthly trends" className="mb-8">
              <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
                Monthly trends · last 12 months
              </h2>
              <DashboardCharts data={logs} revenueData={revenue} />
            </section>
          </>
        )}

        {activeClubId && (
          <div className="mt-16 border-t border-gray-200 pt-12">
            <h2 className="text-3xl font-bold leading-snug text-foreground mb-8">
              Club stats for {clubName}
            </h2>
            
            <Scorecards logsData={clubLogs} revenueData={clubRevenue} />
            
            <div className="mt-8">
              <DashboardCharts data={clubLogs} revenueData={clubRevenue} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}