import React from 'react';
import { MapPin, Plus } from 'lucide-react';

export default function BranchesPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Branches & Locations</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your storefronts, warehouses, or farm sites.</p>
        </div>
        <button className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Branch
        </button>
      </div>
      <div className="bg-white border border-slate-200 rounded-3xl p-6">
        <div className="flex items-start justify-between border border-slate-100 bg-slate-50 p-4 rounded-xl">
          <div>
            <h3 className="font-semibold text-slate-900">Headquarters</h3>
            <p className="text-sm text-slate-500 mt-1">Main operational base</p>
          </div>
          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold uppercase rounded-md">Active</span>
        </div>
      </div>
    </div>
  );
}
