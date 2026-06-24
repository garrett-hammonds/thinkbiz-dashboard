import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getMemberForUser } from '@/utils/supabase/getMember';

import { Navbar } from "@/components/navbar";
import { Scorecards } from "@/components/scorecards";
import { DashboardCharts } from "@/components/dashboard-charts";
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

  const member = memberData;

  const logsPromise = supabase
    .from('weekly_logs')
    .select('*')
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

  let clubName = '';
  let clubLogs: WeeklyLog[] = [];
  let clubRevenue: RevenueLog[] = [];

  if (member?.current_club_id) {
    const { data: clubData } = await supabase
      .from('clubs')
      .select('start_time, display_name')
      .eq('id', member.current_club_id)
      .single();
    
    if (clubData) {
      clubName = `${clubData.start_time} ${clubData.display_name}`;
    }

    const clubLogsPromise = supabase
    .from('weekly_logs')
    .select('*')
    .eq('club_id', member.current_club_id);

    const clubRevenuePromise = supabase
      .from('closed_business_thanks')
      .select('revenue_amount, created_at, weekly_logs!inner(club_id)')
      .eq('weekly_logs.club_id', member.current_club_id);

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

        <section aria-label="Key metrics" className="mb-8">
          <Scorecards logsData={logs} revenueData={revenue} />
        </section>

        <section aria-label="Monthly trends" className="mb-8">
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
            Monthly trends · last 12 months
          </h2>
          <DashboardCharts data={logs} revenueData={revenue} />
        </section>

        {member?.current_club_id && (
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