import React from 'react';
import { Settings, Building2, MapPin, Globe, CreditCard, ShieldCheck } from 'lucide-react';

export default function BusinessSettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Business Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your business profile, locations, and preferences.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 space-y-8">
        
        <div className="flex items-start gap-4">
           <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
             <Building2 className="w-5 h-5 text-slate-600" />
           </div>
           <div className="flex-1 space-y-4">
             <h3 className="font-semibold text-slate-900">Business Profile</h3>
             <div className="grid md:grid-cols-2 gap-4">
               <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">Business Name</label>
                 <input type="text" defaultValue="Unique Storefront Ltd" className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900" />
               </div>
               <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">Business Category</label>
                 <select className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900">
                   <option>Retail & Wholesale</option>
                   <option>Agriculture</option>
                   <option>Services</option>
                 </select>
               </div>
             </div>
             <div>
               <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
               <textarea rows={3} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900" />
             </div>
           </div>
        </div>

        <div className="h-px bg-slate-100" />

        <div className="flex items-start gap-4">
           <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
             <MapPin className="w-5 h-5 text-slate-600" />
           </div>
           <div className="flex-1 space-y-4">
             <h3 className="font-semibold text-slate-900">Headquarters / Primary Location</h3>
             <div className="grid md:grid-cols-2 gap-4">
               <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                 <input type="text" placeholder="e.g. Lagos" className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900" />
               </div>
               <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">LGA</label>
                 <input type="text" placeholder="e.g. Ikeja" className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900" />
               </div>
             </div>
             <div>
               <label className="block text-sm font-medium text-slate-700 mb-1">Full Address</label>
               <input type="text" className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900" />
             </div>
           </div>
        </div>

        <div className="h-px bg-slate-100" />

        <div className="flex items-start gap-4">
           <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
             <Globe className="w-5 h-5 text-slate-600" />
           </div>
           <div className="flex-1">
             <div className="flex items-center justify-between">
               <div>
                 <h3 className="font-semibold text-slate-900">Storefront Visibility</h3>
                 <p className="text-sm text-slate-500 mt-1">Make your business visible on the Unique Store public directory.</p>
               </div>
               <div className="w-12 h-6 bg-slate-900 rounded-full relative cursor-pointer">
                 <div className="absolute right-1 top-1 bg-white w-4 h-4 rounded-full" />
               </div>
             </div>
           </div>
        </div>

        <div className="h-px bg-slate-100" />

        <div className="flex items-start gap-4">
           <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
             <ShieldCheck className="w-5 h-5 text-amber-600" />
           </div>
           <div className="flex-1">
             <h3 className="font-semibold text-amber-900">Verification Status</h3>
             <p className="text-sm text-amber-800 mt-1">Verification under review. You can continue setting up your profile.</p>
             <button className="mt-3 px-4 py-2 bg-amber-100 text-amber-800 rounded-lg text-sm font-medium">
               Upload Documents
             </button>
           </div>
        </div>

        <div className="pt-6 border-t border-slate-100 flex justify-end">
          <button className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-colors">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
