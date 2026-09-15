import React from 'react';
import { Package, ArrowDownRight, ArrowUpRight } from 'lucide-react';

export default function InventoryPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventory</h1>
          <p className="text-sm text-slate-500 mt-1">Track stock levels and stock movements.</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-rose-50 text-rose-700 px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4" /> Stock Out
          </button>
          <button className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2">
            <ArrowDownRight className="w-4 h-4" /> Stock In
          </button>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
        <Package className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900">No inventory records</h3>
        <p className="text-slate-500 mt-1">Add products to your catalog first.</p>
      </div>
    </div>
  );
}
