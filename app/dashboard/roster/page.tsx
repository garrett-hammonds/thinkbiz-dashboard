import { redirect } from 'next/navigation';
import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { isBillingEnabled } from '@/lib/stripe/client';
import { isMemberPaid } from '@/utils/membership';
import { Navbar } from '@/components/navbar';
import { RosterTable, type RosterRow } from './RosterTable';

export const dynamic = 'force-dynamic';

// Pull every auth user's last_sign_in_at so we can tell who has actually
// signed in to the app (vs. those still sitting on an unaccepted invite).
async function fetchSignedInUserIds(
  admin: SupabaseClient,
): Promise<Set<string>> {
  const signedIn = new Set<string>();
  const perPage = 1000;
  let page = 1;
  while (page <= 50) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users) break;
    for (const u of data.users) {
      if (u.last_sign_in_at) signedIn.add(u.id);
    }
    if (data.users.length < perPage) break;
    page += 1;
  }
  return signedIn;
}

function RosterShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}

export default async function RosterPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const member = await getMemberForUser(supabase, user);

  if (!member || (!member.is_admin && !member.club_director)) {
    redirect('/access-denied');
  }

  if (!member.profile_completed_at) {
    redirect('/onboarding');
  }

  // This roster is scoped to the director's own club. A director without a
  // club assignment has no roster to show.
  if (!member.current_club_id) {
    return (
      <RosterShell>
        <h1 className="mb-4 text-4xl font-black leading-tight tracking-tight text-foreground">
          Member Roster
        </h1>
        <p className="text-muted-foreground">
          You aren&apos;t assigned to a club yet, so there&apos;s no roster to show.
        </p>
      </RosterShell>
    );
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return (
      <RosterShell>
        <h1 className="mb-4 text-4xl font-black leading-tight tracking-tight text-foreground">
          Member Roster
        </h1>
        <p className="text-muted-foreground">
          The roster is temporarily unavailable. Please contact ThinkBiz Support.
        </p>
      </RosterShell>
    );
  }

  // Service-role client: a director needs to see fellow club members and each
  // member's join status, which member-scoped RLS would otherwise hide. Access
  // is already gated above to directors/admins, and the query below is locked
  // to the viewer's own club.
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
  );

  const [{ data: membersData }, { data: clubData }, signedInIds] =
    await Promise.all([
      admin
        .from('members')
        .select(
          'id, first_name, last_name, email, phone_number, company_name, title, member_headshot, is_admin, club_director, auth_user_id, subscription_status',
        )
        .eq('is_active', true)
        .eq('current_club_id', member.current_club_id)
        .order('first_name', { ascending: true }),
      admin
        .from('clubs')
        .select('name, display_name')
        .eq('id', member.current_club_id)
        .maybeSingle(),
      fetchSignedInUserIds(admin),
    ]);

  const clubName = clubData?.display_name || clubData?.name || 'your club';

  const rows: RosterRow[] = (membersData || []).map((m) => ({
    id: m.id,
    name: `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || m.email,
    email: m.email,
    phone: m.phone_number ?? null,
    company: m.company_name ?? null,
    title: m.title ?? null,
    headshot: m.member_headshot ?? null,
    isDirector: !!m.club_director,
    isAdmin: !!m.is_admin,
    joined: !!m.auth_user_id && signedInIds.has(m.auth_user_id),
    // Directors and admins aren't billed, so they have no payment status to
    // track. Everyone else is "paid" only with an active/trialing subscription.
    billable: !m.is_admin && !m.club_director,
    paid: isMemberPaid(m),
  }));

  return (
    <RosterShell>
      <div className="mb-8">
        <h1 className="text-4xl font-black leading-tight tracking-tight text-foreground">
          {clubName} Roster
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your active club members, and who has joined the app.
        </p>
      </div>

      <RosterTable rows={rows} showPayment={isBillingEnabled()} />
    </RosterShell>
  );
}
