import React from 'react';
import { ShieldCheck } from 'lucide-react';

export default function AdminVerificationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Verification Center</h1>
        <p className="text-sm text-slate-500 mt-1">Review KYC, KYB, and identity verification documents.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex gap-4">
          <button className="text-sm font-medium text-slate-900 border-b-2 border-slate-900 pb-1">Pending Review (0)</button>
          <button className="text-sm font-medium text-slate-500 hover:text-slate-900 pb-1">Approved</button>
          <button className="text-sm font-medium text-slate-500 hover:text-slate-900 pb-1">Rejected</button>
        </div>
        <div className="p-12 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-500 mt-1">No pending verification requests in the queue.</p>
        </div>
      </div>
    </div>
  );
}
