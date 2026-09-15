import React from 'react';
import { ClipboardList, Plus } from 'lucide-react';

export default function UserRequestsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Requests</h1>
          <p className="text-sm text-slate-500 mt-1">Custom service requests and quotes.</p>
        </div>
        <button className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Request
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <ClipboardList className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">No active requests</h3>
        <p className="text-slate-500 mt-1 max-w-sm mx-auto">
          Need something specific? Create a custom request and get quotes from providers.
        </p>
      </div>
    </div>
  );
}
