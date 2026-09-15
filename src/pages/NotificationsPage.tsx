import React from 'react';
import { Bell, CheckCircle2 } from 'lucide-react';

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">Updates and alerts from UniqueOS.</p>
        </div>
        <button className="text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1">
          <CheckCircle2 className="w-4 h-4" />
          Mark all as read
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {/* Placeholder Notification */}
        <div className="p-6 flex items-start gap-4 border-b border-slate-100 bg-slate-50/50">
          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Welcome to UniqueOS</h4>
            <p className="text-sm text-slate-600 mt-1">Your account has been successfully created. Explore the ecosystem and set up your profile.</p>
            <p className="text-xs text-slate-400 mt-2">Just now</p>
          </div>
          <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 shrink-0"></div>
        </div>
      </div>
    </div>
  );
}
