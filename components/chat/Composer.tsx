"use client";

import { useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { FileText, ImagePlus, Loader2, Paperclip, Send, Smile, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { ChatAttachment, ChatMember } from "./types";
import { memberName } from "./types";
import {
  CHAT_FILE_BUCKET,
  CHAT_IMAGE_BUCKET,
  FILE_ACCEPT,
  IMAGE_ACCEPT,
  MAX_ATTACHMENTS,
  MAX_FILE_BYTES,
  canonicalFileMime,
  formatBytes,
  isImageFile,
} from "@/lib/chat/attachments";

type Props = {
  directory: ChatMember[];
  authUserId: string;
  channelName: string;
  onSend: (content: string, attachments: ChatAttachment[], mentions: string[]) => Promise<void>;
};

type PendingMention = { id: string; name: string };

// One in-progress or ready attachment shown in the composer tray. `attachment`
// is populated once the upload finishes; `previewUrl` is a local object URL used
// for the image thumbnail (the buckets are private, so there's no public URL).
type PendingAttachment = {
  id: string;
  kind: "image" | "file";
  name: string;
  size: number;
  status: "uploading" | "done" | "error";
  error?: string;
  previewUrl?: string;
  attachment?: ChatAttachment;
};

const COMPOSER_EMOJIS = [
  "😀", "😄", "😂", "🤣", "😊", "😉", "😍", "🥰",
  "😎", "🤔", "🤗", "😅", "😢", "😮", "😴", "🤯",
  "👍", "👎", "👏", "🙌", "🙏", "🤝", "💪", "👋",
  "❤️", "💙", "💯", "🔥", "⭐", "✨", "🎉", "🎊",
  "✅", "❌", "❓", "❗", "💡", "📈", "📉", "💰",
  "🏆", "🎯", "🚀", "📅", "📞", "✉️", "☕", "🍕",
];

export function Composer({ directory, authUserId, channelName, onSend }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [suggestions, setSuggestions] = useState<ChatMember[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const mentionQueryRef = useRef<{ start: number; query: string } | null>(null);
  const pendingMentions = useRef<PendingMention[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploading = pending.some((p) => p.status === "uploading");
  const readyAttachments = pending
    .filter((p) => p.status === "done" && p.attachment)
    .map((p) => p.attachment as ChatAttachment);

  const updateSuggestions = (value: string, caret: number) => {
    const before = value.slice(0, caret);
    const match = before.match(/(?:^|\s)@([\w]*)$/);
    if (!match) {
      mentionQueryRef.current = null;
      setSuggestions([]);
      return;
    }
    const query = match[1].toLowerCase();
    mentionQueryRef.current = { start: caret - match[1].length - 1, query: match[1] };
    const results = directory
      .filter((m) => {
        const full = memberName(m).toLowerCase();
        return (
          m.first_name?.toLowerCase().startsWith(query) ||
          m.last_name?.toLowerCase().startsWith(query) ||
          full.startsWith(query)
        );
      })
      .slice(0, 6);
    setSuggestions(results);
    setHighlighted(0);
  };

  const pickMention = (m: ChatMember) => {
    const ta = textareaRef.current;
    const ctx = mentionQueryRef.current;
    if (!ta || !ctx) return;
    const name = memberName(m);
    const caret = ta.selectionStart;
    const next = text.slice(0, ctx.start) + `@${name} ` + text.slice(caret);
    pendingMentions.current = [
      ...pendingMentions.current.filter((p) => p.id !== m.id),
      { id: m.id, name },
    ];
    setText(next);
    setSuggestions([]);
    mentionQueryRef.current = null;
    requestAnimationFrame(() => {
      const pos = ctx.start + name.length + 2;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  };

  const insertEmoji = (emoji: string) => {
    const ta = textareaRef.current;
    const start = ta?.selectionStart ?? text.length;
    const end = ta?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    setShowEmoji(false);
    requestAnimationFrame(() => {
      if (!ta) return;
      const pos = start + emoji.length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  };

  const patchPending = (id: string, patch: Partial<PendingAttachment>) => {
    setPending((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  // Compress + upload a photo to the private chat-images bucket.
  const uploadImage = async (id: string, file: File) => {
    try {
      const supabase = createClient();
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        fileType: "image/webp",
      });
      const path = `${authUserId}/${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage
        .from(CHAT_IMAGE_BUCKET)
        .upload(path, compressed, { contentType: "image/webp" });
      if (uploadError) throw uploadError;
      patchPending(id, {
        status: "done",
        size: compressed.size,
        previewUrl: URL.createObjectURL(compressed),
        attachment: {
          path,
          kind: "image",
          name: file.name,
          mime: "image/webp",
          size: compressed.size,
        },
      });
    } catch (err) {
      patchPending(id, {
        status: "error",
        error: err instanceof Error ? err.message : "Upload failed",
      });
    }
  };

  // Upload a document to the private chat-files bucket, tagging it with the
  // canonical (allow-listed) mime so Storage accepts it.
  const uploadFile = async (id: string, file: File, mime: string) => {
    try {
      const supabase = createClient();
      const ext = file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase();
      const path = `${authUserId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(CHAT_FILE_BUCKET)
        .upload(path, file, { contentType: mime });
      if (uploadError) throw uploadError;
      patchPending(id, {
        status: "done",
        attachment: {
          path,
          kind: "file",
          name: file.name,
          mime,
          size: file.size,
        },
      });
    } catch (err) {
      patchPending(id, {
        status: "error",
        error: err instanceof Error ? err.message : "Upload failed",
      });
    }
  };

  const addFiles = (files: File[]) => {
    setError(null);
    const remaining = MAX_ATTACHMENTS - pending.length;
    if (remaining <= 0) {
      setError(`You can attach up to ${MAX_ATTACHMENTS} files per message.`);
      return;
    }
    const accepted = files.slice(0, remaining);
    if (files.length > accepted.length) {
      setError(`You can attach up to ${MAX_ATTACHMENTS} files per message.`);
    }

    for (const file of accepted) {
      const id = crypto.randomUUID();
      if (isImageFile(file)) {
        setPending((prev) => [
          ...prev,
          { id, kind: "image", name: file.name, size: file.size, status: "uploading" },
        ]);
        void uploadImage(id, file);
        continue;
      }
      const mime = canonicalFileMime(file.name);
      if (!mime) {
        setError(`"${file.name}" isn't a supported file type.`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        setError(`"${file.name}" is larger than ${formatBytes(MAX_FILE_BYTES)}.`);
        continue;
      }
      setPending((prev) => [
        ...prev,
        { id, kind: "file", name: file.name, size: file.size, status: "uploading" },
      ]);
      void uploadFile(id, file, mime);
    }
  };

  const removePending = (id: string) => {
    setPending((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const clearAttachments = () => {
    setPending((prev) => {
      for (const p of prev) if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      return [];
    });
  };

  const send = async () => {
    const trimmed = text.trim();
    if ((!trimmed && readyAttachments.length === 0) || sending || uploading) return;

    // Swap "@First Last" back to <@uuid> tokens for any mention the user kept
    let content = trimmed;
    const mentionIds: string[] = [];
    for (const p of pendingMentions.current) {
      const token = `@${p.name}`;
      if (content.includes(token)) {
        content = content.replace(token, `<@${p.id}>`);
        mentionIds.push(p.id);
      }
    }

    setSending(true);
    setError(null);
    try {
      await onSend(content, readyAttachments, mentionIds);
      setText("");
      clearAttachments();
      pendingMentions.current = [];
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlighted((h) => (h + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlighted((h) => (h - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pickMention(suggestions[highlighted]);
        return;
      }
      if (e.key === "Escape") {
        setSuggestions([]);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const atLimit = pending.length >= MAX_ATTACHMENTS;

  return (
    <div className="relative border-t border-gray-100 p-3">
      {suggestions.length > 0 && (
        <div className="absolute bottom-full left-3 z-10 mb-1 w-72 overflow-hidden rounded-lg border border-gray-100 bg-white shadow-card">
          {suggestions.map((m, i) => (
            <button
              key={m.id}
              onMouseDown={(e) => {
                e.preventDefault();
                pickMention(m);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                i === highlighted ? "bg-primary/10 text-primary" : "text-gray-900 hover:bg-muted"
              }`}
            >
              <span className="font-semibold">{memberName(m)}</span>
            </button>
          ))}
        </div>
      )}

      {pending.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pending.map((p) =>
            p.kind === "image" ? (
              <div
                key={p.id}
                className="relative h-16 w-16 overflow-hidden rounded-lg border border-gray-200 bg-slate-50"
              >
                {p.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.previewUrl} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                )}
                {p.status === "error" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-50/90 px-1 text-center text-[10px] font-semibold text-red-600">
                    Failed
                  </div>
                )}
                <button
                  onClick={() => removePending(p.id)}
                  title="Remove attachment"
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/50 p-0.5 text-white hover:bg-black/70"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div
                key={p.id}
                className="flex max-w-[13rem] items-center gap-2 rounded-lg border border-gray-200 bg-slate-50 py-1.5 pl-2 pr-1.5"
              >
                {p.status === "uploading" ? (
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin text-gray-400" />
                ) : (
                  <FileText
                    className={`h-5 w-5 shrink-0 ${
                      p.status === "error" ? "text-red-500" : "text-primary"
                    }`}
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-gray-900" title={p.name}>
                    {p.name}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {p.status === "error" ? "Upload failed" : formatBytes(p.size)}
                  </p>
                </div>
                <button
                  onClick={() => removePending(p.id)}
                  title="Remove attachment"
                  className="rounded p-1 text-gray-500 hover:bg-gray-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )
          )}
        </div>
      )}

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      {showEmoji && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowEmoji(false)} />
          <div className="absolute bottom-full left-3 z-20 mb-1 grid w-72 grid-cols-8 gap-0.5 rounded-lg border border-gray-100 bg-white p-2 shadow-card">
            {COMPOSER_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertEmoji(emoji);
                }}
                className="rounded p-1 text-lg hover:bg-muted"
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Mobile sizing follows the platform messaging apps the members are used
          to (tall rounded pill, base-size text, big round send button); lg:
          reverts to the compact desktop composer. */}
      <div className="flex items-end gap-1.5 lg:gap-2">
        <input
          ref={imageInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) addFiles(files);
            e.target.value = "";
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept={FILE_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) addFiles(files);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => imageInputRef.current?.click()}
          disabled={atLimit}
          title={atLimit ? `Up to ${MAX_ATTACHMENTS} attachments` : "Attach photos"}
          className="rounded-full p-3 text-gray-500 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 lg:rounded-lg lg:p-2.5"
        >
          <ImagePlus className="h-6 w-6 lg:h-5 lg:w-5" />
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={atLimit}
          title={atLimit ? `Up to ${MAX_ATTACHMENTS} attachments` : "Attach a file (PDF, CSV, …)"}
          className="rounded-full p-3 text-gray-500 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 lg:rounded-lg lg:p-2.5"
        >
          <Paperclip className="h-6 w-6 lg:h-5 lg:w-5" />
        </button>
        <button
          onClick={() => setShowEmoji((v) => !v)}
          title="Add emoji"
          className={`rounded-full p-3 transition-colors hover:bg-muted hover:text-foreground lg:rounded-lg lg:p-2.5 ${
            showEmoji ? "bg-muted text-foreground" : "text-gray-500"
          }`}
        >
          <Smile className="h-6 w-6 lg:h-5 lg:w-5" />
        </button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            updateSuggestions(e.target.value, e.target.selectionStart);
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={uploading ? "Uploading…" : `Message ${channelName}`}
          className="max-h-40 min-h-[3.25rem] flex-1 resize-none rounded-3xl border border-gray-300 px-4 py-3.5 text-base leading-relaxed focus:border-primary focus:outline-none lg:min-h-[44px] lg:resize-y lg:rounded-lg lg:border-gray-200 lg:px-3 lg:py-2.5 lg:text-sm"
        />
        <button
          onClick={send}
          disabled={sending || uploading || (!text.trim() && readyAttachments.length === 0)}
          title="Send message"
          className="rounded-full bg-primary p-3.5 text-white transition-colors hover:bg-secondary disabled:opacity-50 lg:rounded-lg lg:p-2.5"
        >
          <Send className="h-6 w-6 lg:h-5 lg:w-5" />
        </button>
      </div>
    </div>
  );
}
