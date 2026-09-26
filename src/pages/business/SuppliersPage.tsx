import React from 'react';
import { Truck, Plus } from 'lucide-react';

export default function SuppliersPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Suppliers</h1>
          <p className="text-sm text-slate-500 mt-1">Manage vendors, farmers, and distributors.</p>
        </div>
        <button disabled className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium opacity-50 cursor-not-allowed flex items-center gap-2" title="Supplier creation will be enabled when the supplier workflow is connected.">
          <Plus className="w-4 h-4" /> Add Supplier
        </button>
      </div>
      <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
        <Truck className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900">No suppliers yet</h3>
        <p className="text-slate-500 mt-1">Suppliers will appear here after the real supplier management workflow is connected.</p>
      </div>
    </div>
  );
}
