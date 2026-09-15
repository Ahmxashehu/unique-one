import React from 'react';
import { 
  TrendingUp, ShoppingBag, Users, DollarSign, Package, FileText, 
  ArrowDownRight, ShieldAlert, Plus, CreditCard, UserPlus, Box 
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SellerDashboardPage() {
  const stats = [
    { label: 'Today\'s Sales', value: '₦45,000', icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50', demo: true },
    { label: 'Pending Orders', value: '8', icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Unpaid Invoices', value: '3', icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Low Stock Items', value: '5', icon: Package, color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  const quickActions = [
    { label: 'Add Product', icon: Box, to: '/os/business/catalog/new-product' },
    { label: 'Create Order', icon: ShoppingBag, to: '/os/business/orders/new' },
    { label: 'Create Invoice', icon: FileText, to: '/os/invoices/new' },
    { label: 'Request Payment', icon: ArrowDownRight, to: '/os/payment-requests/new' },
    { label: 'Add Customer', icon: UserPlus, to: '/os/business/customers/new' },
    { label: 'Record Expense', icon: CreditCard, to: '/os/business/finance/expense' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Business Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your operations, inventory, and finances.</p>
        </div>
        <div className="flex gap-2">
           <Link to="/store" className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
             Open Store
           </Link>
           <Link to="/os/pay" className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors">
             UniquePay
           </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                {stat.demo && <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-1 rounded-md">Demo</span>}
              </div>
              <div className="relative z-10">
                <h3 className="text-2xl font-bold text-slate-900">{stat.value}</h3>
                <p className="text-sm font-medium text-slate-500 mt-1">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8">
            <h3 className="font-semibold text-slate-900 mb-6">Quick Actions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {quickActions.map(action => (
                <Link key={action.label} to={action.to} className="flex flex-col items-center justify-center gap-3 p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-100 transition-colors text-center group">
                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-600 group-hover:text-slate-900 transition-colors">
                    <action.icon className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">{action.label}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-slate-900">Recent Transactions</h3>
              <Link to="/os/business/finance" className="text-sm text-blue-600 font-medium hover:underline">View Ledger</Link>
              <Link to="/os/messages/new?context=team" className="ml-4 text-sm text-blue-600 font-medium hover:underline">Team Chat</Link>
            </div>
            <div className="text-center py-8">
               <p className="text-sm text-slate-500">Transaction history placeholder (Demo).</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-slate-900">Inventory Alerts</h3>
              <Link to="/os/business/inventory" className="text-sm text-blue-600 font-medium hover:underline">Manage</Link>
            </div>
            <div className="space-y-4">
               <div className="flex items-start gap-3 p-3 bg-rose-50 rounded-xl border border-rose-100">
                 <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                 <div>
                   <p className="text-sm font-medium text-slate-900">Premium Rice (50kg)</p>
                   <p className="text-xs text-rose-600 mt-0.5">Out of stock in Ikeja Branch</p>
                 </div>
               </div>
               <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                 <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                 <div>
                   <p className="text-sm font-medium text-slate-900">Cement (Dangote 3X)</p>
                   <p className="text-xs text-amber-600 mt-0.5">Low stock: 15 bags remaining</p>
                 </div>
               </div>
            </div>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-slate-900">Recent Customer Activity</h3>
              <Link to="/os/business/activity" className="text-sm text-blue-600 font-medium hover:underline">View All</Link>
            </div>
            <div className="text-center py-8">
               <p className="text-sm text-slate-500">No recent activity.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
