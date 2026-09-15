import React from 'react';
import { Compass, TrendingUp, Star } from 'lucide-react';

export default function DiscoverPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Discover</h1>
        <p className="text-slate-500 mt-2 text-lg">Explore top businesses, services, and products across Unique One.</p>
      </div>

      <section>
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          <h2 className="text-xl font-semibold text-slate-900">Trending Now</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="h-48 bg-slate-100 flex items-center justify-center">
                <Compass className="w-8 h-8 text-slate-300" />
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">Service</span>
                  <div className="flex items-center text-sm font-medium text-slate-700">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400 mr-1" />
                    4.9
                  </div>
                </div>
                <h3 className="font-semibold text-slate-900">Featured Provider {i}</h3>
                <p className="text-sm text-slate-500 mt-1">Professional services in your region.</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
