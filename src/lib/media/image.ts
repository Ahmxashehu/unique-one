const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_TARGET_BYTES = 450 * 1024;

export interface OptimizedImage { blob: Blob; width: number; height: number; }

export function optimizeImage(file: File, maxDimension = DEFAULT_MAX_DIMENSION, targetBytes = DEFAULT_TARGET_BYTES): Promise<OptimizedImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) return reject(new Error('Image processing is not supported on this device.'));
      context.drawImage(image, 0, 0, width, height);
      const quality = file.size > targetBytes ? 0.78 : 0.86;
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('Unable to optimize this image.'));
        resolve({ blob, width, height });
      }, 'image/webp', quality);
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Unable to read the selected image.')); };
    image.src = url;
  });
}
