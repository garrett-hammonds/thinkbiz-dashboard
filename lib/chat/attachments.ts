// Shared constants + helpers for chat attachments (photos and documents).
//
// A message may carry up to MAX_ATTACHMENTS items, each either an "image"
// (compressed to webp, stored in the chat-images bucket) or a "file" (a
// document such as PDF/CSV/XLSX, stored in the chat-files bucket). The DB and
// Storage enforce their own limits; these values keep the client UX in sync
// with the server-side guards in 20260721170000_chat_attachments.sql.

import type { ChatAttachment } from '@/components/chat/types';

export const MAX_ATTACHMENTS = 5;

export const CHAT_IMAGE_BUCKET = 'chat-images';
export const CHAT_FILE_BUCKET = 'chat-files';

// Post-compression cap for photos (chat-images bucket allows 2 MB).
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
// Document cap (chat-files bucket allows 10 MB).
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

// Document types accepted by the chat-files bucket. The client uploads each
// file with the canonical mime below (keyed by extension) so the upload's
// Content-Type always matches the bucket's allowed_mime_types allow-list, even
// when the browser reports an empty or non-standard type for e.g. CSV files.
export const FILE_MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  csv: 'text/csv',
  txt: 'text/plain',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

// `accept` attribute for the document file picker.
export const FILE_ACCEPT = Object.keys(FILE_MIME_BY_EXT)
  .map((ext) => `.${ext}`)
  .join(',');

export const IMAGE_ACCEPT = 'image/*';

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

// Canonical, allow-listed mime for a document, or null if the extension isn't
// an accepted document type.
export function canonicalFileMime(name: string): string | null {
  return FILE_MIME_BY_EXT[fileExtension(name)] ?? null;
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export function attachmentBucket(kind: ChatAttachment['kind']): string {
  return kind === 'image' ? CHAT_IMAGE_BUCKET : CHAT_FILE_BUCKET;
}

// Human-readable size, e.g. "3.2 MB", "812 KB".
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}
