import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Store, ShieldCheck, MapPin, MessageSquare, Star, Verified } from 'lucide-react';

export default function StoreSellerProfilePage() {
  const { id } = useParams();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Seller Hero */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-8">
          <div className="w-24 h-24 md:w-32 md:h-32 bg-slate-100 rounded-full border-4 border-white shadow-lg flex items-center justify-center shrink-0">
             <Store className="w-12 h-12 md:w-16 md:h-16 text-slate-300" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Unique Storefront Ltd</h1>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Verified Business
              </span>
              <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-1">
                <Verified className="w-3 h-3" /> Direct From Manufacturer
              </span>
            </div>
            <p className="text-slate-600 max-w-2xl">Premium electronics and home appliances distributor. We supply genuine products with full warranty.</p>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-4 text-sm text-slate-500 font-medium">
              <span className="flex items-center gap-1"><MapPin className="w-4 h-4"/> Lagos, Nigeria</span>
              <span className="flex items-center gap-1"><Star className="w-4 h-4 text-amber-400 fill-amber-400"/> 4.9 (128 reviews)</span>
            </div>
          </div>
          <div className="w-full md:w-auto flex shrink-0">
            <button className="w-full md:w-auto bg-slate-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
              <MessageSquare className="w-5 h-5" /> Contact Seller
            </button>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl opacity-50 -mr-20 -mt-20" />
      </div>

      {/* Seller Products */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-6">Products from this Seller</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          <div className="col-span-full text-center py-12 text-slate-500 bg-white border border-slate-100 rounded-2xl">
            This seller hasn't published any products yet.
          </div>
        </div>
      </div>
    </div>
  );
}
