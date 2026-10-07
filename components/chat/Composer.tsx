"use client";

import { useLayoutEffect, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { ArrowUp, FileText, ImagePlus, Loader2, Paperclip, Plus, Smile, X } from "lucide-react";
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
  // Identifies the conversation, so an unsent draft survives switching away
  // and back (the composer is remounted per channel).
  draftKey: string;
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

// Unsent drafts per conversation, for the life of the tab.
const drafts = new Map<string, { text: string; mentions: PendingMention[] }>();

// Grows with the text up to this height, then scrolls (about six lines).
const MAX_INPUT_HEIGHT_REM = 10;

// Touch-first devices (phones, tablets, the native app): the keyboard's
// return key inserts a newline and the send button sends, like every mobile
// messaging app. With a physical keyboard Enter sends, Shift+Enter breaks.
function isTouchFirst(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

const COMPOSER_EMOJIS = [
  "😀", "😄", "😂", "🤣", "😊", "😉", "😍", "🥰",
  "😎", "🤔", "🤗", "😅", "😢", "😮", "😴", "🤯",
  "👍", "👎", "👏", "🙌", "🙏", "🤝", "💪", "👋",
  "❤️", "💙", "💯", "🔥", "⭐", "✨", "🎉", "🎊",
  "✅", "❌", "❓", "❗", "💡", "📈", "📉", "💰",
  "🏆", "🎯", "🚀", "📅", "📞", "✉️", "☕", "🍕",
];

export function Composer({ directory, authUserId, channelName, draftKey, onSend }: Props) {
  const [text, setTextState] = useState(() => drafts.get(draftKey)?.text ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [suggestions, setSuggestions] = useState<ChatMember[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const mentionQueryRef = useRef<{ start: number; query: string } | null>(null);
  const pendingMentions = useRef<PendingMention[]>(drafts.get(draftKey)?.mentions ?? []);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const setText = (value: string) => {
    setTextState(value);
    if (value) drafts.set(draftKey, { text: value, mentions: pendingMentions.current });
    else drafts.delete(draftKey);
  };

  // Auto-grow: fit the textarea to its content, capped at MAX_INPUT_HEIGHT_REM
  // (then it scrolls). Measured in px against the live root font size, which
  // scales with the viewport on phones.
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const max = MAX_INPUT_HEIGHT_REM * rootPx;
    ta.style.height = "auto";
    const next = Math.min(ta.scrollHeight, max);
    ta.style.height = `${next}px`;
    ta.style.overflowY = ta.scrollHeight > max ? "auto" : "hidden";
  }, [text]);
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

    // Clear the box right away (the message shows up in the list as soon as
    // it's saved); put the text back if the send fails so nothing is lost.
    const draftText = text;
    const draftMentions = pendingMentions.current;
    const attachmentsToSend = readyAttachments;
    setSending(true);
    setError(null);
    pendingMentions.current = [];
    setText("");
    setSuggestions([]);
    try {
      await onSend(content, attachmentsToSend, mentionIds);
      clearAttachments();
    } catch (err) {
      pendingMentions.current = draftMentions;
      setText(draftText);
      setError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSending(false);
      // Keep the keyboard up for the next message.
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Never act on keys that belong to an IME composition (e.g. picking a
    // Japanese candidate or an autocorrect suggestion with Enter).
    if (e.nativeEvent.isComposing) return;
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
    if (e.key === "Enter" && !e.shiftKey && !isTouchFirst()) {
      e.preventDefault();
      send();
    }
  };

  const atLimit = pending.length >= MAX_ATTACHMENTS;
  const canSend = !sending && !uploading && (!!text.trim() || readyAttachments.length > 0);

  return (
    <div className="relative border-t border-gray-100 p-3">
      {suggestions.length > 0 && (
        <div className="absolute bottom-full left-3 z-10 mb-1 w-72 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-gray-100 bg-white shadow-card">
          {suggestions.map((m, i) => (
            <button
              key={m.id}
              type="button"
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
                  type="button"
                  aria-label={`Remove ${p.name}`}
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
                  type="button"
                  aria-label={`Remove ${p.name}`}
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
                type="button"
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

      {showAttachMenu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowAttachMenu(false)} />
          <div className="absolute bottom-full left-3 z-20 mb-1 w-56 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-card">
            <button
              type="button"
              onClick={() => {
                setShowAttachMenu(false);
                imageInputRef.current?.click();
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-base text-gray-900 hover:bg-muted"
            >
              <ImagePlus className="h-5 w-5 text-primary" aria-hidden="true" />
              Photos
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAttachMenu(false);
                fileInputRef.current?.click();
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-base text-gray-900 hover:bg-muted"
            >
              <Paperclip className="h-5 w-5 text-primary" aria-hidden="true" />
              File
            </button>
          </div>
        </>
      )}

      {/* Phones: one "+" (photos / file) on the left, the text field taking the
          rest of the row, and a round send button — the emoji button is
          dropped because the keyboard has one. Desktop keeps the direct
          photo / file / emoji buttons. Buttons stay bottom-aligned as the
          field grows. */}
      <div className="flex items-end gap-2">
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
          type="button"
          onClick={() => setShowAttachMenu((v) => !v)}
          disabled={atLimit}
          aria-label="Add attachment"
          aria-expanded={showAttachMenu}
          title={atLimit ? `Up to ${MAX_ATTACHMENTS} attachments` : "Add photos or a file"}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40 lg:hidden ${
            showAttachMenu ? "bg-primary/10 text-primary" : "text-gray-500 hover:bg-muted"
          }`}
        >
          <Plus className={`h-6 w-6 transition-transform ${showAttachMenu ? "rotate-45" : ""}`} />
        </button>

        <div className="hidden shrink-0 items-center lg:flex">
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={atLimit}
            aria-label="Attach photos"
            title={atLimit ? `Up to ${MAX_ATTACHMENTS} attachments` : "Attach photos"}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <ImagePlus className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={atLimit}
            aria-label="Attach a file"
            title={atLimit ? `Up to ${MAX_ATTACHMENTS} attachments` : "Attach a file (PDF, CSV, …)"}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setShowEmoji((v) => !v)}
            aria-label="Add emoji"
            aria-expanded={showEmoji}
            title="Add emoji"
            className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-muted hover:text-foreground ${
              showEmoji ? "bg-muted text-foreground" : "text-gray-500"
            }`}
          >
            <Smile className="h-5 w-5" />
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            updateSuggestions(e.target.value, e.target.selectionStart);
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          aria-label={`Message ${channelName}`}
          placeholder={uploading ? "Uploading…" : `Message ${channelName}`}
          autoCapitalize="sentences"
          autoCorrect="on"
          spellCheck
          enterKeyHint="enter"
          className="block min-h-11 min-w-0 flex-1 resize-none overflow-y-hidden rounded-[1.375rem] border border-gray-300 bg-white px-4 py-2.5 text-base leading-6 placeholder:text-gray-400 focus:border-primary focus:outline-none lg:min-h-10 lg:rounded-lg lg:border-gray-200 lg:px-3 lg:py-2 lg:text-sm"
        />

        <button
          type="button"
          // Keep focus (and the phone keyboard) in the text field on tap.
          onMouseDown={(e) => e.preventDefault()}
          onClick={send}
          disabled={!canSend}
          aria-label="Send message"
          title="Send message"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-secondary disabled:bg-gray-200 disabled:text-gray-400 lg:h-10 lg:w-10 lg:rounded-lg"
        >
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-6 w-6 lg:h-5 lg:w-5" />}
        </button>
      </div>
    </div>
  );
}
