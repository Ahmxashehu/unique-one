import React from 'react';
import { Activity, Download } from 'lucide-react';

export default function AdminTransactionsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Global Ledger</h1>
          <p className="text-sm text-slate-500 mt-1">Monitor all UniquePay ecosystem transactions.</p>
        </div>
        <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-12 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">No Transactions</h3>
          <p className="text-slate-500 mt-1">The global ledger is currently empty.</p>
        </div>
      </div>
    </div>
  );
}
