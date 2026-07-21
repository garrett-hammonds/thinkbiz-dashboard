import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { membershipGateRedirect } from '@/utils/membership';
import { getChatDirectory } from '@/utils/supabase/directory';
import { getChannelList } from '@/utils/supabase/chatChannels';

import { ChatApp } from '@/components/chat/ChatApp';
import type { ChatMember, Me } from '@/components/chat/types';

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string }>;
}) {
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

  const gate = membershipGateRedirect(member);
  if (gate) {
    redirect(gate);
  }

  const [{ channels, dmPartners }, directoryData, { data: unreadData }, params] =
    await Promise.all([
      getChannelList(supabase, member),
      getChatDirectory({
        memberId: member.id,
        clubId: member.current_club_id,
        isAdmin: !!member.is_admin,
      }),
      supabase.rpc('chat_unread_counts'),
      searchParams,
    ]);

  // DM partners can live outside the viewer's club/channel directory; merge
  // them in so their names and headshots render.
  const directory: ChatMember[] = [...(directoryData as ChatMember[])];
  const known = new Set(directory.map((m) => m.id));
  for (const partner of dmPartners) {
    if (!known.has(partner.id)) directory.push(partner);
  }

  const unreadCounts: Record<string, number> = {};
  for (const row of (unreadData as { channel_id: string; unread: number }[] | null) || []) {
    unreadCounts[row.channel_id] = Number(row.unread);
  }

  // Deep link from the directory ("Message" button): open that conversation
  // directly, but only if it's really one of the viewer's channels.
  const requestedId = (params.channel || '').trim();
  const initialActiveId =
    requestedId && channels.some((c) => c.id === requestedId && c.joined)
      ? requestedId
      : null;

  const me: Me = {
    memberId: member.id,
    authUserId: user.id,
    clubId: member.current_club_id,
    isAdmin: !!member.is_admin,
    isDirector: !!member.club_director,
  };

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 overflow-hidden px-0 lg:px-8 lg:py-4">
      <ChatApp
        me={me}
        initialChannels={channels}
        directory={directory}
        initialUnread={unreadCounts}
        initialActiveId={initialActiveId}
      />
    </main>
  );
}
