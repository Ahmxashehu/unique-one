import React from 'react';
import { Users, Plus, Search } from 'lucide-react';

export default function BeneficiariesPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Beneficiaries</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your saved recipients for quick transfers.</p>
        </div>
        <button className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Beneficiary
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
        <div className="border-b border-slate-100 p-4">
           <div className="relative">
             <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
             <input type="text" placeholder="Search beneficiaries..." className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-transparent rounded-xl text-sm focus:outline-none focus:bg-white focus:border-slate-300 transition-colors" />
           </div>
        </div>
        <div className="p-12 text-center">
           <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-base font-medium text-slate-900">No saved beneficiaries</p>
            <p className="text-sm text-slate-500 mt-1">You haven't saved any recipients yet.</p>
        </div>
      </div>
    </div>
  );
}
