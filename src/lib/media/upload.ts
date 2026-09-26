import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '../firebase';
import { optimizeImage } from './image';
import { mediaKindForMime, safeFileName, validateMediaFile } from './validation';
import type { MediaUploadMetadata, MediaUploadOptions } from './types';

export async function uploadMedia(file: File, options: MediaUploadOptions): Promise<MediaUploadMetadata> {
  const kind = validateMediaFile(file, options);
  const fileId = options.fileId ?? crypto.randomUUID();
  const originalName = safeFileName(file.name);
  let uploadBlob: Blob = file;
  let width: number | undefined;
  let height: number | undefined;

  if (kind === 'image' && options.optimizeImage !== false) {
    const optimized = await optimizeImage(file, options.imageMaxDimension, options.imageTargetBytes);
    uploadBlob = optimized.blob;
    width = optimized.width;
    height = optimized.height;
  }

  const extension = kind === 'image' ? 'webp' : (originalName.includes('.') ? originalName.split('.').pop() : 'bin');
  const storagePath = `${options.pathPrefix.replace(/\/+$/, '')}/${fileId}.${extension}`;
  const storageRef = ref(storage, storagePath);
  const task = uploadBytesResumable(storageRef, uploadBlob, {
    contentType: kind === 'image' ? 'image/webp' : file.type,
    customMetadata: { originalName, originalMimeType: file.type, originalBytes: String(file.size) },
  });

  const downloadUrl = await new Promise<string>((resolve, reject) => {
    task.on('state_changed', snapshot => {
      options.onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
    }, reject, async () => {
      try { resolve(await getDownloadURL(task.snapshot.ref)); } catch (error) { reject(error); }
    });
  });

  return {
    fileId, ownerId: options.ownerId, storagePath, downloadUrl, originalName,
    mimeType: kind === 'image' ? 'image/webp' : file.type, sizeBytes: uploadBlob.size,
    kind, status: 'uploaded', createdAt: new Date().toISOString(), width, height,
  };
}
