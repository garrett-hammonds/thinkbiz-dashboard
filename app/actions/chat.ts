'use server';

import { createClient } from '@/utils/supabase/server';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { revalidatePath } from 'next/cache';

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
    return { success: false, message: error?.message || 'Failed to create channel' };
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
