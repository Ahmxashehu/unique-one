import React from 'react';
import { Wallet, ArrowUpRight, ArrowDownRight, FileText, Receipt, ShieldCheck, HelpCircle, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PayPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">UniquePay Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your payments, invoices, and receipts securely.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/os/pay/security" className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
            <ShieldCheck className="w-5 h-5" />
          </Link>
          <Link to="/os/pay/settings" className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
            <Settings className="w-5 h-5" />
          </Link>
        </div>
      </div>


      {/* Demo Warning */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5" />
        <div>
          <h4 className="font-semibold text-blue-900">Demo Environment</h4>
          <p className="text-sm text-blue-800 mt-1">
            UniquePay is currently running in a simulated mode. No real banking APIs or payment processors are connected. Any balances or transactions shown are placeholders.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Balances */}
        <div className="md:col-span-2 bg-slate-900 text-white p-8 rounded-3xl relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-slate-400 font-medium">Available Balance (Demo)</p>
            <h2 className="text-4xl md:text-5xl font-bold mt-2">₦0.00</h2>
            <div className="flex gap-4 mt-8">
              <Link to="/os/payment-requests/new" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4" /> Request Money
              </Link>
              <Link to="/os/pay/send" className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4" /> Send Money
              </Link>
            </div>
          </div>
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-blue-500/30 blur-3xl rounded-full" />
        </div>

        {/* Quick Links */}
        <div className="bg-white border border-slate-200 p-6 rounded-3xl flex flex-col justify-between space-y-4">
          <h3 className="font-semibold text-slate-900">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3 flex-1">
             <Link to="/os/invoices/new" className="bg-slate-50 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-slate-100 transition-colors text-center text-sm font-medium text-slate-700">
               <FileText className="w-6 h-6 text-indigo-500" />
               Create Invoice
             </Link>
             <Link to="/os/pay/school-payments" className="bg-slate-50 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-slate-100 transition-colors text-center text-sm font-medium text-slate-700">
               <Receipt className="w-6 h-6 text-emerald-500" />
               School Fees
             </Link>
             <Link to="/os/payment-requests" className="bg-slate-50 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-slate-100 transition-colors text-center text-sm font-medium text-slate-700">
               <ArrowDownRight className="w-6 h-6 text-blue-500" />
               Requests
             </Link>
             <Link to="/os/pay/receive" className="bg-slate-50 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-slate-100 transition-colors text-center text-sm font-medium text-slate-700">
               <Wallet className="w-6 h-6 text-slate-600" />
               Receive
             </Link>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-slate-900">Recent Transactions</h3>
            <Link to="/os/pay/history" className="text-sm text-blue-600 font-medium hover:underline">View All</Link>
          </div>
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-900">No recent transactions</p>
            <p className="text-xs text-slate-500 mt-1">Your payment history will appear here.</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-slate-900">Pending Requests</h3>
            <Link to="/os/payment-requests" className="text-sm text-blue-600 font-medium hover:underline">View All</Link>
          </div>
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <ArrowDownRight className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-900">No pending requests</p>
            <p className="text-xs text-slate-500 mt-1">You're all caught up.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
