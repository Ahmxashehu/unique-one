import React from 'react';
import { Wallet, Search, Filter } from 'lucide-react';

export default function TransactionHistoryPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Transaction History</h1>
          <p className="text-sm text-slate-500 mt-1">View your complete UniquePay ledger.</p>
        </div>
        <div className="flex gap-2">
           <button className="px-4 py-2 border border-slate-200 bg-white rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2">
             <Filter className="w-4 h-4" /> Filter
           </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
        <div className="border-b border-slate-100 flex p-2 gap-2">
           <div className="flex-1" />
           <div className="relative hidden sm:block w-64">
             <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
             <input type="text" placeholder="Search transactions..." className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400" />
           </div>
        </div>
        <div className="p-12 text-center">
           <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-base font-medium text-slate-900">No transactions</p>
            <p className="text-sm text-slate-500 mt-1">Your ledger is completely clean.</p>
        </div>
      </div>
    </div>
  );
}
