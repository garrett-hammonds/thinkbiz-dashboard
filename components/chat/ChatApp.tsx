"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Hash, Lock, Plus, Compass, ArrowLeft, LogOut } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { createChannel, notifyChatMessage } from "@/app/actions/chat";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { Modal } from "@/components/Modal";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";
import type { ChatChannel, ChatMember, ChatMessage, ChatReaction, Me } from "./types";

const PAGE_SIZE = 50;

type Props = {
  me: Me;
  initialChannels: ChatChannel[];
  directory: ChatMember[];
  initialUnread: Record<string, number>;
};

export function ChatApp({ me, initialChannels, directory, initialUnread }: Props) {
  const supabase = useMemo(() => createClient(), []);

  const [channels, setChannels] = useState<ChatChannel[]>(initialChannels);
  const clubChannel = channels.find((c) => c.club_id && c.club_id === me.clubId);
  const joinedOpen = channels.filter((c) => !c.club_id && c.joined);
  const browseable = channels.filter((c) => !c.club_id && !c.joined);

  const [activeId, setActiveId] = useState<string | null>(
    clubChannel?.id ?? joinedOpen[0]?.id ?? null
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [unread, setUnread] = useState<Record<string, number>>(initialUnread);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [showBrowse, setShowBrowse] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const activeIdRef = useRef(activeId);
  const channelsRef = useRef(channels);
  useEffect(() => {
    activeIdRef.current = activeId;
    channelsRef.current = channels;
  }, [activeId, channels]);

  const directoryMap = useMemo(() => {
    const map = new Map<string, ChatMember>();
    for (const m of directory) map.set(m.id, m);
    return map;
  }, [directory]);

  const activeChannel = channels.find((c) => c.id === activeId) ?? null;

  const markRead = useCallback(
    async (channelId: string) => {
      await supabase.from("chat_channel_members").upsert(
        {
          channel_id: channelId,
          member_id: me.memberId,
          last_read_at: new Date().toISOString(),
        },
        { onConflict: "channel_id,member_id" }
      );
      setUnread((u) => (u[channelId] ? { ...u, [channelId]: 0 } : u));
    },
    [supabase, me.memberId]
  );

  const loadMessages = useCallback(
    async (channelId: string) => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*, chat_message_reactions(member_id, emoji)")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (activeIdRef.current !== channelId) return;
      const rows = ((data as ChatMessage[]) || []).reverse();
      setMessages(rows);
      setHasMore((data?.length ?? 0) === PAGE_SIZE);
      setLoadingMessages(false);
    },
    [supabase]
  );

  useEffect(() => {
    if (!activeId) return;
    loadMessages(activeId).then(() => markRead(activeId));
  }, [activeId, loadMessages, markRead]);

  const loadEarlier = useCallback(async () => {
    const channelId = activeIdRef.current;
    const oldest = messages[0];
    if (!channelId || !oldest) return;
    setLoadingEarlier(true);
    const { data } = await supabase
      .from("chat_messages")
      .select("*, chat_message_reactions(member_id, emoji)")
      .eq("channel_id", channelId)
      .lt("created_at", oldest.created_at)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    const rows = ((data as ChatMessage[]) || []).reverse();
    if (activeIdRef.current === channelId) {
      setMessages((prev) => [...rows, ...prev]);
      setHasMore((data?.length ?? 0) === PAGE_SIZE);
    }
    setLoadingEarlier(false);
  }, [supabase, messages]);

  // Realtime: messages and reactions across all channels we can see (RLS-filtered)
  useEffect(() => {
    const handleMessage = (payload: RealtimePostgresChangesPayload<ChatMessage>) => {
      if (payload.eventType === "INSERT") {
        const msg = { ...(payload.new as ChatMessage), chat_message_reactions: [] };
        if (msg.channel_id === activeIdRef.current) {
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          if (msg.member_id !== me.memberId) markRead(msg.channel_id);
        } else if (
          msg.member_id !== me.memberId &&
          channelsRef.current.some((c) => c.id === msg.channel_id && c.joined)
        ) {
          setUnread((u) => ({ ...u, [msg.channel_id]: (u[msg.channel_id] || 0) + 1 }));
        }
      } else if (payload.eventType === "UPDATE") {
        const msg = payload.new as ChatMessage;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id ? { ...m, content: msg.content, edited_at: msg.edited_at } : m
          )
        );
      } else if (payload.eventType === "DELETE") {
        const old = payload.old as Partial<ChatMessage>;
        if (old.id) setMessages((prev) => prev.filter((m) => m.id !== old.id));
      }
    };

    const handleReaction = (
      payload: RealtimePostgresChangesPayload<ChatReaction & { message_id: string }>
    ) => {
      const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as ChatReaction & {
        message_id?: string;
      };
      if (!row?.message_id) return;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== row.message_id) return m;
          const exists = m.chat_message_reactions.some(
            (r) => r.member_id === row.member_id && r.emoji === row.emoji
          );
          if (payload.eventType === "INSERT" && !exists) {
            return {
              ...m,
              chat_message_reactions: [
                ...m.chat_message_reactions,
                { member_id: row.member_id, emoji: row.emoji },
              ],
            };
          }
          if (payload.eventType === "DELETE" && exists) {
            return {
              ...m,
              chat_message_reactions: m.chat_message_reactions.filter(
                (r) => !(r.member_id === row.member_id && r.emoji === row.emoji)
              ),
            };
          }
          return m;
        })
      );
    };

    const channel = supabase
      .channel("member-chat")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages" },
        handleMessage
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_message_reactions" },
        handleReaction
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, me.memberId, markRead]);

  const selectChannel = (id: string) => {
    if (id !== activeIdRef.current) {
      setMessages([]);
      setLoadingMessages(true);
    }
    setActiveId(id);
    setMobileView("chat");
  };

  const handleSend = async (content: string, imageUrl: string | null, mentions: string[]) => {
    if (!activeId) return;
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        channel_id: activeId,
        member_id: me.memberId,
        content,
        image_url: imageUrl,
        mentions,
      })
      .select("*, chat_message_reactions(member_id, emoji)")
      .single();

    if (error) throw new Error(error.message);
    const msg = data as ChatMessage;
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    // Trigger push/email notifications server-side. Fire-and-forget: it's
    // best-effort and must never block or fail the send.
    void notifyChatMessage(msg.id).catch(() => {});
  };

  const handleEdit = async (messageId: string, content: string) => {
    const edited_at = new Date().toISOString();
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, content, edited_at } : m)));
    await supabase.from("chat_messages").update({ content, edited_at }).eq("id", messageId);
  };

  const handleDelete = async (messageId: string) => {
    if (!window.confirm("Delete this message?")) return;
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    await supabase.from("chat_messages").delete().eq("id", messageId);
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;
    const mine = msg.chat_message_reactions.some(
      (r) => r.member_id === me.memberId && r.emoji === emoji
    );
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        return mine
          ? {
              ...m,
              chat_message_reactions: m.chat_message_reactions.filter(
                (r) => !(r.member_id === me.memberId && r.emoji === emoji)
              ),
            }
          : {
              ...m,
              chat_message_reactions: [
                ...m.chat_message_reactions,
                { member_id: me.memberId, emoji },
              ],
            };
      })
    );
    if (mine) {
      await supabase
        .from("chat_message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("member_id", me.memberId)
        .eq("emoji", emoji);
    } else {
      await supabase
        .from("chat_message_reactions")
        .upsert(
          { message_id: messageId, member_id: me.memberId, emoji },
          { onConflict: "message_id,member_id,emoji" }
        );
    }
  };

  const handleJoin = async (channelId: string) => {
    await supabase.from("chat_channel_members").upsert(
      {
        channel_id: channelId,
        member_id: me.memberId,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: "channel_id,member_id" }
    );
    setChannels((prev) => prev.map((c) => (c.id === channelId ? { ...c, joined: true } : c)));
    setShowBrowse(false);
    selectChannel(channelId);
  };

  const handleLeave = async (channelId: string) => {
    if (!window.confirm("Leave this channel?")) return;
    await supabase
      .from("chat_channel_members")
      .delete()
      .eq("channel_id", channelId)
      .eq("member_id", me.memberId);
    setChannels((prev) => prev.map((c) => (c.id === channelId ? { ...c, joined: false } : c)));
    if (activeIdRef.current === channelId) {
      setMessages([]);
      setLoadingMessages(true);
      setActiveId(clubChannel?.id ?? null);
      setMobileView("list");
    }
  };

  const handleCreate = async (formData: FormData) => {
    setCreating(true);
    setCreateError(null);
    const result = await createChannel(formData);
    setCreating(false);
    if (!result.success || !result.channelId) {
      setCreateError(result.message || "Failed to create channel");
      return;
    }
    const name = (formData.get("name") as string).trim();
    const description = ((formData.get("description") as string) || "").trim() || null;
    setChannels((prev) => [
      ...prev,
      { id: result.channelId!, name, description, club_id: null, joined: true },
    ]);
    setShowCreate(false);
    selectChannel(result.channelId);
  };

  const canModerate = !!(
    me.isAdmin ||
    (me.isDirector && activeChannel?.club_id && activeChannel.club_id === me.clubId)
  );

  const unreadBadge = (count: number | undefined) =>
    count ? (
      <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-xs font-bold text-gray-900">
        {count > 99 ? "99+" : count}
      </span>
    ) : null;

  const channelButton = (c: ChatChannel) => (
    <button
      key={c.id}
      onClick={() => selectChannel(c.id)}
      className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
        c.id === activeId
          ? "bg-primary/10 font-semibold text-primary"
          : "text-gray-700 hover:bg-muted"
      }`}
    >
      {c.club_id ? (
        <Lock className="h-4 w-4 shrink-0 opacity-70" />
      ) : (
        <Hash className="h-4 w-4 shrink-0 opacity-70" />
      )}
      <span className="truncate">{c.name}</span>
      {unreadBadge(unread[c.id])}
      {!c.club_id && c.joined && (
        <span
          role="button"
          tabIndex={0}
          title="Leave channel"
          onClick={(e) => {
            e.stopPropagation();
            handleLeave(c.id);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.stopPropagation();
              handleLeave(c.id);
            }
          }}
          className="hidden shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 group-hover:inline-flex"
        >
          <LogOut className="h-3.5 w-3.5" />
        </span>
      )}
    </button>
  );

  return (
    <div className="flex w-full flex-1 overflow-hidden bg-white sm:rounded-xl sm:border sm:border-gray-100 sm:shadow-card">
      {/* Sidebar */}
      <aside
        className={`${
          mobileView === "list" ? "flex" : "hidden"
        } w-full flex-col border-r border-gray-100 bg-slate-50 md:flex md:w-64 md:shrink-0`}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-base font-bold text-foreground">Member Chat</h2>
          {me.isAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              title="Create channel"
              className="rounded-lg p-1.5 text-primary transition-colors hover:bg-primary/10"
            >
              <Plus className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {clubChannel && (
            <>
              <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                My Club
              </p>
              {channelButton(clubChannel)}
            </>
          )}

          <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Channels
          </p>
          {joinedOpen.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-500">No channels joined yet.</p>
          )}
          {joinedOpen.map(channelButton)}

          <button
            onClick={() => setShowBrowse(true)}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-primary transition-colors hover:bg-primary/10"
          >
            <Compass className="h-4 w-4" />
            Browse channels
          </button>
        </div>
      </aside>

      {/* Conversation pane */}
      <section
        className={`${mobileView === "chat" ? "flex" : "hidden"} min-w-0 flex-1 flex-col md:flex`}
      >
        {activeChannel ? (
          <>
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
              <button
                onClick={() => setMobileView("list")}
                className="mr-1 rounded-lg p-1 text-gray-500 hover:bg-muted md:hidden"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              {activeChannel.club_id ? (
                <Lock className="h-4 w-4 text-gray-400" />
              ) : (
                <Hash className="h-4 w-4 text-gray-400" />
              )}
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-foreground">
                  {activeChannel.name}
                </h3>
                {activeChannel.description && (
                  <p className="truncate text-xs text-gray-500">{activeChannel.description}</p>
                )}
              </div>
            </div>

            <MessageList
              messages={messages}
              me={me}
              directoryMap={directoryMap}
              canModerate={canModerate}
              loading={loadingMessages}
              hasMore={hasMore}
              loadingEarlier={loadingEarlier}
              onLoadEarlier={loadEarlier}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleReaction={handleToggleReaction}
            />

            <Composer
              key={activeChannel.id}
              directory={directory}
              authUserId={me.authUserId}
              channelName={activeChannel.name}
              onSend={handleSend}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-gray-500">
            <p>Select a channel to start chatting, or browse channels to join one.</p>
          </div>
        )}
      </section>

      {/* Browse channels modal */}
      {showBrowse && (
        <Modal title="Browse channels" onClose={() => setShowBrowse(false)}>
          {browseable.length === 0 ? (
            <p className="py-4 text-sm text-gray-500">
              No other channels to join right now.
              {me.isAdmin ? " Create one with the + button." : ""}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {browseable.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-3">
                  <Hash className="h-4 w-4 shrink-0 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
                    {c.description && (
                      <p className="truncate text-xs text-gray-500">{c.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleJoin(c.id)}
                    className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-secondary"
                  >
                    Join
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {/* Create channel modal (admins) */}
      {showCreate && (
        <Modal title="Create a channel" onClose={() => setShowCreate(false)}>
          <form action={handleCreate} className="flex flex-col gap-4">
            <div>
              <label htmlFor="channel-name" className="mb-1 block text-sm font-semibold text-foreground">
                Channel name
              </label>
              <input
                id="channel-name"
                name="name"
                required
                maxLength={60}
                placeholder="e.g. Referrals & Wins"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="channel-description" className="mb-1 block text-sm font-semibold text-foreground">
                Description <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <input
                id="channel-description"
                name="description"
                maxLength={200}
                placeholder="What is this channel for?"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            {createError && <p className="text-sm text-red-600">{createError}</p>}
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-secondary disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create channel"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
