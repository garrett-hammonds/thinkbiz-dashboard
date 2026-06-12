export type ChatMember = {
  id: string;
  first_name: string;
  last_name: string;
  member_headshot: string | null;
};

export type ChatChannel = {
  id: string;
  name: string;
  description: string | null;
  club_id: string | null;
  joined: boolean;
};

export type ChatReaction = {
  member_id: string;
  emoji: string;
};

export type ChatMessage = {
  id: string;
  channel_id: string;
  member_id: string;
  content: string;
  image_url: string | null;
  mentions: string[];
  edited_at: string | null;
  created_at: string;
  chat_message_reactions: ChatReaction[];
};

export type Me = {
  memberId: string;
  authUserId: string;
  clubId: string | null;
  isAdmin: boolean;
  isDirector: boolean;
};

export function memberName(m: ChatMember | undefined): string {
  if (!m) return 'Former member';
  return `${m.first_name} ${m.last_name}`.trim();
}

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '👏', '🙏', '😮', '✅'];
