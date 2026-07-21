"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { chatImageStoragePath } from "@/lib/chat/imagePath";
import { CHAT_IMAGE_BUCKET } from "@/lib/chat/attachments";

// Renders a chat image attachment from the private `chat-images` bucket.
//
// The bucket is private, so objects aren't reachable by URL — we mint a
// short-lived signed URL with the member's own session. Because the object path
// carries an unguessable UUID and is only obtainable from a message the viewer
// is RLS-permitted to read, this preserves per-channel isolation while keeping
// attachments off the public internet.
const SIGNED_URL_TTL_SECONDS = 3600;

// Default rendering: a single large-ish contained image (legacy single-image
// messages). Pass `className` to render a fixed-size grid thumbnail instead.
const DEFAULT_IMG_CLASS = "max-h-72 max-w-xs rounded-lg object-contain";

export function ChatImage({
  stored,
  className,
}: {
  stored: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const path = chatImageStoragePath(stored);
    const supabase = createClient();
    supabase.storage
      .from(CHAT_IMAGE_BUCKET)
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

  const imgClass = className ?? DEFAULT_IMG_CLASS;

  if (failed) {
    return <p className="text-xs text-gray-500">Image unavailable</p>;
  }

  if (!url) {
    // Lightweight placeholder while the signed URL resolves.
    return (
      <div className={`animate-pulse rounded-lg bg-muted ${className ? className : "h-40 w-40"}`} />
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Attachment" className={imgClass} />
    </a>
  );
}
