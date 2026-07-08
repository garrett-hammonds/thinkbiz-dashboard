import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { getActiveClubId } from '@/utils/activeClub';
import { Scanner } from './Scanner';

export const dynamic = 'force-dynamic';

// The door scanner: a director points their phone at each arriving member's
// personal check-in QR (/check-in-code) and attendance for this week's
// meeting is logged. All verification happens server-side in
// recordScanAction; this page only gates access and hosts the camera UI.
export default async function AttendanceScanPage() {
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

  const activeClubId = await getActiveClubId(member);
  if (!activeClubId) {
    redirect('/dashboard/attendance');
  }

  // The scanner is useless until the club has a meeting day to key
  // attendance to, so bounce to the attendance page where it's set.
  const admin = createAdminClient();
  const { data: club } = await admin
    .from('clubs')
    .select('display_name, name, meeting_day')
    .eq('id', activeClubId)
    .maybeSingle();

  if (club?.meeting_day == null) {
    redirect('/dashboard/attendance');
  }

  const clubName = club.display_name || club.name || 'your club';

  return (
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/dashboard/attendance"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to attendance
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold leading-snug text-foreground">
            Scan check-ins
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Point the camera at each member&apos;s check-in code as they arrive
            at {clubName}.
          </p>
        </div>

        <Scanner />
      </main>
  );
}
