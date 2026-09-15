import React from 'react';
import { Activity, Users, ShoppingBag, ArrowUpRight } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Overview of your UniqueOS ecosystem.</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Balance</p>
              <h3 className="text-3xl font-bold text-slate-900 mt-2">₦0.00</h3>
            </div>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-emerald-600 font-medium">
            <ArrowUpRight className="w-4 h-4 mr-1" />
            <span>0% from last month</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Active Orders</p>
              <h3 className="text-3xl font-bold text-slate-900 mt-2">0</h3>
            </div>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-slate-500">
            <span>Awaiting fulfillment</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Network Connections</p>
              <h3 className="text-3xl font-bold text-slate-900 mt-2">1</h3>
            </div>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-slate-500">
            <span>Unique One Ecosystem</span>
          </div>
        </div>
      </div>

      {/* Recent Activity Empty State */}
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center mt-6">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Activity className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">No recent activity</h3>
        <p className="text-slate-500 mt-1 max-w-sm mx-auto">
          Your activities, transactions, and bookings across UniqueOS will appear here.
        </p>
      </div>
    </div>
  );
}
