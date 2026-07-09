"use client";

import { useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { ImagePlus, Send, Smile, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { ChatMember } from "./types";
import { memberName } from "./types";

type Props = {
  directory: ChatMember[];
  authUserId: string;
  channelName: string;
  onSend: (content: string, imageUrl: string | null, mentions: string[]) => Promise<void>;
};

type PendingMention = { id: string; name: string };

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
  // `imagePath` is the private-bucket object path we persist on the message;
  // `imagePreview` is a local object URL used only for the composer thumbnail
  // (the bucket is private, so we can't show it via a public URL).
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [suggestions, setSuggestions] = useState<ChatMember[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const mentionQueryRef = useRef<{ start: number; query: string } | null>(null);
  const pendingMentions = useRef<PendingMention[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFile = async (file: File) => {
    setUploading(true);
    setError(null);
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
        .from("chat-images")
        .upload(path, compressed, { contentType: "image/webp" });
      if (uploadError) throw uploadError;
      // Persist the object PATH (not a public URL) — the bucket is private and
      // the message renderer mints a signed URL on view.
      setImagePath(path);
      setImagePreview(URL.createObjectURL(compressed));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePath(null);
    setImagePreview(null);
  };

  const send = async () => {
    const trimmed = text.trim();
    if ((!trimmed && !imagePath) || sending || uploading) return;

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
      await onSend(content, imagePath, mentionIds);
      setText("");
      clearImage();
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

      {imagePreview && (
        <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-slate-50 p-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagePreview} alt="Attachment preview" className="h-14 w-14 rounded object-cover" />
          <button
            onClick={clearImage}
            title="Remove attachment"
            className="rounded p-1 text-gray-500 hover:bg-gray-200"
          >
            <X className="h-4 w-4" />
          </button>
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
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Attach image"
          className="rounded-full p-3 text-gray-500 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 lg:rounded-lg lg:p-2.5"
        >
          <ImagePlus className="h-6 w-6 lg:h-5 lg:w-5" />
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
          placeholder={uploading ? "Uploading image…" : `Message ${channelName}`}
          className="max-h-40 min-h-[3.25rem] flex-1 resize-none rounded-3xl border border-gray-300 px-4 py-3.5 text-base leading-relaxed focus:border-primary focus:outline-none lg:min-h-[44px] lg:resize-y lg:rounded-lg lg:border-gray-200 lg:px-3 lg:py-2.5 lg:text-sm"
        />
        <button
          onClick={send}
          disabled={sending || uploading || (!text.trim() && !imagePath)}
          title="Send message"
          className="rounded-full bg-primary p-3.5 text-white transition-colors hover:bg-secondary disabled:opacity-50 lg:rounded-lg lg:p-2.5"
        >
          <Send className="h-6 w-6 lg:h-5 lg:w-5" />
        </button>
      </div>
    </div>
  );
}
