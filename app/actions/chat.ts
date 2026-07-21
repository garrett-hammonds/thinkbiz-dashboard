'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { getChannelList } from '@/utils/supabase/chatChannels';
import { dispatchChatMessageNotifications } from '@/lib/notifications/chat';
import { revalidatePath } from 'next/cache';
import type { ChatChannel } from '@/components/chat/types';
import type { DirectoryMember } from '@/utils/supabase/directory';

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

export async function createChannel(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'Not authenticated' };
  }

  const member = await getMemberForUser(supabase, user);
  if (!member?.is_admin) {
    return { success: false, message: 'Only admins can create channels' };
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
