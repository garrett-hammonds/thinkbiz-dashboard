import 'server-only';
import { createAdminClient } from '@/utils/supabase/admin';
import { dispatchNotifications } from '@/lib/notifications/dispatch';
import { chatMentionEmail } from '@/lib/email/templates';

// Resolves recipients for a new chat message and fans the notification out
// (push to every channel member except the author; email only to @-mentioned).
//
// This is the single source of truth for chat notifications. It is invoked from
// two places that may both fire for the same message:
//   * app/actions/chat.ts (notifyChatMessage) — the client triggers this right
//     after inserting a message, so notifications work without any out-of-band
//     setup.
//   * app/api/webhooks/chat-message — the optional Supabase Database Webhook,
//     kept as a backstop for messages inserted outside the web client.
//
// To stay safe when both fire, it *atomically claims* the message by stamping
// chat_messages.notified_at IS NULL -> now() and only proceeds if it won the
// claim. The loser (and any retry) no-ops, so a message is never double-sent.
export async function dispatchChatMessageNotifications(messageId: string): Promise<void> {
  if (!messageId) return;

  const admin = createAdminClient();

  // Claim + read in one round-trip. The `.is('notified_at', null)` filter makes
  // this idempotent: a second caller updates zero rows and gets back no record.
  const { data: message } = await admin
    .from('chat_messages')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', messageId)
    .is('notified_at', null)
    .select('id, channel_id, member_id, content, image_url, attachments, mentions')
    .maybeSingle();

  if (!message || !message.channel_id || !message.member_id) return;

  // Channel (name + club scope) and author name.
  const [{ data: channel }, { data: author }] = await Promise.all([
    admin.from('chat_channels').select('id, name, club_id, is_dm').eq('id', message.channel_id).maybeSingle(),
    admin.from('members').select('first_name, last_name').eq('id', message.member_id).maybeSingle(),
  ]);

  if (!channel) return;

  // Resolve recipients by channel type.
  let recipientIds: string[] = [];
  if (channel.club_id) {
    // Club channel: all active members of that club.
    const { data: clubMembers } = await admin
      .from('members')
      .select('id')
      .eq('current_club_id', channel.club_id)
      .eq('is_active', true);
    recipientIds = (clubMembers ?? []).map((m) => m.id as string);
  } else {
    // Open channel: explicit channel members.
    const { data: channelMembers } = await admin
      .from('chat_channel_members')
      .select('member_id')
      .eq('channel_id', channel.id);
    recipientIds = (channelMembers ?? []).map((m) => m.member_id as string);
  }

  // Drop the author.
  recipientIds = recipientIds.filter((id) => id !== message.member_id);
  if (recipientIds.length === 0) return;

  const mentionsList = (message.mentions ?? []) as string[];
  const mentioned = new Set(mentionsList.filter((id) => recipientIds.includes(id)));
  const nonMentioned = recipientIds.filter((id) => !mentioned.has(id));

  const authorName =
    [author?.first_name, author?.last_name].filter(Boolean).join(' ').trim() || 'Someone';
  const channelName = channel.name || 'a channel';
  const snippet = snippetOf(message.content, message.image_url, message.attachments);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const url = channel.is_dm ? `${siteUrl}/chat?channel=${channel.id}` : `${siteUrl}/chat`;

  // Direct message: one recipient, no channel to name, and mention semantics
  // don't add anything in a 1:1 — a single sender-titled push covers it.
  if (channel.is_dm) {
    await dispatchNotifications({
      category: 'chat',
      recipientMemberIds: recipientIds,
      push: {
        title: `New message from ${authorName}`,
        body: snippet,
        url,
        tag: `chat-${channel.id}`,
      },
    });
    return;
  }

  // Two disjoint dispatches so mentioned members aren't double-pushed:
  //  - non-mentioned: push only
  //  - mentioned:     push + email
  await Promise.allSettled([
    nonMentioned.length > 0
      ? dispatchNotifications({
          category: 'chat',
          recipientMemberIds: nonMentioned,
          push: {
            title: `New message in #${channelName}`,
            body: `${authorName}: ${snippet}`,
            url,
            tag: `chat-${channel.id}`,
          },
        })
      : Promise.resolve(),
    mentioned.size > 0
      ? dispatchNotifications({
          category: 'chat',
          recipientMemberIds: Array.from(mentioned),
          push: {
            title: `${authorName} mentioned you`,
            body: `#${channelName}: ${snippet}`,
            url,
            tag: `chat-${channel.id}`,
          },
          email: chatMentionEmail({ authorName, channelName, snippet, url }),
        })
      : Promise.resolve(),
  ]);
}

type AttachmentRow = { kind?: string; name?: string };

function snippetOf(
  content: string | null,
  imageUrl: string | null,
  attachments: unknown
): string {
  const text = (content || '').trim();
  if (text) return text.length > 140 ? `${text.slice(0, 137)}…` : text;

  const atts = (Array.isArray(attachments) ? attachments : []) as AttachmentRow[];
  if (atts.length > 0) {
    const images = atts.filter((a) => a?.kind === 'image');
    const files = atts.filter((a) => a?.kind === 'file');
    if (files.length > 0) {
      const firstName = files[0]?.name?.trim();
      if (files.length === 1 && images.length === 0 && firstName) return `📎 ${firstName}`;
      const parts: string[] = [];
      if (images.length) parts.push(`${images.length} photo${images.length > 1 ? 's' : ''}`);
      if (files.length) parts.push(`${files.length} file${files.length > 1 ? 's' : ''}`);
      return `📎 ${parts.join(' + ')}`;
    }
    return images.length === 1 ? '📷 Photo' : `📷 ${images.length} photos`;
  }

  if (imageUrl) return '📷 Photo';
  return 'New message';
}
