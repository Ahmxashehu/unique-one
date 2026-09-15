import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Receipt, Download, ArrowLeft, ShieldCheck } from 'lucide-react';

export default function ReceiptPage() {
  const { id } = useParams();

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <Link to="/os/pay/history" className="text-slate-500 hover:text-slate-900 flex items-center gap-2 text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to History
        </Link>
        <button className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2">
          <Download className="w-4 h-4" /> Download PDF
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-8 md:p-12 relative overflow-hidden shadow-sm">
        {/* Demo Watermark */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-5 pointer-events-none rotate-[-30deg]">
          <h1 className="text-7xl font-black uppercase whitespace-nowrap text-slate-900">Demo Receipt</h1>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-100 pb-8 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
              <Receipt className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Transaction Receipt</h2>
              <p className="text-sm text-slate-500">Ref: DEMO-TXN-{id}</p>
            </div>
          </div>
          <div className="text-left md:text-right">
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Amount Paid</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">₦0.00</p>
          </div>
        </div>

        <div className="py-8 space-y-6 relative z-10">
          <div className="flex justify-between items-center py-3 border-b border-slate-50">
            <span className="text-slate-500">Date</span>
            <span className="font-medium text-slate-900">{new Date().toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-slate-50">
            <span className="text-slate-500">Status</span>
            <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider rounded-md">Paid (Demo)</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-slate-50">
            <span className="text-slate-500">Sender / Customer</span>
            <span className="font-medium text-slate-900">Demo User</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-slate-50">
            <span className="text-slate-500">Recipient / Business</span>
            <span className="font-medium text-slate-900">Unique Storefront Ltd</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-slate-50">
            <span className="text-slate-500">Description</span>
            <span className="font-medium text-slate-900">Payment for Order #12345</span>
          </div>
        </div>

        <div className="mt-8 bg-slate-50 rounded-xl p-4 flex items-center justify-center gap-2 text-sm text-slate-500 relative z-10">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          This is a simulated demo receipt. Not a real payment.
        </div>
      </div>
    </div>
  );
}
