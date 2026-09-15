import React from 'react';
import { ShoppingBag, Plus } from 'lucide-react';

export default function BusinessOrdersPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Orders</h1>
          <p className="text-sm text-slate-500 mt-1">Track offline and online sales.</p>
        </div>
        <button className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2">
          <Plus className="w-4 h-4" /> Create Order
        </button>
      </div>
      <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
        <ShoppingBag className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900">No orders yet</h3>
      </div>
    </div>
  );
}
