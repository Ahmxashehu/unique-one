const DB_NAME = 'unique-one-share-bridge';
const STORE_NAME = 'pending-media';
const DB_VERSION = 1;

type PendingMedia = {
  id: string;
  file: File;
  createdAt: number;
};

const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('Unable to open share bridge.'));
});

export async function stageMediaForDestination(file: File) {
  const db = await openDb();
  const id = crypto.randomUUID();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ id, file, createdAt: Date.now() } satisfies PendingMedia);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Unable to stage media.'));
  });
  db.close();
  return id;
}

export async function takeStagedMedia(id: string) {
  const db = await openDb();
  const result = await new Promise<PendingMedia | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => {
      const value = request.result as PendingMedia | undefined;
      if (value) store.delete(id);
      resolve(value);
    };
    request.onerror = () => reject(request.error ?? new Error('Unable to read staged media.'));
  });
  db.close();
  return result?.file ?? null;
}
