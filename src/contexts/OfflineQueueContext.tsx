import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';

export interface QueuedOperation {
  id: string;
  name: string;
  action: () => Promise<void>;
  timestamp: number;
}

interface OfflineQueueContextType {
  isOffline: boolean;
  queue: QueuedOperation[];
  enqueueOperation: (name: string, action: () => Promise<void>) => void;
  syncQueue: () => Promise<void>;
  isSyncing: boolean;
  currentSyncItem: QueuedOperation | null;
}

const OfflineQueueContext = createContext<OfflineQueueContextType>({} as OfflineQueueContextType);

export const useOfflineQueue = () => useContext(OfflineQueueContext);

export const OfflineQueueProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [queue, setQueue] = useState<QueuedOperation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentSyncItem, setCurrentSyncItem] = useState<QueuedOperation | null>(null);

  // Use refs to access latest state inside the while loop without triggering dependency cycles
  const queueRef = useRef(queue);
  const isOfflineRef = useRef(isOffline);
  queueRef.current = queue;
  isOfflineRef.current = isOffline;

  const syncQueue = useCallback(async () => {
    if (queueRef.current.length === 0 || isSyncing || isOfflineRef.current) return;
    setIsSyncing(true);

    while (queueRef.current.length > 0 && !isOfflineRef.current) {
      const op = queueRef.current[0];
      setCurrentSyncItem(op);
      
      // Remove from the queue immediately so it moves to "currently syncing"
      setQueue(prev => prev.slice(1));

      try {
        await op.action();
      } catch (err) {
        console.error(`Failed to sync operation ${op.name}:`, err);
      }
    }

    setCurrentSyncItem(null);
    setIsSyncing(false);
  }, [isSyncing]);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  useEffect(() => {
    if (!isOffline && queue.length > 0 && !isSyncing) {
      syncQueue();
    }
  }, [isOffline, queue.length, isSyncing, syncQueue]);

  const enqueueOperation = (name: string, action: () => Promise<void>) => {
    // If online, not syncing, and no queue, execute immediately
    if (!isOffline && !isSyncing && queue.length === 0) {
      action().catch(console.error);
      return;
    }
    
    const op: QueuedOperation = {
      id: Math.random().toString(36).substring(7),
      name,
      action,
      timestamp: Date.now(),
    };
    setQueue(prev => [...prev, op]);
  };

  return (
    <OfflineQueueContext.Provider value={{ isOffline, queue, enqueueOperation, syncQueue, isSyncing, currentSyncItem }}>
      {children}
    </OfflineQueueContext.Provider>
  );
};
