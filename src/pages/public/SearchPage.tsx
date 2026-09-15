import React, { useState } from 'react';
import { Search as SearchIcon, Filter } from 'lucide-react';

export default function SearchPage() {
  const [query, setQuery] = useState('');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-8">
      <div className="max-w-3xl mx-auto text-center space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Search the Ecosystem</h1>
        
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              autoFocus
              placeholder="Search for services, businesses, products..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent shadow-sm"
            />
          </div>
          <button className="p-4 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 shadow-sm">
            <Filter className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <SearchIcon className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Start typing to search</h3>
          <p className="text-slate-500 mt-1">
            Find exactly what you're looking for across the Unique One ecosystem.
          </p>
        </div>
      </div>
    </div>
  );
}
