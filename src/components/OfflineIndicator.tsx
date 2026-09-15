import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOfflineQueue } from '../contexts/OfflineQueueContext';

export default function OfflineIndicator() {
  const { isOffline } = useOfflineQueue();

  if (!isOffline) return null;

  return (
    <div className="bg-red-500 text-white px-4 py-2 text-sm font-medium text-center flex items-center justify-center gap-2 z-[9999] relative w-full shadow-sm">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>You are currently offline.</span>
    </div>
  );
}
