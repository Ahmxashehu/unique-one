import React, { useEffect, useMemo, useState } from 'react';
import { Box, Plus, Search, RefreshCw, Loader2, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';

type CatalogProduct = {
  id: string;
  sellerId: string;
  name?: string;
  description?: string;
  category?: string;
  price?: number;
  currency?: string;
  quantity?: number;
  status?: string;
  images?: string[];
  createdAt?: any;
};

export default function CatalogPage() {
  const { currentUser } = useAuth();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'products'>('all');
  const [search, setSearch] = useState('');

  const loadCatalog = async () => {
    if (!currentUser) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const snap = await getDocs(query(collection(db, 'products'), where('sellerId', '==', currentUser.uid)));
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as CatalogProduct)));
    } catch (err) {
      console.error('Catalog load failed:', err);
      setError('We could not load your catalog. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadCatalog(); }, [currentUser?.uid]);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products
      .filter(product => !term || [product.name, product.description, product.category].some(value => String(value || '').toLowerCase().includes(term)))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [products, search]);

  const money = (value: number, currency = 'NGN') =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Products & Services</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your catalog, pricing, and visibility.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/os/business/catalog/new-service" className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium">Add Service</Link>
          <Link to="/os/business/catalog/new-product" className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" /> Add Product</Link>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
        <div className="border-b border-slate-100 p-3 flex flex-col sm:flex-row gap-2">
          <div className="flex gap-2">
            <button onClick={() => setFilter('all')} className={`px-5 py-2 rounded-lg text-sm font-semibold ${filter === 'all' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>All Items</button>
            <button onClick={() => setFilter('products')} className={`px-5 py-2 rounded-lg text-sm font-medium ${filter === 'products' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>Products</button>
          </div>
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={e => setSearch(e.target.value)} type="text" placeholder="Search your catalog..." className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none" />
          </div>
          <button onClick={() => void loadCatalog()} disabled={loading} className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 disabled:opacity-50"><RefreshCw className={`inline w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>
        ) : visibleProducts.length === 0 ? (
          <div className="p-12 text-center">
            <Box className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900">{products.length ? 'No matching products' : 'Catalog is empty'}</h3>
            <p className="text-slate-500 mt-1">{products.length ? 'Try a different search.' : 'Start adding your real products to sell on Unique Store.'}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleProducts.map(product => (
              <div key={product.id} className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                  {product.images?.[0] ? <img src={product.images[0]} alt="" className="w-full h-full object-cover" /> : <Package className="w-7 h-7 text-slate-400" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-slate-900 truncate">{product.name || 'Unnamed product'}</h3>
                  <p className="text-sm text-slate-500 mt-1 capitalize">{product.category || 'Uncategorized'} · {product.status || 'unknown'}</p>
                </div>
                <div className="text-sm font-semibold text-slate-900">{money(Number(product.price || 0), product.currency || 'NGN')}</div>
                <div className="text-sm text-slate-500">Qty: {Number(product.quantity || 0)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}