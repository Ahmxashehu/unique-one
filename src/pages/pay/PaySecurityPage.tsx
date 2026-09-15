import React from 'react';
import { Shield, Key, AlertTriangle, Smartphone } from 'lucide-react';

export default function PaySecurityPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payment Security</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your PIN, limits, and security alerts.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 space-y-8">
        
        <div className="flex items-start gap-4">
           <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
             <Key className="w-5 h-5 text-slate-600" />
           </div>
           <div className="flex-1">
             <h3 className="font-semibold text-slate-900">Transaction PIN</h3>
             <p className="text-sm text-slate-500 mt-1">Require a 4-digit PIN for all outbound transfers and approvals.</p>
             <button className="mt-4 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
               Set up PIN
             </button>
             <p className="text-xs text-slate-400 mt-3">Note: We never store your PIN in plain text. It is cryptographically hashed.</p>
           </div>
        </div>

        <div className="h-px bg-slate-100" />

        <div className="flex items-start gap-4">
           <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
             <Shield className="w-5 h-5 text-slate-600" />
           </div>
           <div className="flex-1">
             <h3 className="font-semibold text-slate-900">Transaction Limits</h3>
             <p className="text-sm text-slate-500 mt-1">Control your daily and single-transaction spending limits.</p>
             <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
               <div className="flex justify-between items-center">
                 <span className="text-sm font-medium text-slate-700">Daily Limit</span>
                 <span className="text-sm font-semibold text-slate-900">₦0.00 <span className="text-slate-400 font-normal">(Demo)</span></span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-sm font-medium text-slate-700">Single Transaction Limit</span>
                 <span className="text-sm font-semibold text-slate-900">₦0.00 <span className="text-slate-400 font-normal">(Demo)</span></span>
               </div>
             </div>
           </div>
        </div>

        <div className="h-px bg-slate-100" />

        <div className="flex items-start gap-4">
           <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
             <Smartphone className="w-5 h-5 text-slate-600" />
           </div>
           <div className="flex-1">
             <div className="flex items-center justify-between">
               <div>
                 <h3 className="font-semibold text-slate-900">Require OTP for large transfers</h3>
                 <p className="text-sm text-slate-500 mt-1">Send an SMS OTP for transactions over your specified threshold.</p>
               </div>
               <div className="w-12 h-6 bg-slate-200 rounded-full relative cursor-pointer">
                 <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full shadow-sm" />
               </div>
             </div>
           </div>
        </div>

        <div className="h-px bg-slate-100" />

        <div className="flex items-start gap-4">
           <div className="w-10 h-10 bg-rose-50 rounded-lg flex items-center justify-center shrink-0">
             <AlertTriangle className="w-5 h-5 text-rose-600" />
           </div>
           <div className="flex-1">
             <h3 className="font-semibold text-rose-600">Freeze Account</h3>
             <p className="text-sm text-slate-500 mt-1">Instantly block all outgoing transfers if you suspect fraud.</p>
             <button className="mt-4 px-4 py-2 bg-rose-100 text-rose-700 rounded-lg text-sm font-medium hover:bg-rose-200 transition-colors">
               Freeze UniquePay
             </button>
           </div>
        </div>

      </div>
    </div>
  );
}
