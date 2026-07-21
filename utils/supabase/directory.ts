import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js';

export type DirectoryMember = {
  id: string;
  first_name: string;
  last_name: string;
  member_headshot: string | null;
};

// Card-level fields for the membership directory list. Contact details (email,
// phone, links) are deliberately absent — they load per-member on the profile
// page instead of shipping the whole roster's contact info to every browser.
export type DirectoryListMember = DirectoryMember & {
  company_name: string | null;
  title: string | null;
  club_seat: string | null;
  current_club_id: string | null;
};

// Full profile for /directory/[memberId]: the public-website member info plus
// the standard contact details members share with each other.
export type DirectoryProfile = DirectoryListMember & {
  bio: string | null;
  short_bio: string | null;
  core_skills: string[] | null;
  website_url: string | null;
  linkedin_url: string | null;
  booking_calendar_url: string | null;
  email: string | null;
  phone_number: string | null;
  member_since: string | null;
};

export type DirectoryClub = {
  id: string;
  name: string | null;
  display_name: string | null;
  area: string | null;
  city: string | null;
};

const MEMBER_FIELDS = 'id, first_name, last_name, member_headshot';

const LIST_FIELDS =
  `${MEMBER_FIELDS}, company_name, title, club_seat, current_club_id`;

const PROFILE_FIELDS =
  `${LIST_FIELDS}, bio, short_bio, core_skills, website_url, linkedin_url, ` +
  'booking_calendar_url, email, phone_number, member_since';

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

// Every active member, for the membership directory. Directory visibility is
// intentionally platform-wide (any member can look up any other member); the
// club filter is a UI default, not an access boundary.
export async function getMemberDirectory(): Promise<DirectoryListMember[]> {
  const admin = adminClient();
  if (!admin) return [];

  const { data } = await admin
    .from('members')
    .select(LIST_FIELDS)
    .eq('is_active', true)
    .order('first_name')
    .order('last_name');

  return (data as DirectoryListMember[] | null) || [];
}

// One member's directory profile. Returns null for unknown or inactive members
// so removed members drop out of the directory immediately.
export async function getDirectoryProfile(
  memberId: string,
): Promise<DirectoryProfile | null> {
  const admin = adminClient();
  if (!admin) return null;

  const { data } = await admin
    .from('members')
    .select(PROFILE_FIELDS)
    .eq('id', memberId)
    .eq('is_active', true)
    .maybeSingle();

  return (data as DirectoryProfile | null) || null;
}

// All clubs, for the directory's club + geographic-area filters.
export async function getDirectoryClubs(): Promise<DirectoryClub[]> {
  const admin = adminClient();
  if (!admin) return [];

  const { data } = await admin
    .from('clubs')
    .select('id, name, display_name, area, city')
    .order('name');

  return (data as DirectoryClub[] | null) || [];
}

// Directory member ids this viewer has starred.
export async function getStarredMemberIds(memberId: string): Promise<string[]> {
  const admin = adminClient();
  if (!admin) return [];

  const { data } = await admin
    .from('member_stars')
    .select('starred_member_id')
    .eq('member_id', memberId);

  return (data || []).map((r) => r.starred_member_id as string);
}

// The viewer's DM conversations: channel id -> the other participant. Used by
// the chat page to label DM channels with the partner's name and headshot.
export async function getDmPartners(
  memberId: string,
): Promise<Map<string, DirectoryMember>> {
  const partners = new Map<string, DirectoryMember>();
  const admin = adminClient();
  if (!admin) return partners;

  const { data: myDmRows } = await admin
    .from('chat_channel_members')
    .select('channel_id, chat_channels!inner(id, is_dm)')
    .eq('member_id', memberId)
    .eq('chat_channels.is_dm', true);

  const dmChannelIds = (myDmRows || []).map((r) => r.channel_id as string);
  if (dmChannelIds.length === 0) return partners;

  const { data: otherRows } = await admin
    .from('chat_channel_members')
    .select('channel_id, member_id')
    .in('channel_id', dmChannelIds)
    .neq('member_id', memberId);

  const partnerIds = [
    ...new Set((otherRows || []).map((r) => r.member_id as string)),
  ];
  if (partnerIds.length === 0) return partners;

  const { data: partnerMembers } = await admin
    .from('members')
    .select(MEMBER_FIELDS)
    .in('id', partnerIds);

  const byId = new Map(
    ((partnerMembers as DirectoryMember[]) || []).map((m) => [m.id, m]),
  );
  for (const row of otherRows || []) {
    const partner = byId.get(row.member_id as string);
    if (partner) partners.set(row.channel_id as string, partner);
  }
  return partners;
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
