import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getMemberForUser } from '@/utils/supabase/getMember';

import { Navbar } from '@/components/navbar';
import { ChatApp } from '@/components/chat/ChatApp';
import type { ChatChannel, ChatMember, Me } from '@/components/chat/types';

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const member = await getMemberForUser(supabase, user);

  if (!member) {
    redirect('/access-denied');
  }

  if (!member.profile_completed_at) {
    redirect('/onboarding');
  }

  const [
    { data: channelsData },
    { data: membershipsData },
    { data: directoryData },
    { data: unreadData },
  ] = await Promise.all([
    supabase
      .from('chat_channels')
      .select('id, name, description, club_id')
      .order('name'),
    supabase
      .from('chat_channel_members')
      .select('channel_id')
      .eq('member_id', member.id),
    supabase
      .from('members')
      .select('id, first_name, last_name, member_headshot')
      .eq('is_active', true)
      .order('first_name'),
    supabase.rpc('chat_unread_counts'),
  ]);

  const joinedIds = new Set((membershipsData || []).map((m) => m.channel_id as string));

  const channels: ChatChannel[] = (channelsData || []).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    club_id: c.club_id,
    joined: c.club_id ? c.club_id === member.current_club_id : joinedIds.has(c.id),
  }));

  const unreadCounts: Record<string, number> = {};
  for (const row of (unreadData as { channel_id: string; unread: number }[] | null) || []) {
    unreadCounts[row.channel_id] = Number(row.unread);
  }

  const me: Me = {
    memberId: member.id,
    authUserId: user.id,
    clubId: member.current_club_id,
    isAdmin: !!member.is_admin,
    isDirector: !!member.club_director,
  };

  return (
    <div className="flex h-dvh flex-col bg-gray-50">
      <Navbar />
      <main className="mx-auto flex w-full max-w-7xl flex-1 overflow-hidden px-0 sm:px-6 lg:px-8 sm:py-4">
        <ChatApp
          me={me}
          initialChannels={channels}
          directory={(directoryData as ChatMember[]) || []}
          initialUnread={unreadCounts}
        />
      </main>
    </div>
  );
}
