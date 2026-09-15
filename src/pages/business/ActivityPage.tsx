import React from 'react';
import { Activity } from 'lucide-react';

export default function ActivityPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Activity Logs</h1>
        <p className="text-sm text-slate-500 mt-1">Audit trail of staff and business actions.</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
        <Activity className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900">No recent activity</h3>
      </div>
    </div>
  );
}
