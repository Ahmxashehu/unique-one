import React, { useState } from 'react';
import { Search, ShoppingBag, Filter } from 'lucide-react';

export default function StorePage() {
  const [search, setSearch] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Unique Store</h1>
          <p className="text-sm text-slate-500 mt-1">Discover products in the Unique One ecosystem.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search store..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            />
          </div>
          <button className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Empty State */}
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center mt-6">
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShoppingBag className="w-10 h-10 text-blue-600" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900">Store is empty</h3>
        <p className="text-slate-500 mt-2 max-w-sm mx-auto">
          No products are currently available in your region. Check back later for new arrivals.
        </p>
        <button className="mt-6 bg-slate-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">
          Browse Categories
        </button>
      </div>
    </div>
  );
}
