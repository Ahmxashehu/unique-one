import React from 'react';
import { Settings, CreditCard, Banknote, Bell } from 'lucide-react';

export default function PaySettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">UniquePay Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Configure your payment preferences and notifications.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 space-y-8">
        
        <div className="flex items-start gap-4">
           <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
             <CreditCard className="w-5 h-5 text-slate-600" />
           </div>
           <div className="flex-1">
             <h3 className="font-semibold text-slate-900">Linked Accounts & Cards</h3>
             <p className="text-sm text-slate-500 mt-1">Manage your funding sources for seamless payments.</p>
             <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-600 font-medium text-center">
               Provider integration required to link live cards or accounts.
             </div>
           </div>
        </div>

        <div className="h-px bg-slate-100" />

        <div className="flex items-start gap-4">
           <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
             <Banknote className="w-5 h-5 text-slate-600" />
           </div>
           <div className="flex-1">
             <h3 className="font-semibold text-slate-900">Currency & Display</h3>
             <p className="text-sm text-slate-500 mt-1">Set your preferred currency for the UniquePay dashboard.</p>
             <div className="mt-4 flex gap-3">
               <button className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium">NGN (₦)</button>
               <button className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50">USD ($)</button>
             </div>
           </div>
        </div>

        <div className="h-px bg-slate-100" />

        <div className="flex items-start gap-4">
           <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
             <Bell className="w-5 h-5 text-slate-600" />
           </div>
           <div className="flex-1">
             <div className="flex items-center justify-between">
               <div>
                 <h3 className="font-semibold text-slate-900">Transaction Notifications</h3>
                 <p className="text-sm text-slate-500 mt-1">Receive alerts for incoming and outgoing funds.</p>
               </div>
               <div className="w-12 h-6 bg-emerald-500 rounded-full relative cursor-pointer">
                 <div className="absolute right-1 top-1 bg-white w-4 h-4 rounded-full" />
               </div>
             </div>
           </div>
        </div>

      </div>
    </div>
  );
}
