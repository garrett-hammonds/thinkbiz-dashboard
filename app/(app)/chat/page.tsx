import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { membershipGateRedirect } from '@/utils/membership';
import { getChatDirectory } from '@/utils/supabase/directory';
import { getChannelList } from '@/utils/supabase/chatChannels';
import { createAdminClient } from '@/utils/supabase/admin';

import { ChatApp } from '@/components/chat/ChatApp';
import { ChatGuidelines } from '@/components/chat/ChatGuidelines';
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

  // Chat opens only after the member has accepted the guidelines once. The
  // strict null check skips the prompt if the column doesn't exist yet (code
  // deployed before the chat_safety migration) instead of trapping everyone.
  if (member.chat_guidelines_accepted_at === null) {
    return (
      <main className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 overflow-hidden px-0 lg:px-8 lg:py-4">
        <ChatGuidelines />
      </main>
    );
  }

  // Safety state: who I've blocked (own rows, RLS; ChatApp leaves their
  // messages out of every chat query), who has blocked me and
  // whether I'm suspended (service role — those rows aren't client-readable).
  const admin = createAdminClient();
  const [
    { channels, dmPartners },
    directoryData,
    { data: unreadData },
    params,
    { data: myBlocks },
    { data: blocksOnMe },
    { data: suspension },
  ] =
    await Promise.all([
      getChannelList(supabase, member),
      getChatDirectory({
        memberId: member.id,
        clubId: member.current_club_id,
        isAdmin: !!member.is_admin,
      }),
      supabase.rpc('chat_unread_counts'),
      searchParams,
      supabase.from('member_dm_blocks').select('blocked_id').eq('blocker_id', member.id),
      admin.from('member_dm_blocks').select('blocker_id').eq('blocked_id', member.id),
      admin.from('chat_suspensions').select('member_id').eq('member_id', member.id).maybeSingle(),
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
    // data-fill-screen pins this page to one screen height (see globals.css)
    // so the message list scrolls and the composer stays on screen.
    <main
      data-fill-screen
      className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 overflow-hidden px-0 lg:px-8 lg:py-4"
    >
      <ChatApp
        me={me}
        initialChannels={channels}
        directory={directory}
        initialUnread={unreadCounts}
        initialActiveId={initialActiveId}
        initialBlockedIds={(myBlocks ?? []).map((b) => b.blocked_id as string)}
        blockedByIds={(blocksOnMe ?? []).map((b) => b.blocker_id as string)}
        suspended={!!suspension}
      />
    </main>
  );
}
