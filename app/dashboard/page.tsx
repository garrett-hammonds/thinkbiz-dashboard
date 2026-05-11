import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

import { Navbar } from "@/components/navbar";
import { Scorecards } from "@/components/scorecards";
import { DashboardCharts } from "@/components/dashboard-charts";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: memberData } = await supabase
    .from('members')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!memberData) {
    redirect('/access-denied');
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

  const logs = logsData || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const revenue = (revenueData as any[]) || [];

  let clubName = '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let clubLogs: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let clubRevenue: any[] = [];

  if (member?.current_club_id) {
    // 1. Fetch Club Details
    const { data: clubData } = await supabase
      .from('clubs')
      .select('start_time, display_name')
      .eq('id', member.current_club_id)
      .single();
    
    if (clubData) {
      clubName = `${clubData.start_time} ${clubData.display_name}`;
    }

    // 2. Fetch Club Logs
    const { data: cLogs } = await supabase
      .from('weekly_logs')
      .select('*')
      .eq('club_id', member.current_club_id);
    
    if (cLogs) clubLogs = cLogs;

    // 3. Fetch Club Revenue (Using an inner join through weekly_logs)
    const { data: cRevenue } = await supabase
      .from('closed_business_thanks')
      .select('revenue_amount, created_at, weekly_logs!inner(club_id)')
      .eq('weekly_logs.club_id', member.current_club_id);
    
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

        <section aria-label="Key metrics" className="mb-8">
          <Scorecards logsData={logs} revenueData={revenue} />
        </section>

        <section aria-label="Monthly trends" className="mb-8">
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