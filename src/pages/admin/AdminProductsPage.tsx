import React, { useEffect, useMemo, useState } from 'react';
import { Package, Search, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface AdminProduct {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  sellerId?: string;
  category?: string;
  price?: number;
  currency?: string;
  status?: string;
  createdAt?: unknown;
}

function formatDate(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toLocaleDateString();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString();
  }
  return '—';
}

function formatPrice(value: unknown, currency = 'NGN') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(value);
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;

    const loadProducts = async () => {
      setLoading(true);
      setError('');
      try {
        const snapshot = await getDocs(collection(db, 'products'));
        if (!active) return;
        setProducts(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as AdminProduct)));
      } catch (loadError) {
        console.error('Failed to load admin products:', loadError);
        if (active) setError('Unable to load products. Check administrator access and try again.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadProducts();
    return () => { active = false; };
  }, []);

  const refreshProducts = async () => {
    setRefreshing(true);
    setError('');
    try {
      const snapshot = await getDocs(collection(db, 'products'));
      setProducts(snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as AdminProduct));
    } catch (loadError) {
      console.error('Failed to refresh products:', loadError);
      setError('Unable to refresh products. Check administrator access and try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter(product =>
      [product.name, product.title, product.description, product.sellerId, product.category, product.status, product.id]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(term))
    );
  }, [products, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Global Product Catalog</h1>
          <p className="text-sm text-slate-500 mt-1">Administer all products available across the ecosystem.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button type="button" onClick={() => void refreshProducts()} disabled={refreshing} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={refreshing ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} /> Refresh
          </button>
          <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search products..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading products...
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-8 h-8 mx-auto text-rose-500 mb-3" />
            <p className="text-sm text-rose-700">{error}</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-8 h-8 text-slate-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-900">
              {products.length === 0 ? 'No products found' : 'No matching products'}
            </h3>
            <p className="text-slate-500 mt-1">
              {products.length === 0 ? 'Products will appear here when sellers publish them.' : 'Try a different search term.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Product</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Seller</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Price</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{product.name || product.title || 'Unnamed product'}</div>
                      <div className="text-xs text-slate-500">{product.id}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{product.sellerId || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{product.category || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{formatPrice(product.price, product.currency || 'NGN')}</td>
                    <td className="px-4 py-3 text-slate-600">{product.status || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(product.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
