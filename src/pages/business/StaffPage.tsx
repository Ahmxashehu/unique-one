import React from 'react';
import { Users, Plus } from 'lucide-react';

export default function StaffPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Staff & Teams</h1>
          <p className="text-sm text-slate-500 mt-1">Manage employee access and permissions.</p>
        </div>
        <button disabled className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium opacity-50 cursor-not-allowed flex items-center gap-2" title="Staff invitations will be enabled when the staff access workflow is connected.">
          <Plus className="w-4 h-4" /> Invite Staff
        </button>
      </div>
      <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
        <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900">No staff members yet</h3>
        <p className="text-slate-500 mt-1">Staff will appear here after the real staff invitation and access workflow is connected.</p>
      </div>
    </div>
  );
}
