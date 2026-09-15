import React from 'react';
import { Heart } from 'lucide-react';

export default function WishlistPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Wishlist</h1>
        <p className="text-sm text-slate-500 mt-1">Products and services you've saved for later.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Heart className="w-8 h-8 text-rose-300" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">Your wishlist is empty</h3>
        <p className="text-slate-500 mt-1 max-w-sm mx-auto">
          Explore the ecosystem and click the heart icon to save items here.
        </p>
      </div>
    </div>
  );
}
