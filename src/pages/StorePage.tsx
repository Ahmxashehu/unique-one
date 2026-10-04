import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, ShoppingBag, Heart, Package, ArrowRight, Sparkles, Clock3, Zap, ChevronRight,
  Smartphone, Shirt, Home, Hammer, Sprout, Utensils, Car, Briefcase, Loader2, Gem, PackageOpen, Layers3, Wheat, Tractor, Factory, Building2, Globe2
} from 'lucide-react';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Product, ProductCategory } from '../lib/os/types';

const categories: Array<{ key: ProductCategory; label: string; icon: React.ElementType }> = [
  { key: 'electronics', label: 'Electronics', icon: Smartphone },
  { key: 'phones_accessories', label: 'Phones & Accessories', icon: Smartphone },
  { key: 'fashion', label: 'Fashion', icon: Shirt },
  { key: 'shoes', label: 'Shoes', icon: PackageOpen },
  { key: 'beauty', label: 'Beauty', icon: Gem },
  { key: 'home_furniture', label: 'Home & Furniture', icon: Home },
  { key: 'building_materials', label: 'Building Materials', icon: Hammer },
  { key: 'cement', label: 'Cement', icon: Layers3 },
  { key: 'agriculture', label: 'Agriculture', icon: Sprout },
  { key: 'fertilizer', label: 'Fertilizer', icon: Wheat },
  { key: 'seeds', label: 'Seeds', icon: Sprout },
  { key: 'farm_equipment', label: 'Farm Equipment', icon: Tractor },
  { key: 'food_groceries', label: 'Food & Groceries', icon: Utensils },
  { key: 'machinery', label: 'Machinery', icon: Factory },
  { key: 'vehicles', label: 'Vehicles', icon: Car },
  { key: 'property', label: 'Property', icon: Building2 },
  { key: 'services', label: 'Services', icon: Briefcase },
  { key: 'digital_products', label: 'Digital Products', icon: Globe2 },
  { key: 'other', label: 'Other', icon: Package },
];

const categoryBands = [categories.slice(0, 10), categories.slice(10)];

export default function StorePage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [savingWishlist, setSavingWishlist] = useState<string | null>(null);


  useEffect(() => {
    let active = true;
    const loadStore = async () => {
      setLoading(true);
      try {
        const productsQuery = query(
          collection(db, 'products'),
          where('status', '==', 'published'),
          orderBy('createdAt', 'desc'),
          limit(24)
        );
        const snapshot = await getDocs(productsQuery);
        if (!active) return;
        setProducts(snapshot.docs.map(d => ({ ...(d.data() as Product), id: d.id })));
      } catch (err) {
        try {
          const fallback = await getDocs(
            query(collection(db, 'products'), where('status', '==', 'published'), limit(24))
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
          setWishlistIds(new Set(wishlist.docs.map(d => String(d.data().productId || ''))));
        }
      } catch (err) {
        console.error('Could not load Store account data:', err);
      }
    };
    loadPersonalStoreData();
    return () => { active = false; };
  }, [currentUser]);

  const toggleWishlist = async (product: Product, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!currentUser || savingWishlist) return;
    const wishlistId = `${product.id}_${currentUser.uid}`;
    setSavingWishlist(product.id);
    try {
      const { doc, setDoc, deleteDoc, serverTimestamp } = await import('firebase/firestore');
      if (wishlistIds.has(product.id)) {
        await deleteDoc(doc(db, 'wishlists', wishlistId));
        setWishlistIds(prev => { const next = new Set(prev); next.delete(product.id); return next; });
        setWishlistCount(prev => Math.max(0, prev - 1));
      } else {
        await setDoc(doc(db, 'wishlists', wishlistId), { id: wishlistId, customerId: currentUser.uid, productId: product.id, updatedAt: serverTimestamp() });
        setWishlistIds(prev => new Set(prev).add(product.id));
        setWishlistCount(prev => prev + 1);
      }
    } catch (err) {
      console.error('Could not update Store wishlist:', err);
    } finally {
      setSavingWishlist(null);
    }
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const value = search.trim();
    navigate(value ? `/store/search?q=${encodeURIComponent(value)}` : '/store/search');
  };

  const visibleProducts = useMemo(() => products.filter(product => product.status === 'published'), [products]);
  const lowStockProducts = useMemo(() => visibleProducts.filter(product => Number(product.quantity) > 0 && Number(product.quantity) <= 5), [visibleProducts]);
  const serviceListings = useMemo(() => visibleProducts.filter(product => product.category === 'services'), [visibleProducts]);


  return (
    <div className="min-h-full space-y-6 pb-8">
      <style>{`
        @keyframes storeBandLeft { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes storeBandRight { from { transform: translateX(-50%); } to { transform: translateX(0); } }
        @keyframes storePosterGlow { 0%,100% { opacity:.45; transform:scale(1); } 50% { opacity:.9; transform:scale(1.08); } }
        @keyframes storeSearchSmoke { 0%,100% { transform:translate3d(-3%,0,0) scale(1); opacity:.38; } 50% { transform:translate3d(3%,-2%,0) scale(1.06); opacity:.72; } }
        @keyframes storeSearchSweep { 0% { transform:translateX(-120%); opacity:0; } 25% { opacity:.75; } 70% { opacity:.45; } 100% { transform:translateX(120%); opacity:0; } }
        @keyframes storeSearchPulse { 0%,100% { box-shadow:0 0 0 1px rgba(52,211,153,.16),0 0 22px rgba(16,185,129,.14),0 8px 30px rgba(0,0,0,.16); } 50% { box-shadow:0 0 0 1px rgba(110,231,183,.34),0 0 38px rgba(16,185,129,.30),0 10px 38px rgba(0,0,0,.20); } }
        .store-category-track-left { animation: storeBandLeft 28s linear infinite; }
        .store-category-track-right { animation: storeBandRight 28s linear infinite; }
        .store-category-track-left:hover, .store-category-track-right:hover { animation-play-state: paused; }
      `}</style>

      <section className="relative overflow-hidden rounded-[2rem] border border-emerald-400/30 bg-slate-950 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(16,185,129,0.35),transparent_35%),radial-gradient(circle_at_8%_88%,rgba(34,197,94,0.20),transparent_32%)]" />
        <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-emerald-400/10 blur-2xl" style={{ animation: 'storePosterGlow 3s ease-in-out infinite' }} />
        <div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-emerald-300/10 blur-2xl" style={{ animation: 'storePosterGlow 4s ease-in-out infinite reverse' }} />

        <div className="relative p-4 sm:p-6 lg:p-7">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-black tracking-[0.18em] text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,.95)]" />
              UNIQUE STORE
            </div>

            <div className="mt-3 inline-flex rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 shadow-[0_0_28px_rgba(16,185,129,.10)]">
              <h1 className="text-2xl font-black tracking-[-0.04em] sm:text-4xl lg:text-5xl">Buy • Book • Discover</h1>
            </div>
            <p className="mt-3 max-w-3xl text-xs leading-5 text-white/70 sm:text-sm sm:leading-6">
              One modern marketplace for real products, trusted services, local businesses and everyday needs.
            </p>

            <form onSubmit={submitSearch} className="relative mt-4 flex max-w-3xl gap-2 rounded-2xl border border-emerald-300/25 bg-white/[0.08] p-2 backdrop-blur-xl" style={{ animation: 'storeSearchPulse 3.2s ease-in-out infinite' }}>
              <span className="pointer-events-none absolute -inset-3 -z-10 overflow-hidden rounded-[1.5rem] bg-emerald-400/20 blur-2xl" style={{ animation: 'storeSearchSmoke 4.5s ease-in-out infinite' }} />
              <span className="pointer-events-none absolute inset-y-0 left-1/4 w-1/3 -z-0 overflow-hidden rounded-full bg-emerald-300/20 blur-xl" style={{ animation: 'storeSearchSmoke 3.8s ease-in-out infinite reverse' }} />
              <span className="pointer-events-none absolute inset-y-0 left-0 z-20 w-1/4 -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent blur-sm" style={{ animation: 'storeSearchSweep 4.2s linear infinite' }} />
              <div className="relative z-10 flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search products and services..."
                  className="w-full rounded-xl border border-emerald-200/40 bg-white/[0.96] text-slate-900 pl-11 pr-4 py-3 sm:py-3.5 text-sm outline-none shadow-[inset_0_0_18px_rgba(16,185,129,.05)] transition-all focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/60"
                />
              </div>
              <button type="submit" className="hidden sm:inline-flex items-center justify-center rounded-xl bg-emerald-500 px-6 py-3 font-bold text-sm text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-400">
                Search
              </button>
            </form>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] py-3">
            <div className="mb-2 flex items-center justify-between px-3">
              <div>
                <h2 className="text-sm font-black tracking-wide text-white">Shop by category</h2>
              </div>
              <Link to="/store/search" className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-emerald-300 hover:text-emerald-200">
                All items <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="space-y-2.5">
              {categoryBands.map((band, bandIndex) => {
                const doubled = [...band, ...band];
                return (
                  <div key={bandIndex} className="overflow-hidden">
                    <div className={`flex w-max gap-2 px-1 ${bandIndex === 0 ? 'store-category-track-left' : 'store-category-track-right'}`}>
                      {doubled.map((category, index) => {
                        const Icon = category.icon;
                        return (
                          <Link
                            key={`${category.key}-${index}`}
                            to={`/store/search?cat=${category.key}`}
                            className="group flex w-[142px] shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.075] px-3 py-2.5 transition hover:border-emerald-300/50 hover:bg-emerald-400/10 sm:w-[175px]"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-400/10 text-emerald-300">
                              <Icon className="h-4.5 w-4.5" />
                            </span>
                            <span className="min-w-0 text-[11px] font-bold leading-4 text-white/85 group-hover:text-white sm:text-xs">{category.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 border-t border-white/10 pt-4">
                <section className="grid grid-cols-2 gap-3 sm:gap-4" aria-label="Your Store shortcuts">
                  <Link
                    to={currentUser ? '/store/wishlist' : '/login'}
                    className="group relative isolate min-h-[132px] overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-white via-white to-rose-50/70 p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-[0_12px_32px_rgba(244,63,94,0.10)] sm:min-h-[156px] sm:p-5"
                  >
                    <span className="pointer-events-none absolute -right-8 -top-8 -z-10 h-28 w-28 rounded-full bg-rose-200/40 blur-2xl transition-transform duration-500 group-hover:scale-125" />
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-100 bg-white text-rose-500 shadow-sm transition-transform duration-300 group-hover:scale-105">
                        <Heart className="h-5 w-5" />
                      </span>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-500 transition-all group-hover:border-rose-200 group-hover:text-rose-500">
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="mt-4">
                      <p className="text-base font-black tracking-tight text-slate-900 sm:text-lg">Save</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{currentUser ? `${wishlistCount} saved item${wishlistCount === 1 ? '' : 's'}` : 'Keep favourite finds together'}</p>
                    </div>
                  </Link>
                  <Link
                    to={currentUser ? '/store/cart' : '/login'}
                    className="group relative isolate min-h-[132px] overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-white via-white to-emerald-50/80 p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[0_12px_32px_rgba(16,185,129,0.13)] sm:min-h-[156px] sm:p-5"
                  >
                    <span className="pointer-events-none absolute -right-8 -top-8 -z-10 h-28 w-28 rounded-full bg-emerald-200/45 blur-2xl transition-transform duration-500 group-hover:scale-125" />
                    <div className="flex items-start justify-between gap-3">
                      <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-100 bg-white text-emerald-600 shadow-sm transition-transform duration-300 group-hover:scale-105">
                        <ShoppingBag className="h-5 w-5" />
                        {currentUser && cartCount > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-500 px-1 text-[10px] font-black text-white">{cartCount > 99 ? '99+' : cartCount}</span>}
                      </span>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-500 transition-all group-hover:border-emerald-200 group-hover:text-emerald-600">
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="mt-4">
                      <p className="text-base font-black tracking-tight text-slate-900 sm:text-lg">Cart</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{currentUser ? `${cartCount} item${cartCount === 1 ? '' : 's'} ready for checkout` : 'Your picks, ready when you are'}</p>
                    </div>
                  </Link>
                </section>
          </div>
        </div>
      </section>

      <section>
        {!loading && lowStockProducts.length > 0 && (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center justify-between gap-3 mb-3"><div><h3 className="font-bold text-slate-900">Low stock</h3><p className="text-xs text-slate-600">Real listings with five or fewer units currently available.</p></div><Zap className="w-5 h-5 text-amber-500" /></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{lowStockProducts.slice(0, 4).map(product => (<Link key={product.id} to={`/store/product/${product.id}`} className="bg-white rounded-xl border border-amber-100 p-3 hover:shadow-sm"><p className="text-sm font-semibold text-slate-900 line-clamp-2">{product.name}</p><p className="text-xs font-semibold text-amber-700 mt-2">{product.quantity} left</p></Link>))}</div>
          </div>
        )}

        {loading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 flex justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white/90 px-3 py-3 sm:px-4 sm:py-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1 text-left">
              <h3 className="text-sm font-semibold text-slate-800">No published listings yet</h3>
              <p className="mt-0.5 text-xs leading-4 text-slate-500">
                Real seller products will appear here when available.
              </p>
            </div>
            <Link to="/store/product-request" className="inline-flex shrink-0 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[11px] font-bold text-emerald-800 transition hover:bg-emerald-100 sm:px-3 sm:text-xs">
              Request item
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {visibleProducts.map(product => (
              <Link key={product.id} to={`/store/product/${product.id}`} className="group bg-white border border-slate-200 rounded-xl sm:rounded-2xl overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="aspect-square bg-slate-100 overflow-hidden flex items-center justify-center">
                  {product.images?.[0] ? (
                    <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <ShoppingBag className="w-9 h-9 text-slate-300" />
                  )}
                </div>
                <div className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900 line-clamp-2 min-h-10">{product.name}</p>
                    <button type="button" onClick={(event) => toggleWishlist(product, event)} disabled={savingWishlist === product.id} aria-label={wishlistIds.has(product.id) ? 'Remove from saved' : 'Save item'} className="shrink-0 rounded-full bg-slate-50 p-2 transition-colors hover:bg-rose-50">
                      <Heart className={`h-4 w-4 ${wishlistIds.has(product.id) ? 'fill-rose-500 text-rose-500' : 'text-slate-500'}`} />
                    </button>
                  </div>
                  <p className="mt-2 text-lg font-bold text-slate-900">{product.currency === 'NGN' ? '₦' : product.currency + ' '}{Number(product.price).toLocaleString()}</p>
                  <p className="mt-1 text-xs capitalize text-slate-500">{product.category.replace(/_/g, ' ')}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {!loading && serviceListings.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3"><div><h2 className="text-xl font-bold text-slate-900">Services to hire or book</h2><p className="text-sm text-slate-500">Real service listings currently published in Store.</p></div><Link to="/store/search?cat=services" className="text-sm font-semibold text-emerald-700 flex items-center gap-1">See services <ChevronRight className="w-4 h-4" /></Link></div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{serviceListings.slice(0, 4).map(product => (<Link key={product.id} to={`/store/product/${product.id}`} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-emerald-300 hover:shadow-sm transition-all"><div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3"><Clock3 className="w-5 h-5 text-emerald-700" /></div><p className="font-semibold text-slate-900 line-clamp-2">{product.name}</p><p className="text-sm font-bold text-slate-900 mt-2">{product.currency === 'NGN' ? '₦' : product.currency + ' '}{Number(product.price).toLocaleString()}</p></Link>))}</div>
        </section>
      )}
    </div>
  );
}
