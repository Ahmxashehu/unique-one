import React from 'react';
import { MapPin, Navigation } from 'lucide-react';

export default function NearMePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-6 flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Near Me</h1>
          <p className="text-slate-500 mt-1">Discover businesses and services in your local area.</p>
        </div>
        <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm">
          <Navigation className="w-4 h-4" />
          Use Current Location
        </button>
      </div>

      <div className="flex-1 bg-slate-100 rounded-3xl border border-slate-200 relative overflow-hidden flex flex-col items-center justify-center">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
        <div className="relative z-10 text-center p-8 bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm max-w-sm">
          <MapPin className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="font-semibold text-slate-900 text-lg">Map View Placeholder</h3>
          <p className="text-slate-500 mt-2 text-sm">
            Integration with Google Maps Platform will display real-time local businesses, services, and ecosystem partners near your location.
          </p>
        </div>
      </div>
    </div>
  );
}
