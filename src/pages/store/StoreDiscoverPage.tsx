import React from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Tag, Star, Truck, Building2, Store as StoreIcon, Heart, ShoppingCart } from 'lucide-react';

export default function StoreDiscoverPage() {
  const categories = [
    { name: 'Electronics', icon: '💻', path: '/store/categories?cat=electronics' },
    { name: 'Fashion', icon: '👕', path: '/store/categories?cat=fashion' },
    { name: 'Agriculture', icon: '🌾', path: '/store/categories?cat=agriculture' },
    { name: 'Building', icon: '🏗️', path: '/store/categories?cat=building_materials' },
    { name: 'Vehicles', icon: '🚗', path: '/store/categories?cat=vehicles' },
    { name: 'Services', icon: '🔧', path: '/store/categories?cat=services' },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Hero Search */}
      <div className="bg-slate-900 rounded-3xl p-8 md:p-12 text-center relative overflow-hidden">
        <div className="relative z-10 max-w-2xl mx-auto space-y-6">
          <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
            The Unique Marketplace
          </h1>
          <p className="text-slate-300 text-lg">
            Find products, services, and wholesale deals directly from verified sellers.
          </p>
          <div className="relative flex items-center">
            <Search className="absolute left-4 w-5 h-5 text-slate-400" />
            <input 
              type="text"
              placeholder="Search products, sellers, or services..."
              className="w-full pl-12 pr-32 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Link to="/store/search" className="absolute right-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">
              Search
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/store/search?filter=wholesale" className="px-4 py-2 bg-white/10 text-white rounded-full text-sm hover:bg-white/20 transition-colors">Wholesale & Bulk</Link>
            <Link to="/store/search?filter=near_me" className="px-4 py-2 bg-white/10 text-white rounded-full text-sm hover:bg-white/20 transition-colors">Near Me</Link>
            <Link to="/store/product-request" className="px-4 py-2 bg-white/10 text-white rounded-full text-sm hover:bg-white/20 transition-colors border border-white/20">Request a Product</Link>
          </div>
        </div>
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl" />
      </div>

      {/* Quick Categories */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
        {categories.map(cat => (
          <Link key={cat.name} to={cat.path} className="flex flex-col items-center gap-3 p-4 bg-white border border-slate-100 rounded-2xl hover:shadow-md hover:border-slate-200 transition-all text-center">
            <div className="text-3xl">{cat.icon}</div>
            <span className="text-xs sm:text-sm font-medium text-slate-700">{cat.name}</span>
          </Link>
        ))}
      </div>

      {/* Featured Sections placeholder */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col items-start justify-center">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
            <Tag className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Wholesale & Bulk</h2>
          <p className="text-slate-500 mb-6">Connect directly with manufacturers and distributors for bulk pricing.</p>
          <Link to="/store/search?filter=bulk" className="text-blue-600 font-medium hover:underline flex items-center gap-2">
            Browse Wholesale Categories &rarr;
          </Link>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col items-start justify-center">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Verified Businesses</h2>
          <p className="text-slate-500 mb-6">Shop from verified local businesses, agents, and service providers.</p>
          <Link to="/store/search?filter=verified_sellers" className="text-emerald-600 font-medium hover:underline flex items-center gap-2">
            Find Local Businesses &rarr;
          </Link>
        </div>
      </div>

      {/* Mock Featured Products Grid */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900">Featured Products</h2>
          <Link to="/store/search" className="text-sm font-medium text-blue-600 hover:underline">View all</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {/* We will map real products later, this is a visual placeholder for layout */}
          {[1,2,3,4].map(i => (
            <div key={i} className="group flex flex-col bg-white border border-slate-100 rounded-2xl overflow-hidden hover:shadow-lg transition-all">
              <div className="aspect-square bg-slate-100 relative">
                <div className="absolute top-2 right-2 p-2 bg-white/80 backdrop-blur rounded-full text-slate-400 hover:text-red-500 cursor-pointer transition-colors">
                  <Heart className="w-4 h-4" />
                </div>
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-white/90 backdrop-blur text-[10px] font-bold uppercase tracking-wider rounded text-slate-700">
                  New
                </div>
              </div>
              <div className="p-4 flex flex-col flex-1">
                <h3 className="text-sm font-medium text-slate-900 line-clamp-2 mb-1">Example Premium Product Display Item {i}</h3>
                <p className="text-lg font-bold text-slate-900 mt-auto">₦ 25,000</p>
                <div className="flex items-center gap-1 text-xs text-slate-500 mt-2">
                  <StoreIcon className="w-3 h-3" />
                  <span className="truncate">Verified Seller Ltd</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
