import type { MediaKind } from './types';

export const MEDIA_LIMITS = {
  imageBytes: 5 * 1024 * 1024,
  videoBytes: 100 * 1024 * 1024,
  documentBytes: 20 * 1024 * 1024,
  audioBytes: 25 * 1024 * 1024,
};

export function mediaKindForMime(mimeType: string): MediaKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf' || mimeType.startsWith('text/') || mimeType.includes('document') || mimeType.includes('spreadsheet')) return 'document';
  return 'other';
}

export function validateMediaFile(file: File, options: { maxBytes?: number; allowedMimeTypes?: string[] } = {}) {
  const kind = mediaKindForMime(file.type);
  const maxBytes = options.maxBytes ?? MEDIA_LIMITS[`${kind}Bytes` as keyof typeof MEDIA_LIMITS] ?? MEDIA_LIMITS.documentBytes;
  if (!file.type) throw new Error('This file has no detectable file type. Please choose another file.');
  if (options.allowedMimeTypes?.length && !options.allowedMimeTypes.includes(file.type)) throw new Error(`File type ${file.type} is not allowed here.`);
  if (file.size <= 0) throw new Error('The selected file is empty.');
  if (file.size > maxBytes) throw new Error(`File is too large. Maximum allowed size is ${Math.round(maxBytes / (1024 * 1024))} MB.`);
  return kind;
}

export function safeFileName(name: string) {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 120);
  return base || 'file';
}
