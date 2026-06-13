import { redirect } from 'next/navigation';
import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { getMemberForUser } from '@/utils/supabase/getMember';
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

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="mb-4 text-4xl font-black leading-tight tracking-tight text-foreground">
            Member Roster
          </h1>
          <p className="text-muted-foreground">
            The roster is temporarily unavailable. Please contact ThinkBiz Support.
          </p>
        </main>
      </div>
    );
  }

  // Service-role client: directors need to see fellow club members and every
  // member's join status, which member-scoped RLS would otherwise hide. Access
  // is already gated above to admins and club directors.
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
  );

  let membersQuery = admin
    .from('members')
    .select(
      'id, first_name, last_name, email, phone_number, company_name, title, member_headshot, current_club_id, is_admin, club_director, auth_user_id',
    )
    .eq('is_active', true)
    .order('first_name', { ascending: true });

  // Admins see the whole organization; club directors see only their own club.
  if (!member.is_admin) {
    membersQuery = membersQuery.eq('current_club_id', member.current_club_id);
  }

  const [{ data: membersData }, { data: clubsData }, signedInIds] =
    await Promise.all([
      membersQuery,
      admin.from('clubs').select('id, name, display_name'),
      fetchSignedInUserIds(admin),
    ]);

  const clubNames = new Map<string, string>();
  for (const c of clubsData || []) {
    clubNames.set(c.id, c.display_name || c.name);
  }

  const rows: RosterRow[] = (membersData || []).map((m) => ({
    id: m.id,
    name: `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || m.email,
    email: m.email,
    phone: m.phone_number ?? null,
    company: m.company_name ?? null,
    title: m.title ?? null,
    clubName: m.current_club_id ? clubNames.get(m.current_club_id) ?? null : null,
    headshot: m.member_headshot ?? null,
    isDirector: !!m.club_director,
    isAdmin: !!m.is_admin,
    joined: !!m.auth_user_id && signedInIds.has(m.auth_user_id),
  }));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-4xl font-black leading-tight tracking-tight text-foreground">
            Member Roster
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {member.is_admin
              ? 'All active members across every club, and who has joined the app.'
              : 'Your active club members, and who has joined the app.'}
          </p>
        </div>

        <RosterTable rows={rows} showClub={!!member.is_admin} />
      </main>
    </div>
  );
}
