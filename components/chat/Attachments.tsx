"use client";

import type { ChatAttachment } from "./types";
import { ChatImage } from "./ChatImage";
import { ChatFile } from "./ChatFile";

// Renders a message's attachments: photos (single large image or a wrap grid of
// thumbnails) plus document chips. Falls back to the legacy single `image_url`
// for messages created before the attachments column existed.
export function Attachments({
  attachments,
  legacyImageUrl,
  hasContent,
}: {
  attachments: ChatAttachment[];
  legacyImageUrl: string | null;
  hasContent: boolean;
}) {
  const spacing = hasContent ? "mt-2" : "";

  if (attachments.length === 0) {
    if (!legacyImageUrl) return null;
    return (
      <div className={spacing}>
        <ChatImage stored={legacyImageUrl} />
      </div>
    );
  }

  const images = attachments.filter((a) => a.kind === "image");
  const files = attachments.filter((a) => a.kind === "file");
  const singleImage = images.length === 1 && files.length === 0;

  return (
    <div className={`${spacing} flex flex-col gap-2`}>
      {images.length > 0 &&
        (singleImage ? (
          <ChatImage stored={images[0].path} />
        ) : (
          <div className="flex flex-wrap gap-2">
            {images.map((img) => (
              <ChatImage
                key={img.path}
                stored={img.path}
                className="h-28 w-28 rounded-lg object-cover sm:h-32 sm:w-32"
              />
            ))}
          </div>
        ))}
      {files.map((file) => (
        <ChatFile key={file.path} attachment={file} />
      ))}
    </div>
  );
}
