import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Filter, Store as StoreIcon, Heart, Loader2, Smartphone, Shirt, Gem, Home, Hammer, Layers3, Sprout, Wheat, Tractor, Utensils, Factory, Car, Building2, Briefcase, Globe2, PackageOpen, Package } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Product } from '../../lib/os/types';

type StoreProductsCacheEntry = { products: Product[]; expiresAt: number };

const STORE_PRODUCTS_CACHE_TTL_MS = 30_000;
const storeProductsCache = new Map<string, StoreProductsCacheEntry>();
const storeProductsRequests = new Map<string, Promise<Product[]>>();

async function loadPublishedProducts(category: string): Promise<Product[]> {
  const cacheKey = category || '__all__';
  const cached = storeProductsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.products;

  const existingRequest = storeProductsRequests.get(cacheKey);
  if (existingRequest) return existingRequest;

  const request = (async () => {
    let q = query(collection(db, 'products'), where('status', '==', 'published'));
    if (category) q = query(q, where('category', '==', category));
    const snapshot = await getDocs(q);
    const products = snapshot.docs.map(d => ({ ...(d.data() as Product), id: d.id }));
    storeProductsCache.set(cacheKey, { products, expiresAt: Date.now() + STORE_PRODUCTS_CACHE_TTL_MS });
    return products;
  })();

  storeProductsRequests.set(cacheKey, request);
  try {
    return await request;
  } finally {
    storeProductsRequests.delete(cacheKey);
  }
}

export default function StoreSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const filterCat = searchParams.get('cat') || '';
  const minPrice = Number(searchParams.get('min') || 0);
  const maxPriceParam = searchParams.get('max');
  const maxPrice = maxPriceParam ? Number(maxPriceParam) : null;
  const { currentUser } = useAuth();
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [minPriceInput, setMinPriceInput] = useState(minPrice ? String(minPrice) : '');
  const [maxPriceInput, setMaxPriceInput] = useState(maxPrice !== null ? String(maxPrice) : '');
  const [products, setProducts] = useState<Product[]>([]);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [wishlistLoading, setWishlistLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const categoryOptions: Array<[string, string]> = [
    ['electronics', 'Electronics'],
    ['electricity_power', 'Electricity & Power'],
    ['phones_accessories', 'Phones & Accessories'],
    ['fashion', 'Fashion'],
    ['shoes', 'Shoes'],
    ['beauty', 'Beauty'],
    ['home_furniture', 'Home & Furniture'],
    ['building_materials', 'Building Materials'],
    ['cement', 'Cement'],
    ['agriculture', 'Agriculture'],
    ['fertilizer', 'Fertilizer'],
    ['seeds', 'Seeds'],
    ['farm_equipment', 'Farm Equipment'],
    ['food_groceries', 'Food & Groceries'],
    ['machinery', 'Machinery'],
    ['vehicles', 'Vehicles'],
    ['property', 'Property'],
    ['services', 'Services'],
    ['digital_products', 'Digital Products'],
    ['other', 'Other'],
  ];

  const prototypeStock: Record<string, Array<{ name: string; price: string; stock: string }>> = {
    electronics: [
      { name: 'Smart LED TV', price: '₦285,000', stock: '12 units' },
      { name: 'Bluetooth Speaker', price: '₦48,000', stock: '24 units' },
      { name: 'Home Sound System', price: '₦175,000', stock: '8 units' },
      { name: 'Smart Decoder', price: '₦32,000', stock: '30 units' },
    ],
    electricity_power: [
      { name: 'Solar Inverter 3.5kVA', price: '₦420,000', stock: '6 units' },
      { name: 'Rechargeable Solar Fan', price: '₦95,000', stock: '15 units' },
      { name: 'Solar Panel 450W', price: '₦185,000', stock: '10 units' },
      { name: 'Rechargeable LED Bulb', price: '₦8,500', stock: '40 units' },
    ],
    beauty: [
      { name: 'Skincare Set', price: '₦28,000', stock: '18 units' },
      { name: 'Hair Care Bundle', price: '₦35,000', stock: '14 units' },
      { name: 'Perfume Collection', price: '₦42,000', stock: '20 units' },
      { name: 'Beauty Essentials Kit', price: '₦22,500', stock: '25 units' },
    ],
    fashion: [
      { name: 'Men’s Clothing Set', price: '₦45,000', stock: '16 units' },
      { name: 'Women’s Casual Set', price: '₦38,000', stock: '20 units' },
      { name: 'Traditional Wear', price: '₦75,000', stock: '9 units' },
      { name: 'Kids Clothing Bundle', price: '₦30,000', stock: '22 units' },
    ],
  };

  useEffect(() => {
    let active = true;
    const fetchProducts = async () => {
      setLoading(true); setError('');
      try {
        const publishedProducts = await loadPublishedProducts(filterCat);
        let results = publishedProducts;
        if (initialQuery) {
          const lowerQ = initialQuery.toLowerCase();
          results = results.filter(p =>
            String(p.name || '').toLowerCase().includes(lowerQ) ||
            String(p.description || '').toLowerCase().includes(lowerQ)
          );
        }
        results = results.filter(p => {
          const price = Number(p.price);
          return Number.isFinite(price) && price >= minPrice && (maxPrice === null || price <= maxPrice);
        });
        if (active) setProducts(results);
      } catch (err) {
        console.error('Error fetching products:', err);
        if (active) setError('Could not load Store products.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchProducts();
    return () => { active = false; };
  }, [initialQuery, filterCat, minPrice, maxPrice]);

  useEffect(() => {
    if (!currentUser) { setWishlistIds(new Set()); return; }
    const loadWishlist = async () => {
      try {
        const snapshot = await getDocs(query(collection(db, 'wishlists'), where('customerId', '==', currentUser.uid)));
        setWishlistIds(new Set(snapshot.docs.map(d => String(d.data().productId))));
      } catch (err) { console.error('Error loading wishlist:', err); }
    };
    loadWishlist();
  }, [currentUser]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (searchInput.trim()) next.q = searchInput.trim();
    if (filterCat) next.cat = filterCat;
    if (minPriceInput.trim() && Number.isFinite(Number(minPriceInput))) next.min = String(Math.max(0, Number(minPriceInput)));
    if (maxPriceInput.trim() && Number.isFinite(Number(maxPriceInput))) next.max = String(Math.max(0, Number(maxPriceInput)));
    setSearchParams(next);
  };

  const toggleWishlist = async (product: Product, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!currentUser || !product.id || wishlistLoading) return;
    const wishlistId = `${product.id}_${currentUser.uid}`;
    setWishlistLoading(product.id);
    try {
      if (wishlistIds.has(product.id)) {
        await deleteDoc(doc(db, 'wishlists', wishlistId));
        setWishlistIds(prev => { const next = new Set(prev); next.delete(product.id); return next; });
      } else {
        await setDoc(doc(db, 'wishlists', wishlistId), { id: wishlistId, customerId: currentUser.uid, productId: product.id, updatedAt: serverTimestamp() });
        setWishlistIds(prev => new Set(prev).add(product.id));
      }
    } catch (err) {
      console.error('Error updating wishlist:', err);
    } finally { setWishlistLoading(null); }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{initialQuery ? `Search results for "${initialQuery}"` : filterCat ? `Category: ${filterCat.replace('_', ' ')}` : 'All Products'}</h1>
          <p className="text-sm text-slate-500 mt-1">{products.length} products found.</p>
        </div>
        <form onSubmit={handleSearch} className="flex items-center gap-2 w-full md:w-96">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="text" placeholder="Search store..." value={searchInput} onChange={e => setSearchInput(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent" /></div>
          <button type="submit" className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium">Search</button>
          <button type="button" onClick={() => setShowMobileFilters(prev => !prev)} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50" aria-label={showMobileFilters ? 'Hide filters' : 'Show filters'} aria-expanded={showMobileFilters}>
            <Filter className="w-5 h-5" />
          </button>
        </form>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {showMobileFilters && (
          <div className="md:hidden bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
            <div><h3 className="font-semibold text-slate-900 mb-3">Categories</h3><div className="grid grid-cols-2 gap-2">
              {categoryOptions.map(([cat, label]) => (
                <Link key={cat} to={`/store/search?cat=${cat}`} className={`text-sm p-2 rounded-lg border ${filterCat === cat ? 'text-emerald-700 font-medium border-emerald-200 bg-emerald-50' : 'text-slate-600 border-slate-200'}`}>{label}</Link>
              ))}
            </div></div>
            <div><h3 className="font-semibold text-slate-900 mb-3">Price Range</h3><form onSubmit={handleSearch} className="flex gap-2">
              <input type="number" min="0" placeholder="Min" value={minPriceInput} onChange={e => setMinPriceInput(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              <input type="number" min="0" placeholder="Max" value={maxPriceInput} onChange={e => setMaxPriceInput(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              <button type="submit" className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium">Apply</button>
            </form></div>
          </div>
        )}

        <div className="hidden md:block w-64 shrink-0 space-y-6">
          <div><h3 className="font-semibold text-slate-900 mb-3">Categories</h3><div className="space-y-2">
            {['electronics', 'fashion', 'agriculture', 'building_materials', 'services', 'vehicles'].map(cat => (
              <Link key={cat} to={`/store/search?cat=${cat}`} className={`block text-sm ${filterCat === cat ? 'text-blue-600 font-medium' : 'text-slate-600 hover:text-slate-900'} capitalize`}>{cat.replace('_', ' ')}</Link>
            ))}
            <Link to="/store/search" className="block text-sm text-slate-400 hover:text-slate-600">Clear Category</Link>
          </div></div>
          <div><h3 className="font-semibold text-slate-900 mb-3">Price Range</h3><form onSubmit={handleSearch} className="flex gap-2">
            <input type="number" min="0" placeholder="Min" value={minPriceInput} onChange={e => setMinPriceInput(e.target.value)} className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm" />
            <input type="number" min="0" placeholder="Max" value={maxPriceInput} onChange={e => setMaxPriceInput(e.target.value)} className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm" />
          </form></div>
        </div>

        <div className="flex-1">
          {loading ? <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div> :
          error ? <div className="bg-white border border-red-100 rounded-2xl p-12 text-center"><h3 className="text-xl font-semibold text-slate-900">Could not load products</h3><p className="text-slate-500 mt-2">{error}</p></div> :
          products.length === 0 ? (filterCat && prototypeStock[filterCat] ? <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Prototype stock preview</p>
              <h3 className="mt-1 text-base font-black text-slate-900">{categoryOptions.find(([cat]) => cat === filterCat)?.[1] || 'Category'}</h3>
              <p className="mt-1 text-xs leading-4 text-slate-600">These are UI test cards only. They are not real seller inventory and cannot be purchased. Real seller listings will appear automatically when published.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{prototypeStock[filterCat].map(item => <div key={item.name} className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex aspect-square items-center justify-center bg-slate-100"><StoreIcon className="h-10 w-10 text-slate-300" /></div>
              <div className="p-3"><p className="line-clamp-2 text-sm font-semibold text-slate-900">{item.name}</p><p className="mt-2 text-base font-black text-slate-900">{item.price}</p><p className="mt-1 text-[11px] font-bold text-emerald-700">Prototype stock: {item.stock}</p></div>
            </div>)}</div>
          </div> : <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center"><div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4"><Search className="w-10 h-10 text-slate-400" /></div><h3 className="text-xl font-semibold text-slate-900">No products found</h3><p className="text-slate-500 mt-2 max-w-sm mx-auto">Try adjusting your search terms or filters to find what you're looking for.</p></div>) :
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">{products.map(product => (
            <Link key={product.id} to={`/store/product/${product.id}`} className="group flex flex-col bg-white border border-slate-100 rounded-2xl overflow-hidden hover:shadow-lg transition-all">
              <div className="aspect-square bg-slate-100 relative overflow-hidden flex items-center justify-center">
                {product.images?.length > 0 ? <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <StoreIcon className="w-8 h-8 text-slate-300" />}
                <button className={`absolute top-2 right-2 p-2 bg-white/80 backdrop-blur rounded-full transition-colors z-10 ${wishlistIds.has(product.id) ? 'text-red-500' : 'text-slate-400 hover:text-red-500'}`} onClick={e => toggleWishlist(product, e)} aria-label={wishlistIds.has(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}>
                  {wishlistLoading === product.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className={`w-4 h-4 ${wishlistIds.has(product.id) ? 'fill-current' : ''}`} />}
                </button>
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-white/90 backdrop-blur text-[10px] font-bold uppercase tracking-wider rounded text-slate-700">{product.condition}</div>
              </div>
              <div className="p-4 flex flex-col flex-1">
                <h3 className="text-sm font-medium text-slate-900 line-clamp-2 mb-1 group-hover:text-blue-600 transition-colors">{product.name}</h3>
                <p className="text-lg font-bold text-slate-900 mt-auto">{product.currency === 'NGN' ? '₦' : '$'}{Number(product.price).toLocaleString()}</p>
                <div className="flex items-center gap-1 text-xs text-slate-500 mt-2"><StoreIcon className="w-3 h-3" /><span className="truncate">Seller ID: {product.sellerId || 'Unavailable'}</span></div>
              </div>
            </Link>
          ))}</div>}
        </div>
      </div>
    </div>
  );
}