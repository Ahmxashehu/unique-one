import React from 'react';
import { Store, MapPin, Phone, Mail, Edit } from 'lucide-react';

export default function BusinessProfilePage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Business Profile</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your public storefront details.</p>
        </div>
        <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 flex items-center gap-2">
          <Edit className="w-4 h-4" />
          Edit Profile
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="h-32 bg-slate-900 relative">
          <div className="absolute -bottom-10 left-8 w-24 h-24 bg-white rounded-2xl border-4 border-white shadow-sm flex items-center justify-center overflow-hidden">
            <Store className="w-10 h-10 text-slate-400" />
          </div>
        </div>
        
        <div className="pt-14 px-8 pb-8">
          <h2 className="text-2xl font-bold text-slate-900">Tech Solutions Ltd</h2>
          <div className="flex items-center gap-2 mt-2">
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Verified Business
            </span>
          </div>

          <p className="text-slate-600 mt-6 leading-relaxed max-w-2xl">
            Providing top-tier technology consulting and software products for the modern African enterprise. We specialize in point-of-sale systems and cloud infrastructure.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 mt-8 pt-8 border-t border-slate-100">
            <div className="flex items-center gap-3 text-slate-600">
              <MapPin className="w-5 h-5 text-slate-400" />
              <span>124 Innovation Drive, Lagos</span>
            </div>
            <div className="flex items-center gap-3 text-slate-600">
              <Phone className="w-5 h-5 text-slate-400" />
              <span>+234 800 123 4567</span>
            </div>
            <div className="flex items-center gap-3 text-slate-600">
              <Mail className="w-5 h-5 text-slate-400" />
              <span>contact@techsolutions.com</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
