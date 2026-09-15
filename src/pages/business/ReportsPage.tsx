import React from 'react';
import { BarChart3 } from 'lucide-react';

export default function ReportsPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reports & Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">Insights into your business performance.</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
        <BarChart3 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900">Not enough data</h3>
        <p className="text-slate-500 mt-1">Reports will generate once you have sufficient sales activity.</p>
      </div>
    </div>
  );
}
