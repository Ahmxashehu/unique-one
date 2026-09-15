import React from 'react';
import { ShoppingCart, Filter, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Orders</h1>
          <p className="text-sm text-slate-500 mt-1">Track and fulfill customer orders.</p>
        </div>
        <button className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
          <Filter className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex gap-4">
          <button className="text-sm font-medium text-slate-900 border-b-2 border-slate-900 pb-1">All Orders</button>
          <button className="text-sm font-medium text-slate-500 hover:text-slate-900 pb-1">Pending</button>
          <button className="text-sm font-medium text-slate-500 hover:text-slate-900 pb-1">Completed</button>
        </div>
        <div className="p-12 text-center">
          
          <div className="max-w-md mx-auto bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left mb-6">
            <div className="flex justify-between items-start mb-2">
              <span className="font-bold text-slate-900">#ORD-5432</span>
              <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-md">Pending</span>
            </div>
            <p className="text-sm text-slate-600 mb-4">1x Premium White Rice (50kg)</p>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-900">₦45,000</span>
              <Link to="/os/messages/new?order=ORD-5432" className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1">
                <MessageSquare className="w-4 h-4" /> Discuss Order
              </Link>
            </div>
          </div>
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingCart className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-500">No orders found matching your criteria.</p>
        </div>
      </div>
    </div>
  );
}
