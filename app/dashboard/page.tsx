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
  
  const [{ data: logsData }, { data: revenueData, error: revenueError }] = await Promise.all([
    logsPromise,
    revenuePromise
  ]);

  const logs = logsData || [];
  const revenue = (revenueData as any[]) || [];

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
      </main>
    </div>
  );
}