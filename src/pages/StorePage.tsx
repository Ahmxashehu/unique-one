import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, ShoppingBag, Heart, Package, ArrowRight, Sparkles,
  Smartphone, Shirt, Home, Hammer, Sprout, Utensils, Car, Briefcase, Loader2
} from 'lucide-react';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Product, ProductCategory } from '../lib/os/types';

const categories: Array<{ key: ProductCategory; label: string; icon: React.ElementType }> = [
  { key: 'electronics', label: 'Electronics', icon: Smartphone },
  { key: 'fashion', label: 'Fashion', icon: Shirt },
  { key: 'home_furniture', label: 'Home & Furniture', icon: Home },
  { key: 'building_materials', label: 'Building Materials', icon: Hammer },
  { key: 'agriculture', label: 'Agriculture', icon: Sprout },
  { key: 'food_groceries', label: 'Food & Groceries', icon: Utensils },
  { key: 'vehicles', label: 'Vehicles', icon: Car },
  { key: 'services', label: 'Services', icon: Briefcase },
];

export default function StorePage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadStore = async () => {
      setLoading(true);
      try {
        const productsQuery = query(
          collection(db, 'products'),
          where('status', '==', 'published'),
          orderBy('createdAt', 'desc'),
          limit(8)
        );
        const snapshot = await getDocs(productsQuery);
        if (!active) return;
        setProducts(snapshot.docs.map(d => ({ ...(d.data() as Product), id: d.id })));
      } catch (err) {
        // Keep the Store usable even when an optional index is unavailable.
        try {
          const fallback = await getDocs(
            query(collection(db, 'products'), where('status', '==', 'published'), limit(8))
          );
          if (active) setProducts(fallback.docs.map(d => ({ ...(d.data() as Product), id: d.id })));
        } catch (fallbackErr) {
          console.error('Could not load Store products:', fallbackErr);
          if (active) setProducts([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    loadStore();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setWishlistCount(0);
      setCartCount(0);
      return;
    }
    let active = true;
    const loadPersonalStoreData = async () => {
      try {
        const [wishlist, cart] = await Promise.all([
          getDocs(query(collection(db, 'wishlists'), where('customerId', '==', currentUser.uid))),
          getDocs(query(collection(db, 'carts'), where('customerId', '==', currentUser.uid))),
        ]);
        if (active) {
          setWishlistCount(wishlist.size);
          setCartCount(cart.size);
        }
      } catch (err) {
        console.error('Could not load Store account data:', err);
      }
    };
    loadPersonalStoreData();
    return () => { active = false; };
  }, [currentUser]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const value = search.trim();
    navigate(value ? `/store/search?q=${encodeURIComponent(value)}` : '/store/search');
  };

  const visibleProducts = useMemo(() => products.filter(product => product.status === 'published'), [products]);

  return (
    <div className="min-h-full space-y-6 pb-8">
      <section className="rounded-3xl bg-slate-900 text-white p-6 sm:p-8 overflow-hidden relative">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">
            <Sparkles className="w-4 h-4" /> Unique Store
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-4">Buy • Sell • Hire • Book • Discover</h1>
          <p className="text-slate-300 mt-3 max-w-2xl">
            Discover real products and services available through the Unique One marketplace.
          </p>
          <form onSubmit={submitSearch} className="mt-6 flex gap-2 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search products and services..."
                className="w-full rounded-xl bg-white text-slate-900 pl-10 pr-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-white/60"
              />
            </div>
            <button type="submit" className="rounded-xl bg-white text-slate-900 px-5 py-3 font-semibold text-sm hover:bg-slate-100">
              Search
            </button>
          </form>
        </div>
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link to="/store/search" className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-slate-300 transition-colors">
          <Package className="w-5 h-5 text-slate-700" />
          <p className="font-semibold text-slate-900 mt-3">All Products</p>
          <p className="text-xs text-slate-500 mt-1">Browse live listings</p>
        </Link>
        <Link to="/store/wishlist" className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-slate-300 transition-colors">
          <Heart className="w-5 h-5 text-rose-500" />
          <p className="font-semibold text-slate-900 mt-3">Saved</p>
          <p className="text-xs text-slate-500 mt-1">{currentUser ? `${wishlistCount} saved` : 'Sign in to save'}</p>
        </Link>
        <Link to="/store/cart" className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-slate-300 transition-colors">
          <ShoppingBag className="w-5 h-5 text-slate-700" />
          <p className="font-semibold text-slate-900 mt-3">Cart</p>
          <p className="text-xs text-slate-500 mt-1">{currentUser ? `${cartCount} item${cartCount === 1 ? '' : 's'}` : 'Sign in to shop'}</p>
        </Link>
        <Link to="/store/product-request" className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-slate-300 transition-colors">
          <Briefcase className="w-5 h-5 text-blue-600" />
          <p className="font-semibold text-slate-900 mt-3">Request</p>
          <p className="text-xs text-slate-500 mt-1">Ask sellers for a quote</p>
        </Link>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Categories</h2>
            <p className="text-sm text-slate-500">Explore by what you need.</p>
          </div>
          <Link to="/store/search" className="text-sm font-semibold text-slate-700 flex items-center gap-1">
            See all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {categories.map(({ key, label, icon: Icon }) => (
            <Link key={key} to={`/store/search?cat=${key}`} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 hover:border-slate-300 hover:shadow-sm transition-all">
              <span className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-slate-700" />
              </span>
              <span className="text-sm font-semibold text-slate-800">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Latest available</h2>
            <p className="text-sm text-slate-500">Only published Store listings are shown.</p>
          </div>
          <Link to="/store/search" className="text-sm font-semibold text-slate-700 flex items-center gap-1">
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 flex justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
            <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-900">No published listings yet</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Unique Store will show real seller listings here as they become available. No sample products are displayed.
            </p>
            <Link to="/store/product-request" className="inline-flex mt-5 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold">
              Request what you need
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {visibleProducts.map(product => (
              <Link key={product.id} to={`/store/product/${product.id}`} className="group bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition-all">
                <div className="aspect-square bg-slate-100 overflow-hidden flex items-center justify-center">
                  {product.images?.[0] ? (
                    <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <ShoppingBag className="w-9 h-9 text-slate-300" />
                  )}
                </div>
                <div className="p-3.5">
                  <p className="text-sm font-medium text-slate-900 line-clamp-2 min-h-10">{product.name}</p>
                  <p className="text-lg font-bold text-slate-900 mt-2">
                    {product.currency === 'NGN' ? '₦' : product.currency + ' '}{Number(product.price).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 capitalize">{product.category.replace(/_/g, ' ')}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
