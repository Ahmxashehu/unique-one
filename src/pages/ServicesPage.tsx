import React from 'react';
import { Briefcase, Plus } from 'lucide-react';

export default function ServicesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Services</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your service offerings and catalog.</p>
        </div>
        <button className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Service
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center mt-6">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Briefcase className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">No services created</h3>
        <p className="text-slate-500 mt-1 max-w-sm mx-auto">
          You haven't added any services to your business profile yet.
        </p>
      </div>
    </div>
  );
}
