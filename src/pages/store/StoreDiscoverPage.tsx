import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Tag, Building2, Store as StoreIcon, Heart, Loader2, ShoppingBag } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Product } from '../../lib/os/types';
import { useAuth } from '../../contexts/AuthContext';
import { doc, setDoc, deleteDoc, getDoc, serverTimestamp } from 'firebase/firestore';

export default function StoreDiscoverPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [wishlistLoading, setWishlistLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const categories = [
    { name: 'Electronics', icon: '💻', path: '/store/categories?cat=electronics' },
    { name: 'Fashion', icon: '👕', path: '/store/categories?cat=fashion' },
    { name: 'Agriculture', icon: '🌾', path: '/store/categories?cat=agriculture' },
    { name: 'Building', icon: '🏗️', path: '/store/categories?cat=building_materials' },
    { name: 'Vehicles', icon: '🚗', path: '/store/categories?cat=vehicles' },
    { name: 'Services', icon: '🔧', path: '/store/categories?cat=services' },
  ];

  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
      setError('');
      try {
        const snapshot = await getDocs(query(collection(db, 'products'), where('status', '==', 'published')));
        const realProducts = snapshot.docs
          .map(d => ({ ...(d.data() as Product), id: d.id }))
          .filter(p => p.name && Number.isFinite(Number(p.price)) && Number(p.quantity) > 0)
          .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
          .slice(0, 8);
        setProducts(realProducts);
      } catch (err: any) {
        console.error('Error loading Store products:', err);
        setError(err.message || 'Could not load Store products.');
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setWishlistIds(new Set());
      return;
    }
    const loadWishlist = async () => {
      try {
        const snapshot = await getDocs(query(collection(db, 'wishlists'), where('customerId', '==', currentUser.uid)));
        setWishlistIds(new Set(snapshot.docs.map(d => String(d.data().productId))));
      } catch (err) {
        console.error('Error loading wishlist:', err);
      }
    };
    loadWishlist();
  }, [currentUser]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(searchText.trim() ? `/store/search?q=${encodeURIComponent(searchText.trim())}` : '/store/search');
  };

  const toggleWishlist = async (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUser || !product.id || wishlistLoading) {
      if (!currentUser) navigate('/login');
      return;
    }

    const wishlistId = product.id + '_' + currentUser.uid;
    setWishlistLoading(product.id);
    try {
      if (wishlistIds.has(product.id)) {
        await deleteDoc(doc(db, 'wishlists', wishlistId));
        setWishlistIds(prev => {
          const next = new Set(prev);
          next.delete(product.id);
          return next;
        });
      } else {
        await setDoc(doc(db, 'wishlists', wishlistId), {
          id: wishlistId,
          customerId: currentUser.uid,
          productId: product.id,
          updatedAt: serverTimestamp(),
        });
        setWishlistIds(prev => new Set(prev).add(product.id));
      }
    } finally {
      setWishlistLoading(null);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div className="bg-slate-900 rounded-3xl p-8 md:p-12 text-center relative overflow-hidden">
        <div className="relative z-10 max-w-2xl mx-auto space-y-6">
          <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight">The Unique Marketplace</h1>
          <p className="text-slate-300 text-lg">Find products, services, and wholesale deals directly from verified sellers.</p>
          <form onSubmit={handleSearch} className="relative flex items-center">
            <Search className="absolute left-4 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search products, sellers, or services..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              className="w-full pl-12 pr-32 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" className="absolute right-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">Search</button>
          </form>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/store/search?filter=wholesale" className="px-4 py-2 bg-white/10 text-white rounded-full text-sm hover:bg-white/20 transition-colors">Wholesale & Bulk</Link>
            <Link to="/store/search?filter=near_me" className="px-4 py-2 bg-white/10 text-white rounded-full text-sm hover:bg-white/20 transition-colors">Near Me</Link>
            <Link to="/store/product-request" className="px-4 py-2 bg-white/10 text-white rounded-full text-sm hover:bg-white/20 transition-colors border border-white/20">Request a Product</Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
        {categories.map(cat => (
          <Link key={cat.name} to={cat.path} className="flex flex-col items-center gap-3 p-4 bg-white border border-slate-100 rounded-2xl hover:shadow-md hover:border-slate-200 transition-all text-center">
            <div className="text-3xl">{cat.icon}</div>
            <span className="text-xs sm:text-sm font-medium text-slate-700">{cat.name}</span>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col items-start justify-center">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4"><Tag className="w-6 h-6" /></div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Wholesale & Bulk</h2>
          <p className="text-slate-500 mb-6">Connect directly with manufacturers and distributors for bulk pricing.</p>
          <Link to="/store/search?filter=bulk" className="text-blue-600 font-medium hover:underline">Browse Wholesale Categories →</Link>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col items-start justify-center">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4"><Building2 className="w-6 h-6" /></div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Verified Businesses</h2>
          <p className="text-slate-500 mb-6">Shop from verified local businesses, agents, and service providers.</p>
          <Link to="/store/search?filter=verified_sellers" className="text-emerald-600 font-medium hover:underline">Find Local Businesses →</Link>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900">Featured Products</h2>
          <Link to="/store/search" className="text-sm font-medium text-blue-600 hover:underline">View all</Link>
        </div>

        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
        ) : error ? (
          <div className="bg-white border border-red-100 rounded-2xl p-10 text-center">
            <p className="font-medium text-slate-900">Could not load products</p>
            <p className="text-sm text-slate-500 mt-2">{error}</p>
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
            <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-900">No products available yet</h3>
            <p className="text-sm text-slate-500 mt-2">Published products from real sellers will appear here.</p>
            <Link to="/store/product-request" className="inline-block mt-5 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium">Request a Product</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {products.map(product => (
              <Link key={product.id} to={`/store/product/${product.id}`} className="group flex flex-col bg-white border border-slate-100 rounded-2xl overflow-hidden hover:shadow-lg transition-all">
                <div className="aspect-square bg-slate-100 relative overflow-hidden flex items-center justify-center">
                  {product.images?.length ? <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <StoreIcon className="w-8 h-8 text-slate-300" />}
                  <button
                    type="button"
                    onClick={e => toggleWishlist(product, e)}
                    className={`absolute top-2 right-2 p-2 bg-white/80 backdrop-blur rounded-full transition-colors z-10 ${wishlistIds.has(product.id) ? 'text-red-500' : 'text-slate-400 hover:text-red-500'}`}
                    aria-label={wishlistIds.has(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}
                  >
                    {wishlistLoading === product.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className={`w-4 h-4 ${wishlistIds.has(product.id) ? 'fill-current' : ''}`} />}
                  </button>
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-white/90 backdrop-blur text-[10px] font-bold uppercase tracking-wider rounded text-slate-700">{product.condition}</div>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="text-sm font-medium text-slate-900 line-clamp-2 mb-1">{product.name}</h3>
                  <p className="text-lg font-bold text-slate-900 mt-auto">{product.currency === 'NGN' ? '₦' : '$'}{Number(product.price).toLocaleString()}</p>
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-2"><StoreIcon className="w-3 h-3" /><span className="truncate">Seller</span></div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
