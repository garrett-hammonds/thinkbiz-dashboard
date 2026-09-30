import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { canModerateMember, reportReasonLabel } from '@/lib/chat/safety';
import { ReportActions, LiftSuspensionButton } from './ReportActions';

type MemberRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  current_club_id: string | null;
  is_admin: boolean | null;
  club_director: boolean | null;
};

type ReportRow = {
  id: string;
  message_id: string | null;
  reporter_id: string | null;
  reported_member_id: string | null;
  reason: string;
  details: string | null;
  message_snapshot: { content?: string; attachments?: { name?: string }[]; image_url?: string | null } | null;
  created_at: string;
  chat_channels: { name: string | null; is_dm: boolean | null } | null;
};

const MENTION_TOKEN = /<@[0-9a-fA-F-]{36}>/g;

function nameOf(m: MemberRow | undefined): string {
  if (!m) return 'Former member';
  return `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || 'Former member';
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
  });
}

// Chat moderation queue (App Store Guideline 1.2). Admins see every open
// report; directors see reports about regular members of their own club.
// Reports about directors/admins go to admins only.
export default async function ChatReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const viewer = await getMemberForUser(supabase, user);
  if (!viewer || (!viewer.is_admin && !viewer.club_director)) redirect('/access-denied');
  if (!viewer.profile_completed_at) redirect('/onboarding');

  const admin = createAdminClient();
  const [{ data: reportData }, { data: suspensionData }] = await Promise.all([
    admin
      .from('chat_message_reports')
      .select(
        'id, message_id, reporter_id, reported_member_id, reason, details, message_snapshot, created_at, chat_channels(name, is_dm)',
      )
      .eq('status', 'open')
      .order('created_at', { ascending: true })
      .limit(200),
    admin.from('chat_suspensions').select('member_id, created_at').order('created_at', { ascending: false }),
  ]);

  const reports = (reportData ?? []) as unknown as ReportRow[];
  const suspensions = (suspensionData ?? []) as { member_id: string; created_at: string }[];

  const memberIds = new Set<string>();
  for (const r of reports) {
    if (r.reporter_id) memberIds.add(r.reporter_id);
    if (r.reported_member_id) memberIds.add(r.reported_member_id);
  }
  for (const s of suspensions) memberIds.add(s.member_id);

  const members = new Map<string, MemberRow>();
  if (memberIds.size > 0) {
    const { data } = await admin
      .from('members')
      .select('id, first_name, last_name, current_club_id, is_admin, club_director')
      .in('id', [...memberIds]);
    for (const m of (data ?? []) as MemberRow[]) members.set(m.id, m);
  }

  const inScope = (memberId: string | null) => {
    if (!memberId) return !!viewer.is_admin;
    const m = members.get(memberId);
    return m ? canModerateMember(viewer, m) : !!viewer.is_admin;
  };

  const visibleReports = reports.filter((r) => inScope(r.reported_member_id));
  const visibleSuspensions = suspensions.filter((s) => inScope(s.member_id));

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="mb-1 text-4xl font-black leading-tight tracking-tight text-foreground">Chat Reports</h1>
      <p className="mb-8 text-sm font-medium text-muted-foreground">
        {viewer.is_admin ? 'Across all clubs' : 'Members of your club'} · Review every report within 24 hours.
      </p>

      {visibleReports.length === 0 ? (
        <p className="mb-10 text-muted-foreground">No open reports.</p>
      ) : (
        <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {visibleReports.map((r) => {
            const reported = r.reported_member_id ? members.get(r.reported_member_id) : undefined;
            const reporter = r.reporter_id ? members.get(r.reporter_id) : undefined;
            const snapshot = r.message_snapshot ?? {};
            const content = (snapshot.content ?? '').replace(MENTION_TOKEN, '@member').trim();
            const attachments = (snapshot.attachments ?? []).map((a) => a?.name).filter(Boolean);
            if (snapshot.image_url) attachments.push('image');
            const where = r.chat_channels?.is_dm
              ? 'Direct message'
              : r.chat_channels?.name
                ? `#${r.chat_channels.name}`
                : 'Chat';

            return (
              <div key={r.id} className="flex flex-col gap-4 rounded-xl border border-gray-100 bg-white p-6 shadow-card">
                <div>
                  <h2 className="text-xl font-bold leading-snug text-foreground">
                    {r.reported_member_id ? (
                      <Link href={`/directory/${r.reported_member_id}`} className="hover:text-primary">
                        {nameOf(reported)}
                      </Link>
                    ) : (
                      nameOf(reported)
                    )}
                  </h2>
                  <p className="text-sm font-medium text-gray-500">
                    {reportReasonLabel(r.reason)} · {where} · reported {when(r.created_at)} by {nameOf(reporter)}
                  </p>
                </div>

                <div className="rounded-lg border border-gray-100 bg-slate-50 px-3 py-2">
                  {content ? (
                    <p className="whitespace-pre-wrap break-words text-sm text-gray-900">{content}</p>
                  ) : null}
                  {attachments.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500">Attachments: {attachments.join(', ')}</p>
                  )}
                  {!content && attachments.length === 0 && (
                    <p className="text-sm italic text-gray-500">(empty message)</p>
                  )}
                  {!r.message_id && (
                    <p className="mt-1 text-xs italic text-gray-500">This message has already been deleted.</p>
                  )}
                </div>

                {r.details && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Reporter&apos;s note</p>
                    <p className="whitespace-pre-wrap text-sm text-gray-900">{r.details}</p>
                  </div>
                )}

                <div className="mt-auto border-t border-gray-100 pt-4">
                  <ReportActions
                    reportId={r.id}
                    messageExists={!!r.message_id}
                    canSuspend={!!r.reported_member_id}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h2 className="mb-4 text-2xl font-bold leading-snug text-foreground">Suspended from chat</h2>
      {visibleSuspensions.length === 0 ? (
        <p className="text-muted-foreground">Nobody is suspended.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white shadow-card">
          {visibleSuspensions.map((s) => (
            <li key={s.member_id} className="flex items-center gap-3 px-6 py-3">
              <Link href={`/directory/${s.member_id}`} className="flex-1 truncate text-sm font-semibold text-foreground hover:text-primary">
                {nameOf(members.get(s.member_id))}
              </Link>
              <span className="hidden text-xs text-gray-500 sm:inline">since {when(s.created_at)}</span>
              <LiftSuspensionButton memberId={s.member_id} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
