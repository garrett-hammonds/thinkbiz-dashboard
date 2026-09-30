'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { dispatchNotifications } from '@/lib/notifications/dispatch';
import { sendEmail } from '@/lib/email/client';
import { chatReportEmail } from '@/lib/email/templates';
import {
  canModerateMember,
  REPORT_REASONS,
  reportReasonLabel,
  type ReportReason,
} from '@/lib/chat/safety';

// Chat safety actions (App Store Guideline 1.2): report a message, block a
// member from DMing you, accept the chat guidelines, and — for directors and
// admins — act on reports and suspend members from chat. Every write goes
// through the service role, scoped in code to what the caller may do; the
// chat_safety migration enforces blocks and suspensions on the chat tables
// themselves, so a client going around these actions gets nowhere.

type Result = { success: boolean; message?: string };

async function requireActiveMember() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const member = await getMemberForUser(supabase, user);
  if (!member || !member.is_active) return null;
  return { supabase, member };
}

const MENTION_TOKEN = /<@[0-9a-fA-F-]{36}>/g;

function snippetOf(content: string | null | undefined, hasAttachments: boolean): string {
  const text = (content || '').replace(MENTION_TOKEN, '@member').trim();
  if (text) return text.length > 280 ? `${text.slice(0, 277)}…` : text;
  return hasAttachments ? '[attachment]' : '';
}

export async function reportChatMessage(
  messageId: string,
  reason: ReportReason,
  details: string,
): Promise<Result> {
  const ctx = await requireActiveMember();
  if (!ctx) return { success: false, message: 'Please sign in again.' };
  const { supabase, member } = ctx;

  if (!REPORT_REASONS.some((r) => r.value === reason)) {
    return { success: false, message: 'Pick a reason for the report.' };
  }

  // Read through the member's own client: RLS guarantees they can only report
  // a message they can actually see.
  const { data: message } = await supabase
    .from('chat_messages')
    .select('id, channel_id, member_id, content, attachments, image_url, created_at')
    .eq('id', (messageId || '').trim())
    .maybeSingle();
  if (!message) return { success: false, message: 'That message is no longer available.' };
  if (message.member_id === member.id) {
    return { success: false, message: "You can't report your own message." };
  }

  const admin = createAdminClient();
  const trimmedDetails = (details || '').trim().slice(0, 1000) || null;

  const { error } = await admin.from('chat_message_reports').insert({
    message_id: message.id,
    channel_id: message.channel_id,
    reporter_id: member.id,
    reported_member_id: message.member_id,
    reason,
    details: trimmedDetails,
    message_snapshot: {
      content: message.content,
      attachments: message.attachments ?? [],
      image_url: message.image_url,
      created_at: message.created_at,
    },
  });
  // 23505: this member already has an open report on this message. Nothing new
  // to tell the moderators, and the member's report stands.
  if (error && error.code !== '23505') {
    console.error('[reportChatMessage] insert failed:', error);
    return { success: false, message: 'Could not send the report. Please try again.' };
  }
  if (!error) {
    try {
      await notifyModeratorsOfReport({
        reportedMemberId: message.member_id as string,
        channelId: message.channel_id as string,
        reason,
        snippet: snippetOf(
          message.content as string,
          (Array.isArray(message.attachments) && message.attachments.length > 0) || !!message.image_url,
        ),
      });
    } catch (notifyError) {
      console.error('[reportChatMessage] moderator notification failed:', notifyError);
    }
  }

  revalidatePath('/dashboard/chat-reports');
  return { success: true };
}

// Directors of the reported member's club (when they may moderate that member)
// plus every admin, so a report is never stranded. Email goes out regardless
// of notification preferences — acting on reports is not optional.
async function notifyModeratorsOfReport(opts: {
  reportedMemberId: string;
  channelId: string;
  reason: ReportReason;
  snippet: string;
}): Promise<void> {
  const admin = createAdminClient();
  const [{ data: reported }, { data: channel }, { data: admins }] = await Promise.all([
    admin
      .from('members')
      .select('id, first_name, last_name, current_club_id, is_admin, club_director')
      .eq('id', opts.reportedMemberId)
      .maybeSingle(),
    admin.from('chat_channels').select('name, is_dm').eq('id', opts.channelId).maybeSingle(),
    admin.from('members').select('id, email').eq('is_admin', true).eq('is_active', true),
  ]);

  let directors: { id: string; email: string | null }[] = [];
  if (reported?.current_club_id && !reported.is_admin && !reported.club_director) {
    const { data } = await admin
      .from('members')
      .select('id, email')
      .eq('current_club_id', reported.current_club_id)
      .eq('club_director', true)
      .eq('is_active', true);
    directors = (data ?? []) as { id: string; email: string | null }[];
  }

  const recipients = new Map<string, string | null>();
  for (const r of [...directors, ...((admins ?? []) as { id: string; email: string | null }[])]) {
    recipients.set(r.id, r.email);
  }
  if (recipients.size === 0) return;

  const reportedName =
    [reported?.first_name, reported?.last_name].filter(Boolean).join(' ').trim() || 'A member';
  const where = channel?.is_dm ? 'a direct message' : `#${channel?.name || 'chat'}`;
  const reasonLabel = reportReasonLabel(opts.reason);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const url = `${siteUrl}/dashboard/chat-reports`;

  const email = chatReportEmail({ reportedName, reason: reasonLabel, where, snippet: opts.snippet, url });

  await Promise.allSettled([
    dispatchNotifications({
      category: 'application',
      recipientMemberIds: [...recipients.keys()],
      push: {
        title: 'Chat message reported',
        body: `${reportedName} in ${where}: ${reasonLabel}`,
        url,
        tag: 'chat-report',
      },
    }),
    ...[...recipients.values()]
      .filter((to): to is string => !!to)
      .map((to) => sendEmail({ to, ...email })),
  ]);
}

// Any member can stop another member from direct messaging them. Blocking
// is enforced in both directions inside that DM (see chat_dm_blocked()).
export async function setDmBlock(targetMemberId: string, blocked: boolean): Promise<Result> {
  const ctx = await requireActiveMember();
  const target = (targetMemberId || '').trim();
  if (!ctx || !target || target === ctx.member.id) return { success: false };

  const admin = createAdminClient();
  const { error } = blocked
    ? await admin.from('member_dm_blocks').upsert(
        { blocker_id: ctx.member.id, blocked_id: target },
        { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true },
      )
    : await admin
        .from('member_dm_blocks')
        .delete()
        .eq('blocker_id', ctx.member.id)
        .eq('blocked_id', target);

  if (error) {
    console.error('[setDmBlock] write failed:', error);
    return { success: false, message: 'Could not update the block. Please try again.' };
  }

  revalidatePath('/chat');
  revalidatePath('/profile');
  revalidatePath(`/directory/${target}`);
  return { success: true };
}

export async function acceptChatGuidelines(): Promise<Result> {
  const ctx = await requireActiveMember();
  if (!ctx) return { success: false };

  const admin = createAdminClient();
  const { error } = await admin
    .from('members')
    .update({ chat_guidelines_accepted_at: new Date().toISOString() })
    .eq('id', ctx.member.id);
  if (error) {
    console.error('[acceptChatGuidelines] update failed:', error);
    return { success: false, message: 'Could not save. Please try again.' };
  }

  revalidatePath('/chat');
  return { success: true };
}

async function loadModeratedMember(viewer: Parameters<typeof canModerateMember>[0], targetId: string) {
  const admin = createAdminClient();
  const { data: target } = await admin
    .from('members')
    .select('id, current_club_id, is_admin, club_director')
    .eq('id', targetId)
    .maybeSingle();
  if (!target || !canModerateMember(viewer, target)) return null;
  return target;
}

// Moderator-level block: suspends a member from posting anywhere in chat.
// Admins for anyone; directors for regular members of their own club.
export async function setChatSuspension(targetMemberId: string, suspended: boolean): Promise<Result> {
  const ctx = await requireActiveMember();
  const target = (targetMemberId || '').trim();
  if (!ctx || !target || target === ctx.member.id) return { success: false, message: 'Not allowed.' };
  if (!(await loadModeratedMember(ctx.member, target))) {
    return { success: false, message: 'You can only moderate members of your own club.' };
  }

  const admin = createAdminClient();
  const { error } = suspended
    ? await admin.from('chat_suspensions').upsert(
        { member_id: target, suspended_by: ctx.member.id },
        { onConflict: 'member_id', ignoreDuplicates: true },
      )
    : await admin.from('chat_suspensions').delete().eq('member_id', target);

  if (error) {
    console.error('[setChatSuspension] write failed:', error);
    return { success: false, message: 'Could not update the suspension. Please try again.' };
  }

  revalidatePath('/dashboard/chat-reports');
  revalidatePath(`/directory/${target}`);
  return { success: true };
}

export type ReportAction = 'remove_message' | 'remove_and_suspend' | 'dismiss';

export async function resolveChatReport(reportId: string, action: ReportAction): Promise<Result> {
  const ctx = await requireActiveMember();
  if (!ctx || (!ctx.member.is_admin && !ctx.member.club_director)) {
    return { success: false, message: 'Not allowed.' };
  }

  const admin = createAdminClient();
  const { data: report } = await admin
    .from('chat_message_reports')
    .select('id, message_id, reported_member_id, status')
    .eq('id', (reportId || '').trim())
    .maybeSingle();
  if (!report || report.status !== 'open') {
    return { success: false, message: 'This report was already handled.' };
  }
  // A report whose author has since deleted their account has no member to
  // scope by; only admins can close those.
  const allowed = report.reported_member_id
    ? !!(await loadModeratedMember(ctx.member, report.reported_member_id))
    : !!ctx.member.is_admin;
  if (!allowed) {
    return { success: false, message: 'You can only moderate members of your own club.' };
  }

  // Every open report on the same message closes together, so the queue
  // doesn't keep showing duplicates of something already handled. Collect the
  // ids first: deleting the message nulls message_id on its reports.
  let reportIds = [report.id as string];
  if (report.message_id) {
    const { data: siblings } = await admin
      .from('chat_message_reports')
      .select('id')
      .eq('message_id', report.message_id)
      .eq('status', 'open');
    reportIds = [...new Set([...reportIds, ...(siblings ?? []).map((r) => r.id as string)])];
  }

  if (action === 'remove_message' || action === 'remove_and_suspend') {
    if (report.message_id) {
      const { error } = await admin.from('chat_messages').delete().eq('id', report.message_id);
      if (error) {
        console.error('[resolveChatReport] message delete failed:', error);
        return { success: false, message: 'Could not remove the message. Please try again.' };
      }
    }
  }
  if (action === 'remove_and_suspend' && report.reported_member_id) {
    const { error } = await admin.from('chat_suspensions').upsert(
      { member_id: report.reported_member_id, suspended_by: ctx.member.id },
      { onConflict: 'member_id', ignoreDuplicates: true },
    );
    if (error) {
      console.error('[resolveChatReport] suspension failed:', error);
      return { success: false, message: 'Removed the message, but could not suspend the member.' };
    }
  }

  const { error: closeError } = await admin
    .from('chat_message_reports')
    .update({
      status: action === 'dismiss' ? 'dismissed' : 'resolved',
      resolution:
        action === 'dismiss'
          ? null
          : action === 'remove_message'
            ? 'message_removed'
            : 'message_removed_member_suspended',
      resolved_by: ctx.member.id,
      resolved_at: new Date().toISOString(),
    })
    .in('id', reportIds)
    .eq('status', 'open');
  if (closeError) {
    console.error('[resolveChatReport] close failed:', closeError);
    return { success: false, message: 'Could not update the report. Please try again.' };
  }

  revalidatePath('/dashboard/chat-reports');
  return { success: true };
}
