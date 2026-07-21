import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getDmPartners, type DirectoryMember } from '@/utils/supabase/directory';
import type { ChatChannel } from '@/components/chat/types';

export type ChannelListMember = {
  id: string;
  current_club_id: string | null;
  is_admin?: boolean | null;
};

// Builds the channel list for the chat UI from the viewer's perspective:
// RLS-visible channels via the user client, DM channels labeled with the other
// participant's name (and their DirectoryMember returned so the UI can render
// names/headshots for partners outside the viewer's club directory).
export async function getChannelList(
  supabase: SupabaseClient,
  member: ChannelListMember,
): Promise<{ channels: ChatChannel[]; dmPartners: DirectoryMember[] }> {
  const [{ data: channelsData }, { data: membershipsData }, dmPartnerMap] =
    await Promise.all([
      supabase
        .from('chat_channels')
        .select('id, name, description, club_id, is_dm')
        .order('name'),
      supabase
        .from('chat_channel_members')
        .select('channel_id')
        .eq('member_id', member.id),
      getDmPartners(member.id),
    ]);

  const joinedIds = new Set(
    (membershipsData || []).map((m) => m.channel_id as string),
  );

  const channels: ChatChannel[] = (channelsData || []).map((c) => {
    const partner = c.is_dm ? dmPartnerMap.get(c.id as string) : undefined;
    return {
      id: c.id,
      // DMs are stored with a generic name; display the other participant.
      name: partner
        ? `${partner.first_name} ${partner.last_name}`.trim()
        : c.name,
      description: c.description,
      club_id: c.club_id,
      is_dm: !!c.is_dm,
      dm_partner_id: partner?.id ?? null,
      // Admins can read/post in every club channel (enforced by RLS), so treat
      // them as joined everywhere — this drives realtime unread badges.
      joined: c.club_id
        ? !!member.is_admin || c.club_id === member.current_club_id
        : joinedIds.has(c.id),
    };
  });

  return { channels, dmPartners: [...dmPartnerMap.values()] };
}
