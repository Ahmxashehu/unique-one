import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  Bookmark,
  Compass,
  Heart,
  MessageCircle,
  Play,
  Search,
  Share2,
  ShoppingBag,
  Sparkles,
  Store as StoreIcon,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product } from '../lib/os/types';

type EdgeMode = 'for-you' | 'following' | 'discover';

function formatPrice(product: Product) {
  const symbol = product.currency === 'NGN' ? '₦' : '$';
  return `${symbol}${Number(product.price).toLocaleString()}`;
}

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [mode, setMode] = useState<EdgeMode>('for-you');
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadHomeData = async () => {
      setLoading(true);
      try {
        const snapshot = await getDocs(
          query(
            collection(db, 'products'),
            where('status', '==', 'published'),
            orderBy('createdAt', 'desc'),
            limit(18),
          ),
        );

        if (cancelled) return;

        const realProducts = snapshot.docs
          .map((doc) => ({ ...(doc.data() as Product), id: doc.id }))
          .filter(
            (product) =>
              product.name &&
              Number.isFinite(Number(product.price)) &&
              Number(product.quantity) > 0,
          );

        setProducts(realProducts);
      } catch (error) {
        console.error('Unique home feed could not load:', error);
        // Keep the shell usable even when Firestore is temporarily unavailable.
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadHomeData();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;

    return products.filter((product) =>
      [product.name, product.description, product.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [products, search]);

  const edgeProducts =
    mode === 'discover' ? filteredProducts.slice(0, 12) : filteredProducts.slice(0, 6);

  return (
    <main className="min-h-screen bg-[#f7f9f8] text-slate-950">
      {/* Sticky discovery header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/os" className="flex shrink-0 items-center gap-2 font-black tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-sm text-white">
              U1
            </span>
            <span className="hidden sm:block">UNIQUE</span>
          </Link>

          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search people, businesses, products, places..."
              className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-emerald-400 focus:bg-white"
              aria-label="Search Unique"
            />
          </div>

          <button
            type="button"
            className="hidden h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white sm:flex"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>
          <Link
            to="/store"
            className="hidden rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white sm:block"
          >
            Store
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pb-20 pt-5 sm:px-6 lg:px-8">
        {/* Hero: the platform, not a static marketing page */}
        <section className="overflow-hidden rounded-[2rem] bg-slate-950 px-5 py-8 text-white shadow-sm sm:px-8 lg:px-10">
          <div className="grid items-end gap-8 lg:grid-cols-[1.2fr_.8fr]">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                UNIQUE ONE · Nigeria → Africa → World
              </div>
              <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Everything happening around you, in one Unique experience.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Discover people, businesses, products, services and opportunities while
                staying connected to the things that matter to you.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMode('for-you');
                    document.getElementById('active-edge')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300"
                >
                  <Zap className="h-4 w-4" />
                  Open Active Edge
                </button>
                <Link
                  to="/store"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white"
                >
                  Explore Store <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                ['Discover', 'Products & services', Compass],
                ['Connect', 'People & communities', Users],
                ['Experience', 'Live updates & stories', Play],
                ['Grow', 'Business & opportunities', TrendingUp],
              ].map(([title, subtitle, Icon]) => (
                <div key={String(title)} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <Icon className="mb-5 h-5 w-5 text-emerald-300" />
                  <p className="font-bold">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{subtitle}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Active Edge: social stream + discovery collection */}
        <section id="active-edge" className="mt-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Zap className="h-5 w-5" />
                </span>
                <h2 className="text-2xl font-black tracking-tight">Active Edge</h2>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                A living stream of what is relevant, active and discoverable on Unique.
              </p>
            </div>
            <Link to="/discover" className="text-sm font-bold text-emerald-700">
              View full Discover →
            </Link>
          </div>

          <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
            {[
              ['for-you', 'For You'],
              ['following', 'Following'],
              ['discover', 'Discover'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value as EdgeMode)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  mode === value
                    ? 'bg-slate-950 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-5">
              {loading ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
                  <p className="mt-4 text-sm text-slate-500">Building your Unique experience...</p>
                </div>
              ) : edgeProducts.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
                  <Sparkles className="mx-auto h-8 w-8 text-emerald-500" />
                  <h3 className="mt-3 font-bold">Your Unique Edge is ready</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                    Published products will automatically become part of the live discovery
                    experience. No demo listings are shown.
                  </p>
                  <Link
                    to="/store"
                    className="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    Explore Store
                  </Link>
                </div>
              ) : (
                edgeProducts.map((product) => (
                  <article
                    key={product.id}
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="flex items-center justify-between px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                          <StoreIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">Unique seller</p>
                          <p className="text-xs text-slate-400">
                            {product.category?.replace('_', ' ') || 'Product'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setSaved((current) => ({ ...current, [product.id]: !current[product.id] }))
                        }
                        aria-label={saved[product.id] ? 'Unsave' : 'Save'}
                        className="rounded-full p-2 hover:bg-slate-100"
                      >
                        <Bookmark className={`h-5 w-5 ${saved[product.id] ? 'fill-current text-emerald-600' : 'text-slate-500'}`} />
                      </button>
                    </div>

                    <Link to={`/store/product/${product.id}`} className="block">
                      <div className="aspect-[16/8] bg-slate-100">
                        {product.images?.length ? (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-slate-300">
                            <ShoppingBag className="h-10 w-10" />
                          </div>
                        )}
                      </div>
                    </Link>

                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-bold">{product.name}</h3>
                          <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">
                            {product.description || 'Published by a Unique seller.'}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-black text-emerald-700">
                          {formatPrice(product)}
                        </span>
                      </div>

                      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setLiked((current) => ({ ...current, [product.id]: !current[product.id] }))
                            }
                            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                          >
                            <Heart className={`h-4 w-4 ${liked[product.id] ? 'fill-current text-rose-500' : ''}`} />
                            Like
                          </button>
                          <button type="button" className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50">
                            <MessageCircle className="h-4 w-4" /> Discuss
                          </button>
                          <button type="button" className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50">
                            <Share2 className="h-4 w-4" /> Share
                          </button>
                        </div>
                        <Link
                          to={`/store/product/${product.id}`}
                          className="rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>

            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2">
                  <Compass className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-black">Discover Collection</h3>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Browse the real marketplace signal behind the Edge. Products appear from
                  published seller inventory only.
                </p>
                <div className="mt-4 space-y-2">
                  {filteredProducts.slice(0, 4).map((product) => (
                    <Link
                      key={product.id}
                      to={`/store/product/${product.id}`}
                      className="flex items-center gap-3 rounded-2xl p-2 hover:bg-slate-50"
                    >
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{product.name}</p>
                        <p className="text-xs text-emerald-700">{formatPrice(product)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
                <Link
                  to="/discover"
                  className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white"
                >
                  Explore everything <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
                <div className="flex items-center gap-2 font-black text-emerald-900">
                  <Sparkles className="h-5 w-5" />
                  One platform, many experiences
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-semibold text-emerald-900">
                  <Link to="/store" className="rounded-2xl bg-white/80 p-3">Buy & Sell</Link>
                  <Link to="/os/pay" className="rounded-2xl bg-white/80 p-3">Pay</Link>
                  <Link to="/discover" className="rounded-2xl bg-white/80 p-3">Discover</Link>
                  <Link to="/os" className="rounded-2xl bg-white/80 p-3">UniqueOS</Link>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
