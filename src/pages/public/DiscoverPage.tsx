import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, TrendingUp, Store as StoreIcon, Loader2, ShoppingBag } from 'lucide-react';
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
    <div className="min-w-0 max-w-7xl mx-auto overflow-x-hidden px-3 py-6 sm:px-6 md:py-12 lg:px-8 space-y-8 md:space-y-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Discover</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-lg">Explore real businesses, services, and products across Unique One.</p>
      </div>

      <section>
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          <h2 className="text-xl font-semibold text-slate-900">Trending Now</h2>
        </div>

        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
        ) : error ? (
          <div className="bg-white border border-red-100 rounded-2xl p-10 text-center">
            <p className="font-medium text-slate-900">Could not load Discover</p>
            <p className="text-sm text-slate-500 mt-2">{error}</p>
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
            <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-900">Nothing trending yet</h3>
            <p className="text-sm text-slate-500 mt-2">Real published products will appear here when sellers add them.</p>
            <Link to="/store" className="inline-block mt-5 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium">Visit Store</Link>
          </div>
        ) : (
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {products.map(product => (
              <Link key={product.id} to={`/store/product/${product.id}`} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="h-40 bg-slate-100 flex items-center justify-center overflow-hidden sm:h-48">
                  {product.images?.length ? <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" /> : <StoreIcon className="w-8 h-8 text-slate-300" />}
                </div>
                <div className="p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">{product.category?.replace('_', ' ') || 'Product'}</span>
                    <span className="text-sm font-semibold text-slate-700">{product.currency === 'NGN' ? '₦' : '$'}{Number(product.price).toLocaleString()}</span>
                  </div>
                  <h3 className="font-semibold text-slate-900 line-clamp-1">{product.name}</h3>
                  <p className="text-sm text-slate-500 mt-1 line-clamp-2">{product.description || 'Published product from a Unique seller.'}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

      </section>

      <section>
        <div className="flex items-center gap-2 mb-6">
          <Briefcase className="w-5 h-5 text-emerald-600" />
          <h2 className="text-xl font-semibold text-slate-900">Services</h2>
        </div>
        {services.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
            <p className="text-sm text-slate-500">No published services yet. Real provider services will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map(service => (
              <article key={service.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">{service.category || 'Service'}</span>
                <h3 className="mt-3 font-semibold text-slate-900">{service.title}</h3>
                <p className="text-sm text-slate-500 mt-1 line-clamp-2">{service.description}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="font-bold text-slate-900">{service.currency === 'NGN' ? '₦' : '$'}{Number(service.price || 0).toLocaleString()}</span>
                  <span className="text-xs text-slate-500">{service.durationHours || 0}h</span>
                </div>
                <div className="mt-4 flex gap-2">
                  {service.providerName && <span className="text-xs text-slate-500 truncate flex-1">{service.providerName}</span>}
                  <Link to="/os/services" className="text-xs font-bold text-emerald-700">View →</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
