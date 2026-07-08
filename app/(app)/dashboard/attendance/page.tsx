import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft, ChevronRight, ScanLine } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { getActiveClubId } from '@/utils/activeClub';
import { setMeetingDayAction } from '@/app/actions/attendance';
import {
  addDaysIso,
  currentMeetingSlot,
  formatSlotLabel,
  isValidMeetingSlot,
  MEETING_DAY_LABELS,
} from '@/utils/meetingWeek';
import { AttendanceChecklist, type ChecklistRow } from './AttendanceChecklist';

export const dynamic = 'force-dynamic';

function AttendanceShell({ children }: { children: React.ReactNode }) {
  return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
  );
}

// Weekly attendance for the director's club: who's checked in this week,
// tap-to-toggle manual corrections/backfill for any week, and the club's
// meeting-day setting. The scanner (/dashboard/attendance/scan) is the fast
// path at the door; this page is the source of truth and the fallback when
// nobody could scan (paper attendance handed to the director, dead phones).
export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
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
    return (
      <AttendanceShell>
        <h1 className="mb-4 text-4xl font-black leading-tight tracking-tight text-foreground">
          Attendance
        </h1>
        <p className="text-muted-foreground">
          {member.is_admin
            ? 'Pick a club from the switcher in the top bar to track its attendance.'
            : "You aren't assigned to a club yet, so there's no attendance to track."}
        </p>
      </AttendanceShell>
    );
  }

  // Service-role client: directors need fellow members' names/headshots,
  // which member-scoped RLS hides. Access is gated above and every query is
  // locked to the active club, mirroring the roster page.
  const admin = createAdminClient();

  const { data: club } = await admin
    .from('clubs')
    .select('name, display_name, meeting_day')
    .eq('id', activeClubId)
    .maybeSingle();

  const clubName = club?.display_name || club?.name || 'your club';
  const meetingDay: number | null = club?.meeting_day ?? null;

  // First run: attendance can't be keyed to a week until the club has a
  // meeting day, so setting it is the whole page.
  if (meetingDay == null) {
    return (
      <AttendanceShell>
        <h1 className="text-4xl font-black leading-tight tracking-tight text-foreground">
          {clubName} Attendance
        </h1>
        <div className="mt-8 rounded-xl border border-gray-100 bg-card p-8 shadow-card">
          <h2 className="text-lg font-bold text-card-foreground">
            What day does {clubName} meet?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Weekly attendance is tracked against your meeting day. You can
            change this later.
          </p>
          <form action={setMeetingDayAction} className="mt-4 flex flex-wrap items-center gap-3">
            <select
              name="meeting_day"
              defaultValue="2"
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-foreground"
            >
              {MEETING_DAY_LABELS.map((label, day) => (
                <option key={day} value={day}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Save meeting day
            </button>
          </form>
        </div>
      </AttendanceShell>
    );
  }

  const currentSlot = currentMeetingSlot(meetingDay);
  const slot =
    week && isValidMeetingSlot(week, meetingDay) && week <= currentSlot
      ? week
      : currentSlot;
  const prevSlot = addDaysIso(slot, -7);
  const nextSlot = addDaysIso(slot, 7);

  const [{ data: membersData }, { data: attendanceData }] = await Promise.all([
    admin
      .from('members')
      .select('id, first_name, last_name, email, member_headshot')
      .eq('is_active', true)
      .eq('current_club_id', activeClubId)
      .order('first_name', { ascending: true }),
    admin
      .from('attendance')
      .select('member_id, source')
      .eq('club_id', activeClubId)
      .eq('meeting_date', slot),
  ]);

  const presentById = new Map(
    (attendanceData ?? []).map((a) => [a.member_id as string, a.source as string]),
  );

  const rows: ChecklistRow[] = (membersData ?? []).map((m) => ({
    id: m.id,
    name: `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || m.email,
    headshot: m.member_headshot ?? null,
    present: presentById.has(m.id),
    source: presentById.get(m.id) ?? null,
  }));

  return (
    <AttendanceShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black leading-tight tracking-tight text-foreground">
            {clubName} Attendance
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Meets on {MEETING_DAY_LABELS[meetingDay]}s.{' '}
            <span className="whitespace-nowrap">
              Tap a member to toggle them for this week.
            </span>
          </p>
        </div>
        <Link
          href="/dashboard/attendance/scan"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <ScanLine className="h-4 w-4" aria-hidden="true" />
          Open scanner
        </Link>
      </div>

      <div className="mt-8 flex items-center justify-between rounded-xl border border-gray-100 bg-card px-4 py-3 shadow-card">
        <Link
          href={`/dashboard/attendance?week=${prevSlot}`}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Previous
        </Link>
        <p className="text-sm font-semibold text-card-foreground">
          {formatSlotLabel(slot)}
          {slot === currentSlot && (
            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
              This week
            </span>
          )}
        </p>
        {slot < currentSlot ? (
          <Link
            href={`/dashboard/attendance?week=${nextSlot}`}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Next
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-1.5 text-sm text-muted-foreground/40">
            Next
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>

      <div className="mt-6">
        <AttendanceChecklist key={slot} rows={rows} meetingDate={slot} />
      </div>

      <div className="mt-10 border-t border-gray-200 pt-6">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Club settings
        </p>
        <form action={setMeetingDayAction} className="mt-3 flex flex-wrap items-center gap-3">
          <label htmlFor="meeting_day" className="text-sm text-muted-foreground">
            Meeting day
          </label>
          <select
            id="meeting_day"
            name="meeting_day"
            defaultValue={String(meetingDay)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-foreground"
          >
            {MEETING_DAY_LABELS.map((label, day) => (
              <option key={day} value={day}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Update
          </button>
        </form>
      </div>
    </AttendanceShell>
  );
}
