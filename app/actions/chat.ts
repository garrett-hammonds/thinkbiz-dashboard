'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { getChannelList, getChatUnreadTotal } from '@/utils/supabase/chatChannels';
import { dispatchChatMessageNotifications } from '@/lib/notifications/chat';
import { dispatchNotifications } from '@/lib/notifications/dispatch';
import { revalidatePath } from 'next/cache';
import type { ChannelMemberOption, ChatChannel, ChatMember } from '@/components/chat/types';
import type { DirectoryMember } from '@/utils/supabase/directory';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Fires push + email notifications for a just-sent chat message. The web client
// calls this (fire-and-forget) immediately after inserting a message, so chat
// notifications work without relying on a manually-configured Supabase Database
// Webhook. Best-effort and idempotent: the dispatcher claims the message
// atomically, so calling this more than once (or alongside the webhook) is safe.
export async function notifyChatMessage(messageId: string): Promise<void> {
  const id = (messageId || '').trim();
  if (!id) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const member = await getMemberForUser(supabase, user);
  if (!member) return;

  // Only the message's own author may trigger its notifications. This reads the
  // authoritative author server-side rather than trusting anything from the
  // client beyond the message id.
  const admin = createAdminClient();
  const { data: message } = await admin
    .from('chat_messages')
    .select('member_id')
    .eq('id', id)
    .maybeSingle();
  if (!message || message.member_id !== member.id) return;

  await dispatchChatMessageNotifications(id);
}

// Re-fetches the viewer's channel list. The chat client calls this when a
// realtime message arrives for a channel it doesn't know yet — which happens
// when someone opens a new DM with you while you have chat open.
export async function getMyChatChannels(): Promise<{
  channels: ChatChannel[];
  dmPartners: DirectoryMember[];
}> {
  const empty = { channels: [], dmPartners: [] };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return empty;

  const member = await getMemberForUser(supabase, user);
  if (!member) return empty;

  return getChannelList(supabase, member);
}

// Total unread for the menu badge. The app shell calls this on navigation and
// when the app comes back to the foreground, so the badge doesn't wait for a
// full page load to catch up.
export async function getMyChatUnreadTotal(): Promise<number> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  return getChatUnreadTotal(supabase);
}

export async function createChannel(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'Not authenticated' };
  }

  const member = await getMemberForUser(supabase, user);
  if (!member?.is_admin && !member?.club_director) {
    return { success: false, message: 'Only directors and admins can create channels' };
  }

  const name = (formData.get('name') as string)?.trim();
  const description = (formData.get('description') as string)?.trim() || null;

  if (!name) {
    return { success: false, message: 'Channel name is required' };
  }
  if (name.length > 60) {
    return { success: false, message: 'Channel name must be 60 characters or fewer' };
  }

  const { data: channel, error } = await supabase
    .from('chat_channels')
    .insert({ name, description, created_by: member.id })
    .select('id')
    .single();

  if (error || !channel) {
    if (error) console.error('[createChannel] insert failed:', error);
    return { success: false, message: 'Failed to create channel' };
  }

  // Creator joins their new channel right away
  await supabase
    .from('chat_channel_members')
    .upsert(
      { channel_id: channel.id, member_id: member.id, last_read_at: new Date().toISOString() },
      { onConflict: 'channel_id,member_id' }
    );

  revalidatePath('/chat');
  return { success: true, channelId: channel.id as string };
}

async function signedInMember() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const member = await getMemberForUser(supabase, user);
  return member ? { supabase, member } : null;
}

// An open channel the viewer may manage (its creator, or any admin) — the same
// rule as chat_can_manage_channel() in the database, which enforces it on every
// write below. Checked here too so reads through the service role stay scoped.
async function managedChannel(channelId: string, member: { id: string; is_admin?: boolean | null }) {
  if (!UUID.test(channelId)) return null;
  const admin = createAdminClient();
  const { data: channel } = await admin
    .from('chat_channels')
    .select('id, name, club_id, is_dm, created_by')
    .eq('id', channelId)
    .maybeSingle();
  if (!channel || channel.club_id || channel.is_dm) return null;
  if (!member.is_admin && channel.created_by !== member.id) return null;
  return channel as { id: string; name: string; created_by: string | null };
}

// Who is in a channel and who can still be added (every active member, across
// all clubs — directory visibility is platform-wide), for the members dialog.
export async function getChannelMembers(channelId: string): Promise<
  | { success: true; members: ChannelMemberOption[]; candidates: ChannelMemberOption[] }
  | { success: false; message: string }
> {
  const session = await signedInMember();
  if (!session) return { success: false, message: 'Not authenticated' };

  const channel = await managedChannel(channelId, session.member);
  if (!channel) {
    return { success: false, message: 'Only the channel’s creator or an admin can manage its members' };
  }

  const admin = createAdminClient();
  const [{ data: rows }, { data: active }, { data: clubs }] = await Promise.all([
    admin.from('chat_channel_members').select('member_id').eq('channel_id', channel.id),
    admin
      .from('members')
      .select('id, first_name, last_name, member_headshot, current_club_id')
      .eq('is_active', true),
    admin.from('clubs').select('id, name, display_name'),
  ]);

  const memberIds = new Set((rows ?? []).map((r) => r.member_id as string));
  const clubLabel = new Map(
    (clubs ?? []).map((c) => [c.id as string, (c.display_name || c.name || null) as string | null]),
  );

  type Row = ChatMember & { current_club_id: string | null };
  const toOption = (m: Row): ChannelMemberOption => ({
    id: m.id,
    first_name: m.first_name,
    last_name: m.last_name,
    member_headshot: m.member_headshot,
    club_label: m.current_club_id ? clubLabel.get(m.current_club_id) ?? null : null,
  });
  const byName = (a: ChannelMemberOption, b: ChannelMemberOption) =>
    `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);

  const activeRows = (active ?? []) as Row[];
  return {
    success: true,
    members: activeRows.filter((m) => memberIds.has(m.id)).map(toOption).sort(byName),
    candidates: activeRows.filter((m) => !memberIds.has(m.id)).map(toOption).sort(byName),
  };
}

// Adds members to an open channel the viewer manages and lets them know by
// push. Returns the added members so the chat can render their names.
export async function addChannelMembers(
  channelId: string,
  memberIds: string[],
): Promise<{ success: true; added: ChatMember[] } | { success: false; message: string }> {
  const session = await signedInMember();
  if (!session) return { success: false, message: 'Not authenticated' };
  const { supabase, member } = session;

  const ids = Array.from(new Set((memberIds ?? []).filter((id) => UUID.test(id)))).slice(0, 200);
  if (ids.length === 0) return { success: false, message: 'Pick at least one member to add' };

  const channel = await managedChannel(channelId, member);
  if (!channel) {
    return { success: false, message: 'Only the channel’s creator or an admin can add members' };
  }

  const admin = createAdminClient();
  const { data: people } = await admin
    .from('members')
    .select('id, first_name, last_name, member_headshot')
    .in('id', ids)
    .eq('is_active', true);
  const addable = (people ?? []) as ChatMember[];
  if (addable.length === 0) return { success: false, message: 'Those members can’t be added' };

  // The user client, so chat_channel_members' RLS has the final say. Already-in
  // members are skipped (ON CONFLICT DO NOTHING); `inserted` is who is new.
  const { data: inserted, error } = await supabase
    .from('chat_channel_members')
    .upsert(
      addable.map((p) => ({ channel_id: channel.id, member_id: p.id })),
      { onConflict: 'channel_id,member_id', ignoreDuplicates: true },
    )
    .select('member_id');

  if (error) {
    console.error('[addChannelMembers] insert failed:', error);
    return { success: false, message: 'Could not add members. Please try again.' };
  }

  const newIds = (inserted ?? [])
    .map((r) => r.member_id as string)
    .filter((id) => id !== member.id);
  if (newIds.length > 0) {
    const actor = `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim() || 'A director';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    await dispatchNotifications({
      category: 'chat',
      recipientMemberIds: newIds,
      push: {
        title: `You were added to #${channel.name}`,
        body: `${actor} added you to the #${channel.name} channel.`,
        url: `${siteUrl}/chat?channel=${channel.id}`,
        tag: `chat-${channel.id}`,
      },
    });
  }

  return { success: true, added: addable };
}

export async function removeChannelMember(
  channelId: string,
  memberId: string,
): Promise<{ success: boolean; message?: string }> {
  const session = await signedInMember();
  if (!session) return { success: false, message: 'Not authenticated' };
  if (!UUID.test(channelId) || !UUID.test(memberId)) {
    return { success: false, message: 'Could not remove that member' };
  }

  const { data, error } = await session.supabase
    .from('chat_channel_members')
    .delete()
    .eq('channel_id', channelId)
    .eq('member_id', memberId)
    .select('member_id');

  if (error || !data?.length) {
    if (error) console.error('[removeChannelMember] delete failed:', error);
    return { success: false, message: 'Could not remove that member' };
  }
  return { success: true };
}

// Deletes an open channel and all of its messages. Allowed for the channel's
// creator and admins (chat_channels_delete policy); club channels and DMs can't
// be deleted.
export async function deleteChannel(channelId: string): Promise<{ success: boolean; message?: string }> {
  const session = await signedInMember();
  if (!session) return { success: false, message: 'Not authenticated' };
  if (!UUID.test(channelId)) return { success: false, message: 'Could not delete that channel' };

  const { data, error } = await session.supabase
    .from('chat_channels')
    .delete()
    .eq('id', channelId)
    .select('id');

  if (error || !data?.length) {
    if (error) console.error('[deleteChannel] delete failed:', error);
    return {
      success: false,
      message: 'Only the channel’s creator or an admin can delete it',
    };
  }

  revalidatePath('/chat');
  return { success: true };
}
