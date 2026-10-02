export type DeviceMediaKind = 'video' | 'audio' | 'image' | 'pdf' | 'other';

export type DeviceMediaItem = {
  id: string;
  file: File;
  kind: DeviceMediaKind;
  url: string;
  parentHandle?: any;
  entryName?: string;
  isNew?: boolean;
};

export type DeviceMediaScan = { items: DeviceMediaItem[]; rootName: string; handle: any };
type NativeMediaRecord = { id: string; name: string; mime: string; size: number; url: string; isNew?: boolean };
type NativeBridge = { requestMediaAccess: () => void; hasMediaAccess: () => boolean; listMedia: () => string; listMediaPage?: (offset: number, limit: number) => string; getSharedMedia?: () => string; shareNativeMedia?: (idsJson: string) => boolean; markMediaSeen?: (id: string) => void; deleteMedia?: (id: string) => boolean; playBackgroundMedia?: (idsJson: string, index: number) => boolean; pauseBackgroundMedia?: () => void; resumeBackgroundMedia?: () => void; stopBackgroundMedia?: () => void };

const nativeBridge = (): NativeBridge | null =>
  typeof window !== 'undefined' ? ((window as any).UniqueNativeStorage || null) as NativeBridge | null : null;

export const supportsNativeAndroidStorage = () => Boolean(nativeBridge());

export const requestNativeMediaAccess = async (): Promise<boolean> => {
  const bridge = nativeBridge();
  if (!bridge) return false;
  if (bridge.hasMediaAccess()) return true;
  return new Promise((resolve) => {
    const handler = (event: Event) => {
      window.removeEventListener('mediaAccessResult', handler);
      resolve(Boolean((event as CustomEvent<{ granted?: boolean }>).detail?.granted));
    };
    window.addEventListener('mediaAccessResult', handler);
    bridge.requestMediaAccess();
  });
};

export const loadNativeAndroidMedia = async (offset = 0, limit = 100): Promise<DeviceMediaItem[]> => {
  const bridge = nativeBridge();
  if (!bridge || !bridge.hasMediaAccess()) return [];
  const records = JSON.parse(bridge.listMediaPage ? bridge.listMediaPage(offset, limit) : bridge.listMedia()) as NativeMediaRecord[];
  const items: DeviceMediaItem[] = [];
  for (const record of records) {
    const response = await fetch(record.url);
    const blob = await response.blob();
    const file = new File([blob], record.name, { type: record.mime });
    const kind = kindForDeviceFile(file);
    if (!kind) continue;
    items.push({ id: record.id, file, kind, url: record.url, isNew: Boolean(record.isNew) });
  }
  return items;
};

export const markNativeMediaSeen = (item: DeviceMediaItem): void => {
  nativeBridge()?.markMediaSeen?.(item.id);
  item.isNew = false;
};

export const deleteNativeMedia = (item: DeviceMediaItem): boolean => { const bridge = nativeBridge(); if (!bridge?.deleteMedia) return false; return Boolean(bridge.deleteMedia(item.id)); };

export const playNativeBackgroundMedia = (items: DeviceMediaItem[], index: number): boolean => { const bridge = nativeBridge(); if (!bridge?.playBackgroundMedia || !items.length) return false; return Boolean(bridge.playBackgroundMedia(JSON.stringify(items.map((item) => item.id)), Math.max(0, Math.min(index, items.length - 1)))); };
export const pauseNativeBackgroundMedia = (): void => { nativeBridge()?.pauseBackgroundMedia?.(); };
export const resumeNativeBackgroundMedia = (): void => { nativeBridge()?.resumeBackgroundMedia?.(); };
export const stopNativeBackgroundMedia = (): void => { nativeBridge()?.stopBackgroundMedia?.(); };
export const toggleNativeBackgroundRepeat = (): void => { nativeBridge()?.backgroundToggleRepeat?.(); };
export const toggleNativeBackgroundShuffle = (): void => { nativeBridge()?.backgroundToggleShuffle?.(); };

export const shareNativeMedia = (items: DeviceMediaItem[]): boolean => {
  const bridge = nativeBridge();
  if (!bridge?.shareNativeMedia || !items.length) return false;
  return Boolean(bridge.shareNativeMedia(JSON.stringify(items.map((item) => item.id))));
};

export const loadNativeSharedMedia = async (): Promise<DeviceMediaItem[]> => {
  const bridge = nativeBridge();
  if (!bridge?.getSharedMedia) return [];
  const records = JSON.parse(bridge.getSharedMedia()) as NativeMediaRecord[];
  const items: DeviceMediaItem[] = [];
  for (const record of records) {
    const response = await fetch(record.url);
    const blob = await response.blob();
    const file = new File([blob], record.name, { type: record.mime });
    const kind = kindForDeviceFile(file);
    if (!kind) continue;
    items.push({ id: record.id, file, kind, url: record.url });
  }
  return items;
};

const MEDIA_HANDLE_DB = 'unique-media-device-access';
const MEDIA_HANDLE_STORE = 'handles';
const openMediaHandleDb = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(MEDIA_HANDLE_DB, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(MEDIA_HANDLE_STORE);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
export const rememberDeviceMediaDirectory = async (handle: any): Promise<void> => {
  const db = await openMediaHandleDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(MEDIA_HANDLE_STORE, 'readwrite').objectStore(MEDIA_HANDLE_STORE).put(handle, 'root');
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
  });
  db.close();
};
export const getStoredDeviceMediaDirectory = async (): Promise<any | null> => {
  if (typeof indexedDB === 'undefined') return null;
  const db = await openMediaHandleDb();
  const handle = await new Promise<any | null>((resolve, reject) => {
    const request = db.transaction(MEDIA_HANDLE_STORE, 'readonly').objectStore(MEDIA_HANDLE_STORE).get('root');
    request.onsuccess = () => resolve(request.result || null); request.onerror = () => reject(request.error);
  });
  db.close(); return handle;
};
export const kindForDeviceFile = (file: File): DeviceMediaKind | null => {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('image/')) return 'image';
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'pdf';
  if (file.size > 0) return 'other';
  return null;
};
const walkDirectory = async (directoryHandle: any, output: DeviceMediaItem[], depth = 0): Promise<void> => {
  if (depth > 8) return;
  for await (const entry of directoryHandle.values()) {
    if (entry.kind === 'file') {
      const file = await entry.getFile(); const kind = kindForDeviceFile(file);
      if (!kind) continue;
      output.push({ id: crypto.randomUUID(), file, kind, url: URL.createObjectURL(file), parentHandle: directoryHandle, entryName: entry.name });
    } else if (entry.kind === 'directory' && !entry.name.startsWith('.')) await walkDirectory(entry, output, depth + 1);
  }
};
export const scanDeviceMediaDirectory = async (root: any): Promise<DeviceMediaScan> => {
  const items: DeviceMediaItem[] = []; await walkDirectory(root, items);
  return { items, rootName: root.name || 'Device folder', handle: root };
};
export const pickDeviceMediaDirectory = async (): Promise<DeviceMediaScan | null> => {
  const picker = (window as any).showDirectoryPicker;
  if (typeof picker !== 'function') return null;
  const root = await picker({ mode: 'readwrite' }); return scanDeviceMediaDirectory(root);
};
export const ensureWritePermission = async (handle: any): Promise<boolean> => {
  if (!handle?.queryPermission) return false;
  const current = await handle.queryPermission({ mode: 'readwrite' });
  if (current === 'granted') return true;
  return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted';
};
export const permanentlyDeleteDeviceMedia = async (item: DeviceMediaItem): Promise<boolean> => {
  if (!item.parentHandle || !item.entryName) return false;
  if (!(await ensureWritePermission(item.parentHandle))) return false;
  await item.parentHandle.removeEntry(item.entryName); return true;
};
export const supportsDeviceDirectoryAccess = () => typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function';
export const supportsPhoneFilePicker = () => typeof document !== 'undefined' && typeof document.createElement === 'function';
export const loadPickedDeviceMedia = (files: FileList | File[]): DeviceMediaItem[] => {
  const items: DeviceMediaItem[] = [];
  for (const file of Array.from(files)) {
    const kind = kindForDeviceFile(file); if (!kind) continue;
    items.push({ id: crypto.randomUUID(), file, kind, url: URL.createObjectURL(file) });
  }
  return items;
};
export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return (bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1) + ' ' + units[index];
};
