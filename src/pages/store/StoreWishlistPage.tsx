import React, { useEffect, useMemo, useState } from 'react';
import { Heart, Search, Trash2, Loader2, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, deleteDoc, doc, getDocs, where, query, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Product, WishlistItem, type ProductLanguage, type ProductTranslation } from '../../lib/os/types';
import { getLanguage, type SupportedLanguage } from '../../lib/i18n';

type WishlistRow = WishlistItem & { product: Product };

export default function StoreWishlistPage() {
  const { currentUser } = useAuth();
  const [items, setItems] = useState<WishlistRow[]>([]);
  const [language, setLanguage] = useState<SupportedLanguage>(() => getLanguage());
  const [listTranslations, setListTranslations] = useState<Record<string, ProductTranslation>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadWishlist = async () => {
    if (!currentUser) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const snap = await getDocs(
        query(collection(db, 'wishlists'), where('customerId', '==', currentUser.uid))
      );

      const rows: WishlistRow[] = [];
      for (const wishlistDoc of snap.docs) {
        const item = wishlistDoc.data() as WishlistItem;
        const productSnap = await getDoc(doc(db, 'products', item.productId));
        if (productSnap.exists()) {
          rows.push({
            ...item,
            id: wishlistDoc.id,
            product: productSnap.data() as Product
          });
        }
      }
      setItems(rows);
    } catch (err: any) {
      setError(err.message || 'Could not load your wishlist.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWishlist();
  }, [currentUser]);

  useEffect(() => {
    const syncLanguage = (event: Event) => {
      const detail = (event as CustomEvent<SupportedLanguage>).detail;
      setLanguage(detail || getLanguage());
    };
    window.addEventListener('unique-language-change', syncLanguage);
    return () => window.removeEventListener('unique-language-change', syncLanguage);
  }, []);

  useEffect(() => {
    let active = true;
    setListTranslations({});
    if (language === 'en' || items.length === 0) return () => { active = false; };
    const targetLanguage = language as ProductLanguage;
    const uncached = items.filter(item => !item.product.translations?.[targetLanguage]?.name || !item.product.translations?.[targetLanguage]?.description).slice(0, 4);
    const loadTranslations = async () => {
      const resolved: Record<string, ProductTranslation> = {};
      await Promise.all(uncached.map(async item => {
        try {
          const response = await fetch(`/api/store/products/${encodeURIComponent(item.productId)}/translation?language=${encodeURIComponent(language)}`);
          if (!response.ok) return;
          const translation = await response.json() as { language?: string; name?: string; description?: string; variants?: ProductTranslation['variants']; sourceHash?: string; translatedAt?: unknown };
          if (translation.language === language && typeof translation.name === 'string' && typeof translation.description === 'string') {
            resolved[item.productId] = { name: translation.name, description: translation.description, variants: translation.variants, sourceHash: translation.sourceHash || '', translatedAt: translation.translatedAt };
          }
        } catch { /* Keep original seller text when translation is unavailable. */ }
      }));
      if (active) setListTranslations(resolved);
    };
    void loadTranslations();
    return () => { active = false; };
  }, [items, language]);

  const displayName = (item: WishlistRow) => language === 'en' ? item.product.name : listTranslations[item.productId]?.name || item.product.translations?.[language as ProductLanguage]?.name || item.product.name;

  const removeItem = async (item: WishlistRow) => {
    try {
      await deleteDoc(doc(db, 'wishlists', item.id));
      setItems(current => current.filter(row => row.id !== item.id));
    } catch (err: any) {
      setError(err.message || 'Could not remove this item.');
    }
  };

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter(item =>
      displayName(item).toLowerCase().includes(term) ||
      item.product.description.toLowerCase().includes(term)
    );
  }, [items, search]);

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Wishlist</h1>
          <p className="text-sm text-slate-500 mt-1">Products you've saved for later.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search wishlist..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full sm:w-64 pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}

      {!currentUser ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <Heart className="w-10 h-10 text-rose-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-900">Sign in to view your wishlist</h3>
          <Link to="/login" className="inline-block mt-6 bg-slate-900 text-white px-6 py-3 rounded-xl text-sm font-medium">Sign In</Link>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center mt-6">
          <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Heart className="w-10 h-10 text-rose-500" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900">
            {items.length === 0 ? 'Your wishlist is empty' : 'No matching saved products'}
          </h3>
          <p className="text-slate-500 mt-2 max-w-sm mx-auto">
            {items.length === 0
              ? 'Keep track of items you love by clicking the heart icon on any product.'
              : 'Try another search term.'}
          </p>
          <Link to="/store" className="inline-block mt-6 bg-slate-900 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors">
            Explore Store
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {filteredItems.map(item => (
            <div key={item.id} className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
              <Link to={`/store/product/${item.product.id}`} className="block aspect-square bg-slate-100 overflow-hidden">
                {item.product.images?.[0] ? (
                  <img src={item.product.images[0]} alt={displayName(item)} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-10 h-10 text-slate-300" /></div>
                )}
              </Link>
              <div className="p-4">
                <Link to={`/store/product/${item.product.id}`} className="font-medium text-slate-900 hover:text-blue-600 line-clamp-2">
                  {item.product.name}
                </Link>
                <p className="text-lg font-bold text-slate-900 mt-2">
                  {item.product.currency === 'NGN' ? '₦' : '$'}{item.product.price.toLocaleString()}
                </p>
                <button
                  onClick={() => removeItem(item)}
                  className="w-full mt-3 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:text-red-600 hover:border-red-200 flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
