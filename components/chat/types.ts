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
  // 1:1 direct message. `name` holds the other participant's name and
  // `dm_partner_id` their member id (for headshot lookup in the directory).
  is_dm: boolean;
  dm_partner_id: string | null;
  joined: boolean;
};

export type ChatReaction = {
  member_id: string;
  emoji: string;
};

// A single attachment persisted on chat_messages.attachments (jsonb array).
// `path` is the private-bucket object path — chat-images for photos,
// chat-files for documents; the renderer picks the bucket from `kind`.
export type ChatAttachment = {
  path: string;
  kind: 'image' | 'file';
  name: string;
  mime: string;
  size: number;
};

export type ChatMessage = {
  id: string;
  channel_id: string;
  member_id: string;
  content: string;
  // Legacy single-image attachment (pre-attachments messages). New messages
  // leave this null and use `attachments` instead.
  image_url: string | null;
  attachments: ChatAttachment[];
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
