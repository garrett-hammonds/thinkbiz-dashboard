"use client";

import { useEffect, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { ChatAttachment } from "./types";
import { CHAT_FILE_BUCKET, formatBytes } from "@/lib/chat/attachments";

// Renders a document attachment (PDF, CSV, XLSX, …) from the private
// `chat-files` bucket. Like ChatImage, the bucket is private, so we mint a
// short-lived signed URL with the member's own session. The URL carries a
// download disposition (original filename) so clicking saves the file.
const SIGNED_URL_TTL_SECONDS = 3600;

export function ChatFile({ attachment }: { attachment: ChatAttachment }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabase.storage
      .from(CHAT_FILE_BUCKET)
      .createSignedUrl(attachment.path, SIGNED_URL_TTL_SECONDS, { download: attachment.name })
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
  }, [attachment.path, attachment.name]);

  const boxClass =
    "flex w-full max-w-xs items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2";

  const body = (
    <>
      <FileText className="h-6 w-6 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900" title={attachment.name}>
          {attachment.name}
        </p>
        <p className="text-xs text-gray-500">
          {failed ? "Unavailable" : formatBytes(attachment.size)}
        </p>
      </div>
      {failed ? null : url ? (
        <Download className="h-4 w-4 shrink-0 text-gray-400" />
      ) : (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-400" />
      )}
    </>
  );

  if (failed || !url) {
    return <div className={boxClass}>{body}</div>;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={attachment.name}
      className={`${boxClass} transition-colors hover:border-primary hover:bg-slate-50`}
    >
      {body}
    </a>
  );
}
