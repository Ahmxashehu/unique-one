import React from 'react';
import { Inbox } from 'lucide-react';

export default function AdminRequestsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">System Requests</h1>
        <p className="text-sm text-slate-500 mt-1">Manage support and feature requests from users.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex gap-4">
          <button className="text-sm font-medium text-slate-900 border-b-2 border-slate-900 pb-1">Open (0)</button>
          <button className="text-sm font-medium text-slate-500 hover:text-slate-900 pb-1">Resolved</button>
        </div>
        <div className="p-12 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Inbox className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-500 mt-1">Inbox is empty. No pending requests.</p>
        </div>
      </div>
    </div>
  );
}
