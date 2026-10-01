import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, TrendingUp, Store as StoreIcon, Loader2, ShoppingBag, ArrowRight, Sparkles, Heart, MapPin, Search, Utensils, Shirt, Smartphone, Home, Wrench, Truck, Sprout, GraduationCap, HeartPulse, Building2, CalendarDays } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Product } from '../../lib/os/types';

export default function DiscoverPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Array<{ id: string; title?: string; providerName?: string; category?: string; description?: string; price?: number; currency?: string; durationHours?: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
      try {
        const snapshot = await getDocs(query(collection(db, 'products'), where('status', '==', 'published')));
        const realProducts = snapshot.docs
          .map(d => ({ ...(d.data() as Product), id: d.id }))
          .filter(p => p.name && Number.isFinite(Number(p.price)) && Number(p.quantity) > 0)
          .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
          .slice(0, 6);
        setProducts(realProducts);
      } catch (err: any) {
        console.error('Error loading Discover products:', err);
        setError(err.message || 'Could not load Discover.');
      } finally {
        setLoading(false);
      }
    };
    const loadServices = async () => {
      try {
        const snapshot = await getDocs(query(collection(db, 'services'), where('status', '==', 'published')));
        setServices(snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Omit<(typeof services)[number], 'id'>) })).slice(0, 6));
      } catch (err) {
        console.error('Error loading Discover services:', err);
      }
    };
    loadProducts();
    loadServices();
  }, []);

  return (
    <div className="min-w-0 overflow-x-hidden bg-slate-50">
      <div className="mx-auto max-w-7xl px-3 py-5 sm:px-6 md:py-8 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-5 py-8 text-white shadow-xl sm:px-8 md:px-10 md:py-12">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-green-400/10 blur-3xl" />
          <div className="relative max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-emerald-200"><Sparkles className="h-4 w-4" /> Discover Unique experiences</div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">Find something useful, exciting, or uniquely yours.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">Explore real products, services and businesses available across Unique One.</p>
            <Link to="/search" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg transition hover:bg-emerald-400"><Search className="h-4 w-4" /> Search everything <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </section>
        <section className="mt-8">
          <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Explore</p><h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">What are you looking for?</h2></div>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
            <Link to="/search?q=Food" className="min-w-[105px] snap-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-md"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Utensils className="h-5 w-5" /></div><span className="mt-3 block text-xs font-bold">Food</span></Link>
            <Link to="/search?q=Fashion" className="min-w-[105px] snap-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-md"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Shirt className="h-5 w-5" /></div><span className="mt-3 block text-xs font-bold">Fashion</span></Link>
            <Link to="/search?q=Phones" className="min-w-[105px] snap-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-md"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Smartphone className="h-5 w-5" /></div><span className="mt-3 block text-xs font-bold">Phones</span></Link>
            <Link to="/search?q=Home" className="min-w-[105px] snap-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-md"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Home className="h-5 w-5" /></div><span className="mt-3 block text-xs font-bold">Home</span></Link>
            <Link to="/search?q=Repairs" className="min-w-[105px] snap-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-md"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Wrench className="h-5 w-5" /></div><span className="mt-3 block text-xs font-bold">Repairs</span></Link>
            <Link to="/search?q=Delivery" className="min-w-[105px] snap-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-md"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Truck className="h-5 w-5" /></div><span className="mt-3 block text-xs font-bold">Delivery</span></Link>
            <Link to="/search?q=Agriculture" className="min-w-[105px] snap-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-md"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Sprout className="h-5 w-5" /></div><span className="mt-3 block text-xs font-bold">Agriculture</span></Link>
            <Link to="/search?q=Learning" className="min-w-[105px] snap-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-md"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-600"><GraduationCap className="h-5 w-5" /></div><span className="mt-3 block text-xs font-bold">Learning</span></Link>
            <Link to="/search?q=Health" className="min-w-[105px] snap-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-md"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><HeartPulse className="h-5 w-5" /></div><span className="mt-3 block text-xs font-bold">Health</span></Link>
            <Link to="/search?q=Business" className="min-w-[105px] snap-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-md"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Building2 className="h-5 w-5" /></div><span className="mt-3 block text-xs font-bold">Business</span></Link>
            <Link to="/search?q=Events" className="min-w-[105px] snap-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-md"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><CalendarDays className="h-5 w-5" /></div><span className="mt-3 block text-xs font-bold">Events</span></Link>
          </div>
        </section>
        <section className="mt-10">
          <div className="mb-5 flex items-center justify-between"><div><div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-emerald-600" /><h2 className="text-xl font-bold text-slate-900">Trending now</h2></div><p className="mt-1 text-sm text-slate-500">Fresh published products from Unique sellers.</p></div><Link to="/store" className="hidden items-center gap-1 text-sm font-bold text-emerald-700 sm:flex">View Store <ArrowRight className="h-4 w-4" /></Link></div>
          `{loading ? <div className="flex justify-center rounded-3xl border border-slate-200 bg-white p-16"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div> : error ? <div className="rounded-3xl border border-red-100 bg-white p-10 text-center"><p className="font-medium text-slate-900">Could not load Discover</p><p className="mt-2 text-sm text-slate-500">{error}</p></div> : products.length === 0 ? <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center"><ShoppingBag className="mx-auto mb-3 h-10 w-10 text-slate-300" /><h3 className="text-lg font-semibold text-slate-900">Nothing trending yet</h3><p className="mt-2 text-sm text-slate-500">Real published products will appear here when sellers add them.</p><Link to="/store" className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Visit Store</Link></div> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">{products.map(product => <Link key={product.id} to={"/store/product/" + product.id} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"><div className="relative h-40 overflow-hidden bg-slate-100 sm:h-52">{product.images?.length ? <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center"><StoreIcon className="h-8 w-8 text-slate-300" /></div>}<button type="button" onClick={(e) => e.preventDefault()} aria-label="Save product" className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-slate-500 shadow-sm backdrop-blur"><Heart className="h-4 w-4" /></button></div><div className="p-4"><div className="flex items-center justify-between gap-2"><span className="truncate rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase text-emerald-700">{product.category?.replace('_', ' ') || 'Product'}</span><span className="shrink-0 text-sm font-black text-slate-900">{product.currency === 'NGN' ? '₦' : '$'}{Number(product.price).toLocaleString()}</span></div><h3 className="mt-3 truncate font-bold text-slate-900">{product.name}</h3><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{product.description || 'Published product from a Unique seller.'}</p><div className="mt-3 flex items-center gap-1 text-[11px] text-slate-400"><MapPin className="h-3.5 w-3.5" /> Available on Unique One</div></div></Link>)}</div>}
        </section>
        <section className="mt-10 rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 sm:p-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Active Edge</p><h2 className="mt-1 text-xl font-bold text-slate-900">What’s happening around Unique One?</h2><p className="mt-1 text-sm text-slate-500">Discover updates, businesses and experiences as the platform grows.</p></div><Link to="/os" className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">Open Active Edge <ArrowRight className="h-4 w-4" /></Link></div></section>
        <section className="mt-10 pb-6"><div className="mb-5 flex items-center gap-2"><Briefcase className="h-5 w-5 text-emerald-600" /><div><h2 className="text-xl font-bold text-slate-900">Services you can discover</h2><p className="text-sm text-slate-500">Real published provider services.</p></div></div>{services.length === 0 ? <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center"><p className="text-sm text-slate-500">No published services yet. Real provider services will appear here.</p></div> : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{services.map(service => <article key={service.id} className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><div className="flex items-start justify-between gap-3"><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{service.category || 'Service'}</span><span className="text-lg font-black text-slate-900">{service.currency === 'NGN' ? '₦' : '$'}{Number(service.price || 0).toLocaleString()}</span></div><h3 className="mt-4 font-bold text-slate-900">{service.title}</h3><p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">{service.description}</p><div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4"><span className="truncate text-xs text-slate-500">{service.providerName || 'Unique provider'}</span><Link to="/os/services" className="shrink-0 text-xs font-bold text-emerald-700">View <ArrowRight className="inline h-3 w-3" /></Link></div></article>)}</div>}</section>
      </div>
    </div>
  );
}
