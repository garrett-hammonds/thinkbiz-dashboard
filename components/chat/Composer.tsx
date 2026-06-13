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
  const [imageUrl, setImageUrl] = useState<string | null>(null);
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
      const { data } = supabase.storage.from("chat-images").getPublicUrl(path);
      setImageUrl(data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const send = async () => {
    const trimmed = text.trim();
    if ((!trimmed && !imageUrl) || sending || uploading) return;

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
      await onSend(content, imageUrl, mentionIds);
      setText("");
      setImageUrl(null);
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

      {imageUrl && (
        <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-slate-50 p-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Attachment preview" className="h-14 w-14 rounded object-cover" />
          <button
            onClick={() => setImageUrl(null)}
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

      <div className="flex items-end gap-2">
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
          className="rounded-lg p-2.5 text-gray-500 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <ImagePlus className="h-5 w-5" />
        </button>
        <button
          onClick={() => setShowEmoji((v) => !v)}
          title="Add emoji"
          className={`rounded-lg p-2.5 transition-colors hover:bg-muted hover:text-foreground ${
            showEmoji ? "bg-muted text-foreground" : "text-gray-500"
          }`}
        >
          <Smile className="h-5 w-5" />
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
          className="max-h-40 min-h-[44px] flex-1 resize-y rounded-lg border border-gray-200 px-3 py-2.5 text-sm leading-relaxed focus:border-primary focus:outline-none"
        />
        <button
          onClick={send}
          disabled={sending || uploading || (!text.trim() && !imageUrl)}
          title="Send message"
          className="rounded-lg bg-primary p-2.5 text-white transition-colors hover:bg-secondary disabled:opacity-50"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
