import React from 'react';
import { ArrowDownRight, ArrowUpRight, Search, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PaymentRequestsPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payment Requests</h1>
          <p className="text-sm text-slate-500 mt-1">Manage money requested by you or from you.</p>
        </div>
        <Link to="/os/payment-requests/new" className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Request
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
        <div className="border-b border-slate-100 flex p-2 gap-2">
           <button className="px-6 py-2 bg-slate-100 text-slate-900 rounded-lg text-sm font-semibold">Received</button>
           <button className="px-6 py-2 text-slate-500 hover:bg-slate-50 rounded-lg text-sm font-medium">Sent</button>
           <div className="flex-1" />
           <div className="relative hidden sm:block">
             <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
             <input type="text" placeholder="Search requests..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400" />
           </div>
        </div>
        <div className="p-12 text-center">
           <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <ArrowDownRight className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-base font-medium text-slate-900">No requests found</p>
            <p className="text-sm text-slate-500 mt-1">You haven't received any payment requests yet.</p>
        </div>
      </div>
    </div>
  );
}
