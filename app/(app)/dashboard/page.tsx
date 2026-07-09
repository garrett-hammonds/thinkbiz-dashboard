import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { getActiveClubId } from '@/utils/activeClub';
import { membershipGateRedirect } from '@/utils/membership';

import Link from 'next/link';

import { Scorecards } from "@/components/scorecards";
import { DashboardCharts } from "@/components/dashboard-charts";
import { AttendanceSummary, type AttendanceWeekDatum } from "@/components/attendance-summary";
import DashboardEmptyState from "@/components/DashboardEmptyState";
import GettingStartedBanner from "@/components/GettingStartedBanner";
import FlashMessage from "@/components/FlashMessage";
import type { WeeklyLog, RevenueLog } from "@/lib/types/metrics";
import {
  currentMeetingSlot,
  trailingMeetingSlots,
  formatSlotTick,
  MEETING_DAY_LABELS,
} from '@/utils/meetingWeek';

// How many weekly meetings the attendance trend looks back over.
const ATTENDANCE_WEEKS = 12;

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

  // Attendance is a director/admin surface (the widgets never render for
  // regular members). Null data + a known meeting day means "nothing to
  // chart yet"; a null meeting day prompts setup instead.
  const canManageAttendance = !!(member.is_admin || member.club_director);
  let attendanceMeetingDay: number | null = null;
  let attendanceData: AttendanceWeekDatum[] | null = null;
  let attendanceRoster = 0;

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

    if (canManageAttendance && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // Counting the roster requires reading fellow members' rows, which
      // member-scoped RLS hides even from directors — same service-role
      // reasoning as the roster page, and gated to directors/admins above.
      // meeting_day is queried separately from clubName's query so a
      // not-yet-applied attendance migration degrades to the setup prompt
      // instead of blanking the whole club section.
      const attendanceReader = createAdminClient();

      const { data: meetingDayData } = await attendanceReader
        .from('clubs')
        .select('meeting_day')
        .eq('id', activeClubId)
        .maybeSingle();
      attendanceMeetingDay = meetingDayData?.meeting_day ?? null;

      if (attendanceMeetingDay != null) {
        const slots = trailingMeetingSlots(
          currentMeetingSlot(attendanceMeetingDay),
          ATTENDANCE_WEEKS,
        );

        const [{ count: rosterCount }, { data: attendanceRows }] =
          await Promise.all([
            attendanceReader
              .from('members')
              .select('id', { count: 'exact', head: true })
              .eq('is_active', true)
              .eq('current_club_id', activeClubId),
            attendanceReader
              .from('attendance')
              .select('meeting_date')
              .eq('club_id', activeClubId)
              .gte('meeting_date', slots[0]),
          ]);

        attendanceRoster = rosterCount ?? 0;
        const presentBySlot = new Map(slots.map((s) => [s, 0]));
        for (const row of attendanceRows ?? []) {
          const slot = row.meeting_date as string;
          if (presentBySlot.has(slot)) {
            presentBySlot.set(slot, (presentBySlot.get(slot) ?? 0) + 1);
          }
        }
        attendanceData = slots.map((s) => ({
          date: formatSlotTick(s),
          present: presentBySlot.get(s) ?? 0,
        }));
      }
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
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground lg:text-2xl">
            {member ? `Welcome back, ${member.first_name}` : 'Dashboard'}
          </h1>
          <p className="mt-1 text-base text-muted-foreground lg:text-sm">
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
              <h2 className="mb-4 text-base font-semibold text-muted-foreground lg:text-sm">
                Monthly trends · last 12 months
              </h2>
              <DashboardCharts data={logs} revenueData={revenue} />
            </section>
          </>
        )}

        {activeClubId && (
          <div className="mt-12 border-t border-gray-200 pt-10 sm:mt-16 sm:pt-12">
            <h2 className="mb-8 text-2xl font-bold leading-snug text-foreground sm:text-3xl">
              Club stats for {clubName}
            </h2>
            
            <Scorecards logsData={clubLogs} revenueData={clubRevenue} />

            <div className="mt-8">
              <DashboardCharts data={clubLogs} revenueData={clubRevenue} />
            </div>

            {canManageAttendance && attendanceData && attendanceMeetingDay != null && (
              <section aria-label="Meeting attendance" className="mt-12">
                <h3 className="mb-4 text-base font-semibold text-muted-foreground lg:text-sm">
                  Meeting attendance · last {ATTENDANCE_WEEKS} weeks
                </h3>
                <AttendanceSummary
                  data={attendanceData}
                  rosterSize={attendanceRoster}
                  meetingDayLabel={MEETING_DAY_LABELS[attendanceMeetingDay]}
                />
              </section>
            )}

            {canManageAttendance && attendanceMeetingDay == null && (
              <section aria-label="Meeting attendance" className="mt-12">
                <div className="rounded-xl border border-dashed border-gray-300 bg-card p-6">
                  <p className="text-sm text-muted-foreground">
                    Track weekly meeting attendance with member check-in QR
                    codes.{' '}
                    <Link
                      href="/dashboard/attendance"
                      className="font-semibold text-primary transition-colors hover:text-secondary"
                    >
                      Set your club&apos;s meeting day to get started →
                    </Link>
                  </p>
                </div>
              </section>
            )}
          </div>
        )}
      </main>
  );
}