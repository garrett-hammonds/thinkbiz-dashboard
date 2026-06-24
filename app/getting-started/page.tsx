import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { membershipGateRedirect } from '@/utils/membership';
import { Navbar } from '@/components/navbar';
import GettingStartedChecklist from '@/components/GettingStartedChecklist';

export const metadata = {
  title: 'Getting Started — ThinkBiz',
};

export default async function GettingStartedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const member = await getMemberForUser(supabase, user);
  if (!member) redirect('/access-denied');

  // The profile gate at /onboarding runs before the dashboard, so anyone who
  // reaches this page has already finished it — but check the column directly
  // so the checklist reflects the real state rather than assuming.
  if (!member.profile_completed_at) redirect('/onboarding');

  const gate = membershipGateRedirect(member);
  if (gate) redirect(gate);

  // Has the member recorded any success tracking yet?
  const { count: logCount } = await supabase
    .from('weekly_logs')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', member.id);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Getting started{member.first_name ? `, ${member.first_name}` : ''}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A few quick steps to get the most out of ThinkBiz. Work through them
            in any order — this page updates as you go.
          </p>
        </div>

        <GettingStartedChecklist
          profileCompleted={!!member.profile_completed_at}
          hasHeadshot={!!member.member_headshot}
          hasLoggedSuccess={(logCount ?? 0) > 0}
        />
      </main>
    </div>
  );
}
