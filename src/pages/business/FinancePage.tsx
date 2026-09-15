import React from 'react';
import { CreditCard, Plus, ArrowDownRight, ArrowUpRight } from 'lucide-react';

export default function FinancePage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Finance & Expenses</h1>
          <p className="text-sm text-slate-500 mt-1">Track business expenses and revenue.</p>
        </div>
        <button className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2">
          <Plus className="w-4 h-4" /> Record Expense
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-3xl">
           <ArrowDownRight className="w-8 h-8 text-emerald-600 mb-2" />
           <p className="text-sm font-medium text-emerald-800">Total Revenue (Demo)</p>
           <h3 className="text-2xl font-bold text-emerald-900 mt-1">₦0.00</h3>
        </div>
        <div className="bg-rose-50 border border-rose-100 p-6 rounded-3xl">
           <ArrowUpRight className="w-8 h-8 text-rose-600 mb-2" />
           <p className="text-sm font-medium text-rose-800">Total Expenses (Demo)</p>
           <h3 className="text-2xl font-bold text-rose-900 mt-1">₦0.00</h3>
        </div>
        <div className="bg-blue-50 border border-blue-100 p-6 rounded-3xl">
           <CreditCard className="w-8 h-8 text-blue-600 mb-2" />
           <p className="text-sm font-medium text-blue-800">Net Balance (Demo)</p>
           <h3 className="text-2xl font-bold text-blue-900 mt-1">₦0.00</h3>
        </div>
      </div>
    </div>
  );
}
