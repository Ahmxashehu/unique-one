export type DeviceMediaKind = 'video' | 'audio' | 'image' | 'pdf' | 'other';

export type DeviceMediaItem = {
  id: string;
  file: File;
  kind: DeviceMediaKind;
  url: string;
  parentHandle?: any;
  entryName?: string;
};

export type DeviceMediaScan = {
  items: DeviceMediaItem[];
  rootName: string;
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
      const file = await entry.getFile();
      const kind = kindForDeviceFile(file);
      if (!kind) continue;
      output.push({
        id: crypto.randomUUID(),
        file,
        kind,
        url: URL.createObjectURL(file),
        parentHandle: directoryHandle,
        entryName: entry.name,
      });
    } else if (entry.kind === 'directory' && !entry.name.startsWith('.')) {
      await walkDirectory(entry, output, depth + 1);
    }
  }
};

export const pickDeviceMediaDirectory = async (): Promise<DeviceMediaScan | null> => {
  const picker = (window as any).showDirectoryPicker;
  if (typeof picker !== 'function') return null;
  const root = await picker({ mode: 'readwrite' });
  const items: DeviceMediaItem[] = [];
  await walkDirectory(root, items);
  return { items, rootName: root.name || 'Device folder' };
};

export const ensureWritePermission = async (handle: any): Promise<boolean> => {
  if (!handle?.queryPermission) return false;
  const current = await handle.queryPermission({ mode: 'readwrite' });
  if (current === 'granted') return true;
  const requested = await handle.requestPermission({ mode: 'readwrite' });
  return requested === 'granted';
};

export const permanentlyDeleteDeviceMedia = async (item: DeviceMediaItem): Promise<boolean> => {
  if (!item.parentHandle || !item.entryName) return false;
  const allowed = await ensureWritePermission(item.parentHandle);
  if (!allowed) return false;
  await item.parentHandle.removeEntry(item.entryName);
  return true;
};

export const supportsDeviceDirectoryAccess = () =>
  typeof (window as any).showDirectoryPicker === 'function';

export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return (bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1) + ' ' + units[index];
};
