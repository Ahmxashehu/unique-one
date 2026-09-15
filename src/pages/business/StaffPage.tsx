import React from 'react';
import { Users, Plus, Shield, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function StaffPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Staff & Teams</h1>
          <p className="text-sm text-slate-500 mt-1">Manage employee access and permissions.</p>
        </div>
        <button className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" /> Invite Staff
        </button>
      </div>
      <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
        
        <div className="max-w-md mx-auto bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left mb-6">
          <div className="flex justify-between items-start mb-2">
            <span className="font-bold text-slate-900">John Doe</span>
            <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-md">Manager</span>
          </div>
          <p className="text-sm text-slate-600 mb-4">Lagos Branch</p>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-900"></span>
            <Link to="/os/messages/new?staff=JohnDoe" className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1">
              <MessageSquare className="w-4 h-4" /> Message Staff
            </Link>
          </div>
        </div>
        <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900">No staff members yet</h3>
        <p className="text-slate-500 mt-1">Invite your team to help manage the business.</p>
      </div>
    </div>
  );
}
