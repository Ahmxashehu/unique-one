import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Trash2, ArrowRight } from 'lucide-react';
// In a real app, we'd fetch cart items from a CartContext or Firestore

export default function StoreCartPage() {
  const [items, setItems] = useState<any[]>([]); // mock

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Your Cart</h1>
        <p className="text-sm text-slate-500 mt-1">Review your items before checkout.</p>
      </div>

      {items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center mt-6">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="w-10 h-10 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900">Your cart is empty</h3>
          <p className="text-slate-500 mt-2 max-w-sm mx-auto">
            Looks like you haven't added any products or services to your cart yet.
          </p>
          <Link to="/store/search" className="inline-block mt-6 bg-slate-900 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors">
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
             {/* Map cart items here */}
          </div>
          <div>
            {/* Order Summary */}
          </div>
        </div>
      )}
    </div>
  );
}
