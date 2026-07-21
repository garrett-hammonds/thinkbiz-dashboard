'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getMemberForUser } from '@/utils/supabase/getMember';

// Resolves the signed-in, active member or null. Directory actions are
// member-to-member, so an inactive (removed) member gets nothing.
async function requireActiveMember() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const member = await getMemberForUser(supabase, user);
  if (!member || !member.is_active) return null;
  return member;
}

// Star / unstar a directory profile. Writes go through the service role but
// are scoped in code to the caller's own member row (mirroring how the rest of
// the directory reads work); the member_stars RLS policies enforce the same
// owner-only rule for any direct client access.
export async function toggleMemberStar(
  targetMemberId: string,
  starred: boolean,
): Promise<{ success: boolean }> {
  const target = (targetMemberId || '').trim();
  const member = await requireActiveMember();
  if (!member || !target || target === member.id) return { success: false };

  const admin = createAdminClient();

  const { error } = starred
    ? await admin.from('member_stars').upsert(
        { member_id: member.id, starred_member_id: target },
        { onConflict: 'member_id,starred_member_id', ignoreDuplicates: true },
      )
    : await admin
        .from('member_stars')
        .delete()
        .eq('member_id', member.id)
        .eq('starred_member_id', target);

  if (error) {
    console.error('[toggleMemberStar] write failed:', error);
    return { success: false };
  }

  revalidatePath('/directory');
  revalidatePath(`/directory/${target}`);
  return { success: true };
}

// Opens (or creates) the 1:1 DM channel with another member, then lands the
// caller in that conversation. DM channels are ordinary chat channels with
// is_dm=true and exactly two membership rows; dm_key (sorted id pair) makes
// the conversation unique per pair, so a concurrent create from the other side
// resolves to the same channel.
export async function startDirectMessage(targetMemberId: string): Promise<void> {
  const target = (targetMemberId || '').trim();
  const member = await requireActiveMember();
  if (!member) redirect('/access-denied');
  if (!target || target === member.id) redirect('/directory');

  const admin = createAdminClient();

  const { data: targetMember } = await admin
    .from('members')
    .select('id, first_name, last_name, is_active')
    .eq('id', target)
    .eq('is_active', true)
    .maybeSingle();
  if (!targetMember) redirect('/directory');

  const dmKey = [member.id, target].sort().join(':');

  let channelId: string | null = null;
  const { data: existing } = await admin
    .from('chat_channels')
    .select('id')
    .eq('dm_key', dmKey)
    .maybeSingle();

  if (existing) {
    channelId = existing.id as string;
  } else {
    const { data: created, error: createError } = await admin
      .from('chat_channels')
      .insert({
        name: 'Direct message',
        description: null,
        is_dm: true,
        dm_key: dmKey,
        created_by: member.id,
      })
      .select('id')
      .single();

    if (createError) {
      // Unique violation on dm_key: the other member created it first. Fall
      // through to the re-select; anything else is a real failure.
      if (createError.code !== '23505') {
        console.error('[startDirectMessage] channel insert failed:', createError);
        redirect('/directory');
      }
      const { data: raced } = await admin
        .from('chat_channels')
        .select('id')
        .eq('dm_key', dmKey)
        .maybeSingle();
      channelId = (raced?.id as string) ?? null;
    } else {
      channelId = created.id as string;
    }
  }

  if (!channelId) redirect('/directory');

  // Both participants get membership rows (read-state). Idempotent, and the
  // upsert repairs a half-created pair from an interrupted earlier attempt.
  const now = new Date().toISOString();
  const { error: memberError } = await admin.from('chat_channel_members').upsert(
    [
      { channel_id: channelId, member_id: member.id, last_read_at: now },
      { channel_id: channelId, member_id: target, last_read_at: now },
    ],
    { onConflict: 'channel_id,member_id', ignoreDuplicates: true },
  );
  if (memberError) {
    console.error('[startDirectMessage] membership upsert failed:', memberError);
    redirect('/directory');
  }

  redirect(`/chat?channel=${channelId}`);
}
