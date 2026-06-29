import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js';

export type DirectoryMember = {
  id: string;
  first_name: string;
  last_name: string;
  member_headshot: string | null;
};

const MEMBER_FIELDS = 'id, first_name, last_name, member_headshot';

// Service-role client. Member-visibility RLS only lets a member read their own
// row, so directory reads (which need to list fellow members) run with the
// service role and are explicitly scoped in code instead. Returns null when the
// key isn't configured so callers can degrade gracefully.
function adminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('[directory] SUPABASE_SERVICE_ROLE_KEY not set; directory will be empty.');
    return null;
  }
  return createAdminClient(url, key);
}

function byName(a: DirectoryMember, b: DirectoryMember): number {
  return a.first_name.localeCompare(b.first_name);
}

// Active members of a single club. Used by the weekly-log "thank you" picker.
export async function getClubDirectory(
  clubId: string | null,
): Promise<DirectoryMember[]> {
  if (!clubId) return [];
  const admin = adminClient();
  if (!admin) return [];

  const { data } = await admin
    .from('members')
    .select(MEMBER_FIELDS)
    .eq('current_club_id', clubId)
    .eq('is_active', true)
    .order('first_name');

  return (data as DirectoryMember[]) || [];
}

// Chat directory: the viewer's active club members, plus anyone who shares an
// open (cross-club) channel with them — so participants in those channels can
// be @mentioned and have their names rendered. Admins can access every open
// channel, so they see every open-channel participant.
export async function getChatDirectory(opts: {
  memberId: string;
  clubId: string | null;
  isAdmin: boolean;
}): Promise<DirectoryMember[]> {
  const admin = adminClient();
  if (!admin) return [];

  const byId = new Map<string, DirectoryMember>();

  // Admins can access every club channel, so they need every active member in
  // the directory to render names and @mention anyone, anywhere.
  if (opts.isAdmin) {
    const { data: allMembers } = await admin
      .from('members')
      .select(MEMBER_FIELDS)
      .eq('is_active', true);
    for (const m of (allMembers as DirectoryMember[]) || []) byId.set(m.id, m);
    return Array.from(byId.values()).sort(byName);
  }

  if (opts.clubId) {
    const { data: clubMembers } = await admin
      .from('members')
      .select(MEMBER_FIELDS)
      .eq('current_club_id', opts.clubId)
      .eq('is_active', true);
    for (const m of (clubMembers as DirectoryMember[]) || []) byId.set(m.id, m);
  }

  // Which open channels can the viewer see?
  let openChannelIds: string[] = [];
  if (opts.isAdmin) {
    const { data: openChannels } = await admin
      .from('chat_channels')
      .select('id')
      .is('club_id', null);
    openChannelIds = (openChannels || []).map((c) => c.id as string);
  } else {
    const { data: myMemberships } = await admin
      .from('chat_channel_members')
      .select('channel_id')
      .eq('member_id', opts.memberId);
    const myChannelIds = (myMemberships || []).map((r) => r.channel_id as string);
    if (myChannelIds.length > 0) {
      const { data: openChannels } = await admin
        .from('chat_channels')
        .select('id')
        .is('club_id', null)
        .in('id', myChannelIds);
      openChannelIds = (openChannels || []).map((c) => c.id as string);
    }
  }

  // Pull in co-members of those open channels that we don't already have.
  if (openChannelIds.length > 0) {
    const { data: coRows } = await admin
      .from('chat_channel_members')
      .select('member_id')
      .in('channel_id', openChannelIds);
    const coIds = [
      ...new Set((coRows || []).map((r) => r.member_id as string)),
    ].filter((id) => !byId.has(id));

    if (coIds.length > 0) {
      const { data: coMembers } = await admin
        .from('members')
        .select(MEMBER_FIELDS)
        .in('id', coIds);
      for (const m of (coMembers as DirectoryMember[]) || []) byId.set(m.id, m);
    }
  }

  return Array.from(byId.values()).sort(byName);
}
