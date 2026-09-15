#!/bin/bash
mkdir -p src/pages/business

cat << 'PAGE' > src/pages/business/StaffPage.tsx
import React from 'react';
import { Users, Plus, Shield } from 'lucide-react';

export default function StaffPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Staff & Teams</h1>
          <p className="text-sm text-slate-500 mt-1">Manage employee access and permissions.</p>
        </div>
        <button className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" /> Invite Staff
        </button>
      </div>
      <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
        <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900">No staff members yet</h3>
        <p className="text-slate-500 mt-1">Invite your team to help manage the business.</p>
      </div>
    </div>
  );
}
PAGE

cat << 'PAGE' > src/pages/business/BranchesPage.tsx
import React from 'react';
import { MapPin, Plus } from 'lucide-react';

export default function BranchesPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Branches & Locations</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your storefronts, warehouses, or farm sites.</p>
        </div>
        <button className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Branch
        </button>
      </div>
      <div className="bg-white border border-slate-200 rounded-3xl p-6">
        <div className="flex items-start justify-between border border-slate-100 bg-slate-50 p-4 rounded-xl">
          <div>
            <h3 className="font-semibold text-slate-900">Headquarters</h3>
            <p className="text-sm text-slate-500 mt-1">Main operational base</p>
          </div>
          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold uppercase rounded-md">Active</span>
        </div>
      </div>
    </div>
  );
}
PAGE

cat << 'PAGE' > src/pages/business/CatalogPage.tsx
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
PAGE

cat << 'PAGE' > src/pages/business/InventoryPage.tsx
import React from 'react';
import { Package, ArrowDownRight, ArrowUpRight } from 'lucide-react';

export default function InventoryPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventory</h1>
          <p className="text-sm text-slate-500 mt-1">Track stock levels and stock movements.</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-rose-50 text-rose-700 px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4" /> Stock Out
          </button>
          <button className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2">
            <ArrowDownRight className="w-4 h-4" /> Stock In
          </button>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
        <Package className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900">No inventory records</h3>
        <p className="text-slate-500 mt-1">Add products to your catalog first.</p>
      </div>
    </div>
  );
}
PAGE

cat << 'PAGE' > src/pages/business/BusinessCustomersPage.tsx
import React from 'react';
import { Users, Plus } from 'lucide-react';

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
        <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900">No customers found</h3>
        <p className="text-slate-500 mt-1">Add customers manually or wait for orders from Unique Store.</p>
      </div>
    </div>
  );
}
PAGE

cat << 'PAGE' > src/pages/business/SuppliersPage.tsx
import React from 'react';
import { Truck, Plus } from 'lucide-react';

export default function SuppliersPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Suppliers</h1>
          <p className="text-sm text-slate-500 mt-1">Manage vendors, farmers, and distributors.</p>
        </div>
        <button className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Supplier
        </button>
      </div>
      <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
        <Truck className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900">No suppliers found</h3>
        <p className="text-slate-500 mt-1">Keep track of who provides your inventory.</p>
      </div>
    </div>
  );
}
PAGE

cat << 'PAGE' > src/pages/business/BusinessOrdersPage.tsx
import React from 'react';
import { ShoppingBag, Plus } from 'lucide-react';

export default function BusinessOrdersPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Orders</h1>
          <p className="text-sm text-slate-500 mt-1">Track offline and online sales.</p>
        </div>
        <button className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2">
          <Plus className="w-4 h-4" /> Create Order
        </button>
      </div>
      <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
        <ShoppingBag className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900">No orders yet</h3>
      </div>
    </div>
  );
}
PAGE

cat << 'PAGE' > src/pages/business/FinancePage.tsx
import React from 'react';
import { CreditCard, Plus, ArrowDownRight, ArrowUpRight } from 'lucide-react';

export default function FinancePage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Finance & Expenses</h1>
          <p className="text-sm text-slate-500 mt-1">Track business expenses and revenue.</p>
        </div>
        <button className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2">
          <Plus className="w-4 h-4" /> Record Expense
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-3xl">
           <ArrowDownRight className="w-8 h-8 text-emerald-600 mb-2" />
           <p className="text-sm font-medium text-emerald-800">Total Revenue (Demo)</p>
           <h3 className="text-2xl font-bold text-emerald-900 mt-1">₦0.00</h3>
        </div>
        <div className="bg-rose-50 border border-rose-100 p-6 rounded-3xl">
           <ArrowUpRight className="w-8 h-8 text-rose-600 mb-2" />
           <p className="text-sm font-medium text-rose-800">Total Expenses (Demo)</p>
           <h3 className="text-2xl font-bold text-rose-900 mt-1">₦0.00</h3>
        </div>
        <div className="bg-blue-50 border border-blue-100 p-6 rounded-3xl">
           <CreditCard className="w-8 h-8 text-blue-600 mb-2" />
           <p className="text-sm font-medium text-blue-800">Net Balance (Demo)</p>
           <h3 className="text-2xl font-bold text-blue-900 mt-1">₦0.00</h3>
        </div>
      </div>
    </div>
  );
}
PAGE

cat << 'PAGE' > src/pages/business/ReportsPage.tsx
import React from 'react';
import { BarChart3 } from 'lucide-react';

export default function ReportsPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reports & Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">Insights into your business performance.</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
        <BarChart3 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900">Not enough data</h3>
        <p className="text-slate-500 mt-1">Reports will generate once you have sufficient sales activity.</p>
      </div>
    </div>
  );
}
PAGE

cat << 'PAGE' > src/pages/business/ActivityPage.tsx
import React from 'react';
import { Activity } from 'lucide-react';

export default function ActivityPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Activity Logs</h1>
        <p className="text-sm text-slate-500 mt-1">Audit trail of staff and business actions.</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
        <Activity className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900">No recent activity</h3>
      </div>
    </div>
  );
}
PAGE
