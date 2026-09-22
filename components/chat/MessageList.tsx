"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Trash2, SmilePlus } from "lucide-react";
import type { ChatMember, ChatMessage, Me } from "./types";
import { memberName, REACTION_EMOJIS } from "./types";
import { Attachments } from "./Attachments";

type Props = {
  messages: ChatMessage[];
  me: Me;
  directoryMap: Map<string, ChatMember>;
  canModerate: boolean;
  loading: boolean;
  hasMore: boolean;
  loadingEarlier: boolean;
  onLoadEarlier: () => void;
  onEdit: (messageId: string, content: string) => void;
  onDelete: (messageId: string) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
};

const MENTION_TOKEN = /<@([0-9a-fA-F-]{36})>/g;

function renderContent(
  content: string,
  directoryMap: Map<string, ChatMember>
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(MENTION_TOKEN);
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) parts.push(content.slice(lastIndex, match.index));
    parts.push(
      <span
        key={`${match.index}-${match[1]}`}
        className="rounded bg-primary/10 px-1 font-semibold text-primary"
      >
        @{memberName(directoryMap.get(match[1]))}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) parts.push(content.slice(lastIndex));
  return parts;
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

function Avatar({ member }: { member: ChatMember | undefined }) {
  if (member?.member_headshot) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={member.member_headshot}
        alt={memberName(member)}
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    );
  }
  const initials = member
    ? `${member.first_name?.[0] ?? ""}${member.last_name?.[0] ?? ""}`.toUpperCase()
    : "?";
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-sm font-bold text-secondary">
      {initials}
    </div>
  );
}

export function MessageList({
  messages,
  me,
  directoryMap,
  canModerate,
  loading,
  hasMore,
  loadingEarlier,
  onLoadEarlier,
  onEdit,
  onDelete,
  onToggleReaction,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const lastMessageId = messages.length ? messages[messages.length - 1].id : null;
  const prevLastId = useRef<string | null>(null);
  const prevCount = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const appended = lastMessageId !== prevLastId.current;
    const initialLoad = prevCount.current === 0 && messages.length > 0;
    if (initialLoad) {
      el.scrollTop = el.scrollHeight;
    } else if (appended) {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
      const lastIsMine =
        messages.length > 0 && messages[messages.length - 1].member_id === me.memberId;
      if (nearBottom || lastIsMine) el.scrollTop = el.scrollHeight;
    }
    prevLastId.current = lastMessageId;
    prevCount.current = messages.length;
  }, [lastMessageId, messages, me.memberId]);

  const startEdit = (m: ChatMessage) => {
    setEditingId(m.id);
    setEditDraft(m.content);
  };

  const commitEdit = () => {
    if (editingId && editDraft.trim()) onEdit(editingId, editDraft.trim());
    setEditingId(null);
  };

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
      {loading && <p className="py-8 text-center text-sm text-gray-500">Loading messages…</p>}

      {!loading && hasMore && (
        <div className="pb-2 text-center">
          <button
            onClick={onLoadEarlier}
            disabled={loadingEarlier}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
          >
            {loadingEarlier ? "Loading…" : "Load earlier messages"}
          </button>
        </div>
      )}

      {!loading && messages.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-500">
          No messages yet — be the first to say hello!
        </p>
      )}

      {messages.map((m, i) => {
        const sender = directoryMap.get(m.member_id);
        const prev = messages[i - 1];
        const newDay =
          !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
        const mentionsMe = m.mentions?.includes(me.memberId);
        const isMine = m.member_id === me.memberId;
        const canDeleteThis = isMine || canModerate;
        const bubbleClasses = mentionsMe
          ? "border-accent/50 bg-accent/10"
          : isMine
            ? "border-primary/15 bg-primary/5"
            : "border-gray-100 bg-slate-50";

        const reactionGroups = new Map<string, string[]>();
        for (const r of m.chat_message_reactions) {
          reactionGroups.set(r.emoji, [...(reactionGroups.get(r.emoji) || []), r.member_id]);
        }

        return (
          <div key={m.id}>
            {newDay && (
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-100" />
                <span className="text-xs font-semibold text-gray-500">
                  {dayLabel(m.created_at)}
                </span>
                <div className="h-px flex-1 bg-gray-100" />
              </div>
            )}

            <div className="group relative flex gap-3 px-2 py-1.5">
              <Avatar member={sender} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold text-foreground">{memberName(sender)}</span>
                  <span className="text-xs text-gray-500">{timeLabel(m.created_at)}</span>
                  {m.edited_at && <span className="text-xs italic text-gray-400">(edited)</span>}
                </div>

                {editingId === m.id ? (
                  <div className="mt-1">
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          commitEdit();
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      rows={2}
                      autoFocus
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    />
                    <div className="mt-1 flex gap-2">
                      <button
                        onClick={commitEdit}
                        className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-secondary"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded-lg px-3 py-1 text-xs font-semibold text-gray-500 hover:bg-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`mt-1 w-fit max-w-full rounded-lg rounded-tl-none border px-3 py-2 ${bubbleClasses}`}
                  >
                    {m.content && (
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-900">
                        {renderContent(m.content, directoryMap)}
                      </p>
                    )}
                    <Attachments
                      attachments={m.attachments ?? []}
                      legacyImageUrl={m.image_url}
                      hasContent={!!m.content}
                    />
                  </div>
                )}

                {reactionGroups.size > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {[...reactionGroups.entries()].map(([emoji, memberIds]) => {
                      const mine = memberIds.includes(me.memberId);
                      return (
                        <button
                          key={emoji}
                          onClick={() => onToggleReaction(m.id, emoji)}
                          title={memberIds
                            .map((id) => memberName(directoryMap.get(id)))
                            .join(", ")}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                            mine
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-gray-200 bg-white text-gray-700 hover:border-primary"
                          }`}
                        >
                          <span>{emoji}</span>
                          <span className="font-semibold">{memberIds.length}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Hover actions */}
              {editingId !== m.id && (
                <div className="absolute -top-3 right-2 hidden items-center gap-0.5 rounded-lg border border-gray-100 bg-white p-0.5 shadow-card group-hover:flex">
                  <button
                    onClick={() => setPickerFor(pickerFor === m.id ? null : m.id)}
                    title="Add reaction"
                    className="rounded p-1.5 text-gray-500 hover:bg-muted hover:text-foreground"
                  >
                    <SmilePlus className="h-4 w-4" />
                  </button>
                  {isMine && (
                    <button
                      onClick={() => startEdit(m)}
                      title="Edit message"
                      className="rounded p-1.5 text-gray-500 hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {canDeleteThis && (
                    <button
                      onClick={() => onDelete(m.id)}
                      title="Delete message"
                      className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}

              {pickerFor === m.id && (
                <div className="absolute right-2 top-6 z-10 flex gap-1 rounded-lg border border-gray-100 bg-white p-1.5 shadow-card">
                  {REACTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        onToggleReaction(m.id, emoji);
                        setPickerFor(null);
                      }}
                      className="rounded p-1 text-lg hover:bg-muted"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
