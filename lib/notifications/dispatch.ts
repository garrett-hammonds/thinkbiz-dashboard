import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email/client';
import { sendPush, type StoredSubscription } from '@/lib/notifications/push-server';

export type NotificationCategory = 'chat' | 'log_reminder' | 'application';

export interface PushContent {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export interface DispatchInput {
  category: NotificationCategory;
  // Recipients receive a push (subject to their push prefs) and, if `email` is
  // provided, an email (subject to their email prefs).
  recipientMemberIds: string[];
  push: PushContent;
  email?: EmailContent;
}

// Columns on notification_preferences, keyed by category.
const EMAIL_COL: Record<NotificationCategory, string> = {
  chat: 'email_chat',
  log_reminder: 'email_log_reminder',
  application: 'email_application',
};
const PUSH_COL: Record<NotificationCategory, string> = {
  chat: 'push_chat',
  log_reminder: 'push_log_reminder',
  application: 'push_application',
};

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

interface PrefRow {
  member_id: string;
  email_enabled: boolean;
  push_enabled: boolean;
  [key: string]: unknown;
}

// Missing prefs default to ON (opt-out model).
function wants(pref: PrefRow | undefined, masterCol: 'email_enabled' | 'push_enabled', categoryCol: string): boolean {
  if (!pref) return true;
  const master = pref[masterCol];
  const category = pref[categoryCol];
  return master !== false && category !== false;
}

// Fans a single notification out to email (Resend) + web push (web-push) for the
// given recipients, honoring each member's preferences. Best-effort: never throws,
// so it can be awaited inside a server action / route without risking the caller.
export async function dispatchNotifications(input: DispatchInput): Promise<void> {
  try {
    const recipientIds = Array.from(new Set(input.recipientMemberIds)).filter(Boolean);
    if (recipientIds.length === 0) return;

    const admin = adminClient();

    // Members + their prefs (left join via a separate query — keep it simple).
    const [{ data: members }, { data: prefs }] = await Promise.all([
      admin.from('members').select('id, email, first_name').in('id', recipientIds),
      admin.from('notification_preferences').select('*').in('member_id', recipientIds),
    ]);

    const prefByMember = new Map<string, PrefRow>();
    for (const p of (prefs ?? []) as PrefRow[]) prefByMember.set(p.member_id, p);

    const emailCol = EMAIL_COL[input.category];
    const pushCol = PUSH_COL[input.category];

    const emailTargets: { email: string; firstName?: string }[] = [];
    const pushTargetIds: string[] = [];

    for (const m of (members ?? []) as { id: string; email: string | null; first_name: string | null }[]) {
      const pref = prefByMember.get(m.id);
      if (input.email && m.email && wants(pref, 'email_enabled', emailCol)) {
        emailTargets.push({ email: m.email, firstName: m.first_name ?? undefined });
      }
      if (wants(pref, 'push_enabled', pushCol)) {
        pushTargetIds.push(m.id);
      }
    }

    await Promise.allSettled([
      sendEmails(emailTargets, input.email),
      sendPushes(admin, pushTargetIds, input.push),
    ]);
  } catch (err) {
    console.error('[notifications] dispatch failed:', err);
  }
}

async function sendEmails(
  targets: { email: string; firstName?: string }[],
  email: EmailContent | undefined,
): Promise<void> {
  if (!email || targets.length === 0) return;
  await Promise.allSettled(
    targets.map((t) =>
      sendEmail({ to: t.email, subject: email.subject, html: email.html, text: email.text }),
    ),
  );
}

async function sendPushes(
  admin: ReturnType<typeof adminClient>,
  memberIds: string[],
  push: PushContent,
): Promise<void> {
  if (memberIds.length === 0) return;

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('member_id', memberIds);

  if (!subs || subs.length === 0) return;

  const staleIds: string[] = [];
  await Promise.allSettled(
    (subs as (StoredSubscription & { id: string })[]).map(async (sub) => {
      const result = await sendPush(sub, push);
      if (result.stale) staleIds.push(sub.id);
    }),
  );

  // Prune endpoints the push service reported as gone (404/410).
  if (staleIds.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', staleIds);
  }
}
