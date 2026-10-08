import React, { useEffect, useMemo, useState } from 'react';
import { Box, Plus, Search, RefreshCw, Loader2, Package, Pencil, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';

type CatalogProduct = {
  id: string; sellerId: string; name?: string; description?: string; category?: string;
  price?: number; currency?: string; quantity?: number; status?: string; condition?: string;
  images?: string[]; minOrderQuantity?: number; createdAt?: any;
};

export default function CatalogPage() {
  const { currentUser } = useAuth();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'products'>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<CatalogProduct | null>(null);
  const [saving, setSaving] = useState(false);

  const loadCatalog = async () => {
    if (!currentUser) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const snap = await getDocs(query(collection(db, 'products'), where('sellerId', '==', currentUser.uid)));
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as CatalogProduct)));
    } catch (err) {
      console.error('Catalog load failed:', err);
      setError('We could not load your catalog. Please try again.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void loadCatalog(); }, [currentUser?.uid]);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter(product =>
      !term || [product.name, product.description, product.category].some(value =>
        String(value || '').toLowerCase().includes(term)
      )
    ).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [products, search]);

  const money = (value: number, currency = 'NGN') =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

  const saveEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser || !editing) return;
    setSaving(true); setError('');
    try {
      const token = await currentUser.getIdToken();
      const businessSession = localStorage.getItem('unique_business_session') || '';
      const form = new FormData(event.currentTarget);
      const payload = {
        name: String(form.get('name') || ''),
        description: String(form.get('description') || ''),
        category: String(form.get('category') || ''),
        condition: String(form.get('condition') || 'new'),
        price: Number(form.get('price')),
        minOrderQuantity: Number(form.get('minOrderQuantity')),
        ...(String(form.get('status') || '') ? { status: String(form.get('status')) } : {}),
      };
      const response = await fetch('/api/business/products/' + encodeURIComponent(editing.id), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Business-Session': businessSession,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error?.message || 'Product update failed.');
      setEditing(null);
      await loadCatalog();
    } catch (err) {
      console.error('Catalog update failed:', err);
      setError(err instanceof Error ? err.message : 'Unable to update the product.');
    } finally { setSaving(false); }
  };

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

        {loading ? <div className="p-12 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div> :
        visibleProducts.length === 0 ? <div className="p-12 text-center"><Box className="w-12 h-12 text-slate-400 mx-auto mb-4" /><h3 className="text-lg font-semibold text-slate-900">{products.length ? 'No matching products' : 'Catalog is empty'}</h3><p className="text-slate-500 mt-1">{products.length ? 'Try a different search.' : 'Start adding your real products to sell on Unique Store.'}</p></div> :
        <div className="divide-y divide-slate-100">{visibleProducts.map(product => (
          <div key={product.id} className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">{product.images?.[0] ? <img src={product.images[0]} alt="" className="w-full h-full object-cover" /> : <Package className="w-7 h-7 text-slate-400" />}</div>
            <div className="min-w-0 flex-1"><h3 className="font-semibold text-slate-900 truncate">{product.name || 'Unnamed product'}</h3><p className="text-sm text-slate-500 mt-1 capitalize">{product.category || 'Uncategorized'} · {product.status || 'unknown'}</p></div>
            <div className="text-sm font-semibold text-slate-900">{money(Number(product.price || 0), product.currency || 'NGN')}</div>
            <div className="text-sm text-slate-500">Qty: {Number(product.quantity || 0)}</div>
            <button onClick={() => { setError(''); setEditing(product); }} className="border border-slate-200 px-3 py-2 rounded-xl text-sm font-medium text-slate-700 flex items-center gap-1"><Pencil className="w-4 h-4" />Edit</button>
          </div>
        ))}</div>}
      </div>

      {editing && <div className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center">
        <form onSubmit={saveEdit} className="w-full max-w-xl bg-white rounded-3xl shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold text-slate-900">Edit product</h2><p className="text-sm text-slate-500">Inventory quantity remains controlled by Inventory.</p></div><button type="button" onClick={() => setEditing(null)} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button></div>
          <input name="name" defaultValue={editing.name || ''} required maxLength={200} placeholder="Product name" className="w-full border border-slate-200 rounded-xl px-3 py-2.5" />
          <textarea name="description" defaultValue={editing.description || ''} required maxLength={5000} placeholder="Description" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 min-h-24" />
          <div className="grid grid-cols-2 gap-3">
            <input name="category" defaultValue={editing.category || 'other'} required placeholder="Category" className="w-full border border-slate-200 rounded-xl px-3 py-2.5" />
            <select name="condition" defaultValue={editing.condition || 'new'} className="w-full border border-slate-200 rounded-xl px-3 py-2.5"><option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option></select>
            <input name="price" type="number" min="0" step="0.01" defaultValue={Number(editing.price || 0)} required className="w-full border border-slate-200 rounded-xl px-3 py-2.5" />
            <input name="minOrderQuantity" type="number" min="1" step="1" defaultValue={Number(editing.minOrderQuantity || 1)} required className="w-full border border-slate-200 rounded-xl px-3 py-2.5" />
          </div>
          <select name="status" defaultValue="" className="w-full border border-slate-200 rounded-xl px-3 py-2.5"><option value="">Keep current status</option><option value="draft">Draft</option><option value="published">Published</option><option value="out_of_stock">Out of stock</option></select>
          <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setEditing(null)} className="px-4 py-2.5 rounded-xl border border-slate-200">Cancel</button><button disabled={saving} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button></div>
        </form>
      </div>}
    </div>
  );
}
