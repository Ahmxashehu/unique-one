import React, { useState, useEffect } from 'react';
import { useOfflineQueue } from '../contexts/OfflineQueueContext';
import { Loader2, CloudOff, RefreshCw, ChevronDown, ChevronUp, Clock } from 'lucide-react';

export default function SyncOverlay() {
  const { isOffline, queue, isSyncing, currentSyncItem } = useOfflineQueue();
  const [isMinimized, setIsMinimized] = useState(false);

  // Auto-expand if a sync starts
  useEffect(() => {
    if (isSyncing) {
      setIsMinimized(false);
    }
  }, [isSyncing]);

  const totalPending = queue.length + (currentSyncItem ? 1 : 0);

  if (totalPending === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] sm:w-80 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-200 overflow-hidden z-[9998] transition-all duration-300 ease-in-out flex flex-col">
      {/* Header */}
      <div 
        className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${isOffline ? 'bg-slate-50 hover:bg-slate-100' : 'bg-blue-50 hover:bg-blue-100'}`}
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-3">
          {isOffline ? (
            <CloudOff className="w-5 h-5 text-slate-500" />
          ) : (
            <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
          )}
          <div>
            <h4 className={`text-sm font-bold ${isOffline ? 'text-slate-700' : 'text-blue-900'}`}>
              {isOffline ? 'Offline Actions' : 'Syncing Data'}
            </h4>
            <p className={`text-xs ${isOffline ? 'text-slate-500' : 'text-blue-600'}`}>
              {totalPending} {totalPending === 1 ? 'item' : 'items'} pending
            </p>
          </div>
        </div>
        <button className="text-slate-400 hover:text-slate-600 transition-colors p-1">
          {isMinimized ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* List */}
      <div 
        className={`transition-all duration-300 ease-in-out bg-white overflow-hidden`}
        style={{ maxHeight: isMinimized ? '0px' : '300px' }}
      >
        <div className="p-2 space-y-1 overflow-y-auto max-h-[300px]">
          {currentSyncItem && (
            <div className="flex items-center gap-3 px-3 py-2 bg-blue-50/50 rounded-xl border border-blue-100">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-blue-900 truncate">{currentSyncItem.name}</p>
                <p className="text-xs text-blue-500">Syncing now...</p>
              </div>
            </div>
          )}

          {queue.map(op => (
            <div key={op.id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-700 truncate">{op.name}</p>
                <p className="text-[10px] text-slate-400">Waiting for connection</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
