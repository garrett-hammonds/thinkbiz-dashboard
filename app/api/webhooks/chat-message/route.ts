import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { dispatchNotifications } from '@/lib/notifications/dispatch';
import { chatMentionEmail } from '@/lib/email/templates';

export const dynamic = 'force-dynamic';

interface ChatMessageRecord {
  id: string;
  channel_id: string;
  member_id: string; // author
  content: string | null;
  image_url: string | null;
  mentions: string[] | null;
}

interface WebhookBody {
  type?: string;
  table?: string;
  record?: ChatMessageRecord;
}

function snippetOf(record: ChatMessageRecord): string {
  const text = (record.content || '').trim();
  if (text) return text.length > 140 ? `${text.slice(0, 137)}…` : text;
  if (record.image_url) return '📷 Image';
  return 'New message';
}

// Invoked by a Supabase Database Webhook on chat_messages INSERT. The client
// inserts messages directly (components/chat/ChatApp.tsx), so this server-side
// webhook is how we learn about new messages to notify on.
//
// Policy (confirmed with product): push to every channel member except the
// author; email only to members who were @-mentioned.
export async function POST(request: Request) {
  const secret = process.env.CHAT_WEBHOOK_SECRET;
  if (!secret || request.headers.get('x-webhook-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const record = body.record;
  if (!record || !record.channel_id || !record.member_id) {
    return NextResponse.json({ error: 'Missing record' }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Channel (name + club scope) and author name.
  const [{ data: channel }, { data: author }] = await Promise.all([
    admin.from('chat_channels').select('id, name, club_id').eq('id', record.channel_id).maybeSingle(),
    admin.from('members').select('first_name, last_name').eq('id', record.member_id).maybeSingle(),
  ]);

  if (!channel) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  }

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
  recipientIds = recipientIds.filter((id) => id !== record.member_id);
  if (recipientIds.length === 0) {
    return NextResponse.json({ ok: true, notified: 0 });
  }

  const mentioned = new Set((record.mentions ?? []).filter((id) => recipientIds.includes(id)));
  const nonMentioned = recipientIds.filter((id) => !mentioned.has(id));

  const authorName =
    [author?.first_name, author?.last_name].filter(Boolean).join(' ').trim() || 'Someone';
  const channelName = channel.name || 'a channel';
  const snippet = snippetOf(record);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const url = `${siteUrl}/chat`;

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

  return NextResponse.json({ ok: true, notified: recipientIds.length, mentioned: mentioned.size });
}
