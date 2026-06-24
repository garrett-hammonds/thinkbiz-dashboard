import Link from 'next/link';
import { redirect } from 'next/navigation';
import { QrCode } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { Navbar } from '@/components/navbar';
import { VisitorList, type VisitorRow } from './VisitorList';

export const dynamic = 'force-dynamic';

function VisitorsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}

export default async function VisitorsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const member = await getMemberForUser(supabase, user);

  // Any active member of a club can see that club's visitors so they can
  // follow up — no director/admin gate (unlike the roster).
  if (!member || !member.is_active) {
    redirect('/access-denied');
  }

  if (!member.profile_completed_at) {
    redirect('/onboarding');
  }

  const canManage = !!(member.is_admin || member.club_director);

  if (!member.current_club_id) {
    return (
      <VisitorsShell>
        <h1 className="mb-4 text-4xl font-black leading-tight tracking-tight text-foreground">
          Visitors
        </h1>
        <p className="text-muted-foreground">
          You aren&apos;t assigned to a club yet, so there are no visitors to show.
        </p>
      </VisitorsShell>
    );
  }

  // RLS (visitors_select) already scopes reads to the member's own club, but we
  // filter explicitly so admins (who can read every club) still get only their
  // current club's list here.
  const { data: visitorsData } = await supabase
    .from('visitors')
    .select('id, first_name, last_name, email, phone, company_name, title, notes, source, visited_on')
    .eq('club_id', member.current_club_id)
    .order('visited_on', { ascending: false })
    .order('created_at', { ascending: false });

  const rows: VisitorRow[] = (visitorsData || []).map((v) => ({
    id: v.id,
    name: `${v.first_name ?? ''} ${v.last_name ?? ''}`.trim() || 'Visitor',
    email: v.email ?? null,
    phone: v.phone ?? null,
    company: v.company_name ?? null,
    title: v.title ?? null,
    notes: v.notes ?? null,
    source: v.source === 'preregistration' ? 'preregistration' : 'meeting',
    visitedOn: v.visited_on,
  }));

  return (
    <VisitorsShell>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-black leading-tight tracking-tight text-foreground">
            Visitors
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            People who pre-registered or checked in at a meeting. Reach out to
            welcome them.
          </p>
        </div>
        {canManage && (
          <Link
            href="/dashboard/visitors/qr"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-secondary"
          >
            <QrCode className="h-4 w-4" aria-hidden="true" />
            Show check-in QR
          </Link>
        )}
      </div>

      <VisitorList rows={rows} canManage={canManage} />
    </VisitorsShell>
  );
}
