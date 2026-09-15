import React from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';

export default function AdminReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Analytics & Reports</h1>
        <p className="text-sm text-slate-500 mt-1">Platform performance metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Gross Platform Volume (GPV)</p>
          <h3 className="text-3xl font-bold text-slate-900 mt-2">₦0.00</h3>
          <div className="mt-4 flex items-center text-sm text-emerald-600 font-medium">
            <TrendingUp className="w-4 h-4 mr-1" />
            <span>0%</span>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Users</p>
          <h3 className="text-3xl font-bold text-slate-900 mt-2">0</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Active Businesses</p>
          <h3 className="text-3xl font-bold text-slate-900 mt-2">0</h3>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center mt-6">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <BarChart3 className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">Insufficient Data</h3>
        <p className="text-slate-500 mt-1 max-w-sm mx-auto">
          Not enough platform activity to generate comprehensive reports.
        </p>
      </div>
    </div>
  );
}
