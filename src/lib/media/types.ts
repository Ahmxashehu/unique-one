export type MediaKind = 'image' | 'video' | 'document' | 'audio' | 'other';

export interface MediaUploadMetadata {
  fileId: string;
  ownerId: string;
  storagePath: string;
  downloadUrl: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  kind: MediaKind;
  status: 'uploaded';
  createdAt: string;
  width?: number;
  height?: number;
  durationMs?: number;
}

export interface MediaUploadOptions {
  ownerId: string;
  pathPrefix: string;
  fileId?: string;
  maxBytes?: number;
  allowedMimeTypes?: string[];
  optimizeImage?: boolean;
  imageMaxDimension?: number;
  imageTargetBytes?: number;
  onProgress?: (percent: number) => void;
}
