import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Filter, Store as StoreIcon, Heart, Loader2, Building2, Briefcase } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Product } from '../../lib/os/types';

type StoreProductsCacheEntry = { products: Product[]; expiresAt: number };

type StoreBusiness = {
  id: string;
  name?: string;
  businessName?: string;
  description?: string;
  category?: string;
  status?: string;
  verificationStatus?: string;
  logoUrl?: string;
};

type StoreService = {
  id: string;
  ownerUid?: string;
  providerName?: string;
  title?: string;
  category?: string;
  description?: string;
  price?: number;
  currency?: string;
  durationHours?: number;
  status?: string;
};


import { scoreSearchMatch } from '../../lib/search/intelligentSearch';

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
  const [businesses, setBusinesses] = useState<StoreBusiness[]>([]);
  const [services, setServices] = useState<StoreService[]>([]);
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

  useEffect(() => {
    let active = true;
    const fetchUnifiedResults = async () => {
      setLoading(true); setError('');
      try {
        const lowerQ = initialQuery.trim().toLowerCase();
        const [publishedProducts, businessSnapshot, serviceSnapshot] = await Promise.all([
          loadPublishedProducts(filterCat),
          getDocs(collection(db, 'businesses')).catch(err => {
            console.warn('Business discovery unavailable; continuing with Store listings:', err);
            return null;
          }),
          getDocs(query(collection(db, 'services'), where('status', '==', 'published'))).catch(err => {
            console.warn('Service discovery unavailable; continuing with Store listings:', err);
            return null;
          }),
        ]);

        let productResults = publishedProducts;
        if (lowerQ) {
          productResults = productResults
          .map(product => ({ product, score: scoreSearchMatch(initialQuery, [product.name, product.description, product.category, product.sellerId]) }))
          .filter(entry => !lowerQ || entry.score > 0)
          .sort((a, b) => b.score - a.score)
          .map(entry => entry.product);
        }
        productResults = productResults.filter(p => {
          const price = Number(p.price);
          return Number.isFinite(price) && price >= minPrice && (maxPrice === null || price <= maxPrice);
        });

        const serviceResults: StoreService[] = serviceSnapshot
          ? serviceSnapshot.docs
              .map(d => ({ id: d.id, ...d.data() } as StoreService))
              .filter(service => {
                if (filterCat && filterCat !== 'services' && String(service.category || '').toLowerCase() !== filterCat.toLowerCase()) return false;
                if (!lowerQ) return true;
                return scoreSearchMatch(initialQuery, [service.title, service.providerName, service.category, service.description]) > 0;
              })
              .sort((a, b) => scoreSearchMatch(initialQuery, [b.title, b.providerName, b.category, b.description]) - scoreSearchMatch(initialQuery, [a.title, a.providerName, a.category, a.description]))
          : [];

        const businessResults: StoreBusiness[] = businessSnapshot
          ? businessSnapshot.docs
              .map(d => ({ id: d.id, ...d.data() } as StoreBusiness))
              .filter(b => {
                const publicStatus = String(b.status || '').toLowerCase();
                const verification = String(b.verificationStatus || '').toLowerCase();
                // Fail closed: a business with missing publication metadata may be a
                // draft or an unreviewed registration. Only explicit publication or
                // verification can make it discoverable in the public Store.
                const publiclyDiscoverable =
                  ['published', 'active', 'approved', 'verified'].includes(publicStatus) ||
                  verification === 'verified';
                if (!publiclyDiscoverable) return false;
                if (filterCat && String(b.category || '').toLowerCase() !== filterCat.toLowerCase()) return false;
                if (!lowerQ) return true;
                return scoreSearchMatch(initialQuery, [b.name, b.businessName, b.description, b.category, b.id]) > 0;
              })
          : [];

        if (active) {
          setProducts(productResults);
          setBusinesses(businessResults);
          setServices(serviceResults);
        }
      } catch (err) {
        console.error('Error fetching unified Store search:', err);
        if (active) setError('Could not load Store listings.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchUnifiedResults();
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{initialQuery ? `Results for "${initialQuery}"` : filterCat ? `Category: ${filterCat.replace('_', ' ')}` : 'Global Search'}</h1>
          <p className="text-sm text-slate-500 mt-1">{products.length + services.length + businesses.length} results found across live products, services and discoverable businesses.</p>
        </div>
        <form onSubmit={handleSearch} className="flex items-center gap-2 w-full md:w-96">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="text" placeholder="Search products, services, businesses..." value={searchInput} onChange={e => setSearchInput(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent" /></div>
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
            {categoryOptions.map(([cat, label]) => (
              <Link key={cat} to={`/store/search?cat=${cat}`} className={`block text-sm ${filterCat === cat ? 'text-emerald-700 font-medium' : 'text-slate-600 hover:text-slate-900'} ${filterCat === cat ? 'rounded-lg bg-emerald-50 px-2 py-1' : ''}`}>{label}</Link>
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
          products.length === 0 && services.length === 0 && businesses.length === 0 ? <div className="bg-white border border-slate-200 rounded-2xl p-10 sm:p-12 text-center"><div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4"><Search className="w-8 h-8 text-slate-400" /></div><h3 className="text-lg font-semibold text-slate-900">No live listings found</h3><p className="text-slate-500 mt-2 max-w-md mx-auto">Unique Store will show real published seller products and services here as they become available. No sample stock is displayed.</p></div> :
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
            {services.map(service => (
              <div key={`service-${service.id}`} className="group flex flex-col bg-white border border-emerald-100 rounded-2xl overflow-hidden hover:shadow-lg transition-all">
                <div className="aspect-square bg-gradient-to-br from-emerald-50 via-white to-slate-100 relative overflow-hidden flex items-center justify-center">
                  <Briefcase className="w-9 h-9 text-emerald-400" />
                  <div className="absolute top-2 left-2 px-2 py-1 bg-white/90 backdrop-blur text-[10px] font-bold uppercase tracking-wider rounded text-emerald-700">Service</div>
                </div>
                <div className="p-3 sm:p-4 flex flex-col flex-1">
                  <h3 className="text-sm font-medium text-slate-900 line-clamp-2 mb-1">{service.title || 'Untitled service'}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2">{service.description || 'Professional service on Unique One.'}</p>
                  <p className="text-base sm:text-lg font-bold text-slate-900 mt-auto pt-2">{service.currency === 'NGN' || !service.currency ? '₦' : service.currency}{Number(service.price || 0).toLocaleString()}</p>
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-2"><Briefcase className="w-3 h-3" /><span className="truncate">{service.providerName || 'Unique provider'} · {service.category || 'Professional Services'}</span></div>
                </div>
              </div>
            ))}
            {businesses.map(business => (
              <div key={`business-${business.id}`} className="group flex flex-col bg-white border border-slate-100 rounded-2xl overflow-hidden hover:shadow-lg transition-all">
                <div className="aspect-square bg-slate-50 relative overflow-hidden flex items-center justify-center">
                  {business.logoUrl ? <img src={business.logoUrl} alt={business.businessName || business.name || 'Business'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <Building2 className="w-8 h-8 text-slate-300" />}
                  <div className="absolute top-2 left-2 px-2 py-1 bg-white/90 backdrop-blur text-[10px] font-bold uppercase tracking-wider rounded text-emerald-700">Business</div>
                </div>
                <div className="p-3 sm:p-4 flex flex-col flex-1">
                  <h3 className="text-sm font-medium text-slate-900 line-clamp-2 mb-1">{business.businessName || business.name || 'Unnamed business'}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-auto">{business.description || 'Discover this business on Unique One.'}</p>
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-2"><Building2 className="w-3 h-3" /><span className="truncate">{business.category || 'Business services'}</span></div>
                </div>
              </div>
            ))}
            {products.map(product => (
            <Link key={product.id} to={`/store/product/${product.id}`} className="group flex flex-col bg-white border border-slate-100 rounded-2xl overflow-hidden hover:shadow-lg transition-all">
              <div className="aspect-square bg-slate-100 relative overflow-hidden flex items-center justify-center">
                {product.images?.length > 0 ? <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <StoreIcon className="w-8 h-8 text-slate-300" />}
                <button className={`absolute top-2 right-2 p-2 bg-white/80 backdrop-blur rounded-full transition-colors z-10 ${wishlistIds.has(product.id) ? 'text-red-500' : 'text-slate-400 hover:text-red-500'}`} onClick={e => toggleWishlist(product, e)} aria-label={wishlistIds.has(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}>
                  {wishlistLoading === product.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className={`w-4 h-4 ${wishlistIds.has(product.id) ? 'fill-current' : ''}`} />}
                </button>
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-white/90 backdrop-blur text-[10px] font-bold uppercase tracking-wider rounded text-slate-700">{product.condition}</div>
              </div>
              <div className="p-3 sm:p-4 flex flex-col flex-1">
                <h3 className="text-sm font-medium text-slate-900 line-clamp-2 mb-1 group-hover:text-blue-600 transition-colors">{product.name}</h3>
                <p className="text-base sm:text-lg font-bold text-slate-900 mt-auto">{product.currency === 'NGN' ? '₦' : '$'}{Number(product.price).toLocaleString()}</p>
                <div className="flex items-center gap-1 text-xs text-slate-500 mt-2"><StoreIcon className="w-3 h-3" /><span className="truncate">Seller ID: {product.sellerId || 'Unavailable'}</span></div>
              </div>
            </Link>
          ))}</div>}
        </div>
      </div>
    </div>
  );
}