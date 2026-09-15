import React from 'react';
import { Heart, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function StoreWishlistPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Wishlist</h1>
          <p className="text-sm text-slate-500 mt-1">Products you've saved for later.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search wishlist..." className="w-full sm:w-64 pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center mt-6">
        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Heart className="w-10 h-10 text-rose-500" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900">Your wishlist is empty</h3>
        <p className="text-slate-500 mt-2 max-w-sm mx-auto">
          Keep track of items you love by clicking the heart icon on any product.
        </p>
        <Link to="/store" className="inline-block mt-6 bg-slate-900 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors">
          Explore Store
        </Link>
      </div>
    </div>
  );
}
