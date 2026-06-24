import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { dispatchNotifications } from '@/lib/notifications/dispatch';
import { weeklyLogReminderEmail } from '@/lib/email/templates';

export const dynamic = 'force-dynamic';
// Fans reminders out to every active member who hasn't logged. Give the
// function headroom beyond the default so a larger roster can't time out.
export const maxDuration = 60;

// Scheduled by Vercel Cron (see vercel.json). Notifies active members who have
// not submitted a weekly log in the last 7 days.
//
// week_ending is a member-picked date with no enforced day-of-week, so "logged
// recently" is defined as having any log whose week_ending falls within the
// trailing 7-day window from the run date.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoff = sevenDaysAgo.toISOString().slice(0, 10); // YYYY-MM-DD

  // Active members + members who logged within the window, then diff.
  const [{ data: activeMembers, error: membersError }, { data: recentLogs, error: logsError }] =
    await Promise.all([
      admin.from('members').select('id').eq('is_active', true),
      admin.from('weekly_logs').select('member_id').gte('week_ending', cutoff),
    ]);

  if (membersError || logsError) {
    console.error('[cron/weekly-log-reminder] query failed:', membersError || logsError);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  const loggedIds = new Set((recentLogs ?? []).map((r) => r.member_id as string));
  const missingIds = (activeMembers ?? [])
    .map((m) => m.id as string)
    .filter((id) => !loggedIds.has(id));

  if (missingIds.length === 0) {
    return NextResponse.json({ ok: true, notified: 0 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const email = weeklyLogReminderEmail({ url: `${siteUrl}/log` });

  await dispatchNotifications({
    category: 'log_reminder',
    recipientMemberIds: missingIds,
    push: {
      title: 'Weekly log reminder',
      body: "Don't forget to submit your weekly activity log.",
      url: `${siteUrl}/log`,
      tag: 'weekly-log-reminder',
    },
    email,
  });

  return NextResponse.json({ ok: true, notified: missingIds.length });
}
