"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { chatImageStoragePath } from "@/lib/chat/imagePath";

// Renders a chat image attachment from the private `chat-images` bucket.
//
// The bucket is private, so objects aren't reachable by URL — we mint a
// short-lived signed URL with the member's own session. Because the object path
// carries an unguessable UUID and is only obtainable from a message the viewer
// is RLS-permitted to read, this preserves per-channel isolation while keeping
// attachments off the public internet.
const SIGNED_URL_TTL_SECONDS = 3600;

export function ChatImage({ stored, hasContent }: { stored: string; hasContent: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const path = chatImageStoragePath(stored);
    const supabase = createClient();
    supabase.storage
      .from("chat-images")
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data?.signedUrl) {
          setFailed(true);
          return;
        }
        setUrl(data.signedUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [stored]);

  const wrapperClass = `${hasContent ? "mt-2 " : ""}max-h-72 max-w-xs rounded-lg object-contain`;

  if (failed) {
    return (
      <p className={`${hasContent ? "mt-2 " : ""}text-xs text-gray-500`}>Image unavailable</p>
    );
  }

  if (!url) {
    // Lightweight placeholder while the signed URL resolves.
    return <div className={`${hasContent ? "mt-2 " : ""}h-40 w-40 animate-pulse rounded-lg bg-muted`} />;
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Attachment" className={wrapperClass} />
    </a>
  );
}
