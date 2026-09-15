import React from 'react';
import { Box, Plus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CatalogPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Products & Services</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your catalog, pricing, and visibility.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/os/business/catalog/new-service" className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
            Add Service
          </Link>
          <Link to="/os/business/catalog/new-product" className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Product
          </Link>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
        <div className="border-b border-slate-100 p-2 flex gap-2">
           <button className="px-6 py-2 bg-slate-100 text-slate-900 rounded-lg text-sm font-semibold">All Items</button>
           <button className="px-6 py-2 text-slate-500 hover:bg-slate-50 rounded-lg text-sm font-medium">Products</button>
           <button className="px-6 py-2 text-slate-500 hover:bg-slate-50 rounded-lg text-sm font-medium">Services</button>
           <div className="flex-1" />
           <div className="relative hidden sm:block">
             <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
             <input type="text" placeholder="Search catalog..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none" />
           </div>
        </div>
        <div className="p-12 text-center">
          <Box className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">Catalog is empty</h3>
          <p className="text-slate-500 mt-1">Start adding your offerings to sell on Unique Store.</p>
        </div>
      </div>
    </div>
  );
}
