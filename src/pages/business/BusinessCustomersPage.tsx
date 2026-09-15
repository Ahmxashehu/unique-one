import React from 'react';
import { Users, Plus, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function BusinessCustomersPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your customer database and histories.</p>
        </div>
        <button className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>
      <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
        
        <div className="max-w-md mx-auto bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left mb-6">
          <div className="flex justify-between items-start mb-2">
            <span className="font-bold text-slate-900">Ahmxashehu</span>
            <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-md">Active</span>
          </div>
          <p className="text-sm text-slate-600 mb-4">Retail Customer</p>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-900"></span>
            <Link to="/os/messages/new?customer=Ahmxashehu" className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1">
              <MessageSquare className="w-4 h-4" /> Message Customer
            </Link>
          </div>
        </div>
        <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900">No customers found</h3>
        <p className="text-slate-500 mt-1">Add customers manually or wait for orders from Unique Store.</p>
      </div>
    </div>
  );
}
