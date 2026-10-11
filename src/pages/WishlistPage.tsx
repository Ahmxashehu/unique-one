import React, { useCallback, useEffect, useState } from 'react';
import { Heart, Loader2, ShoppingBag, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, deleteDoc, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { getLanguage, t, type SupportedLanguage } from '../lib/i18n';
import type { Product, ProductLanguage, ProductTranslation } from '../lib/os/types';

type SavedProduct = Product & { id: string };

export default function WishlistPage() {
  const { currentUser } = useAuth();
  const [language, setLanguage] = useState<SupportedLanguage>(() => getLanguage());
  const [products, setProducts] = useState<SavedProduct[]>([]);
  const [translations, setTranslations] = useState<Record<string, ProductTranslation>>({});
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const syncLanguage = (event: Event) => {
      const detail = (event as CustomEvent<SupportedLanguage>).detail;
      setLanguage(detail || getLanguage());
    };
    window.addEventListener('unique-language-change', syncLanguage);
    return () => window.removeEventListener('unique-language-change', syncLanguage);
  }, []);

  const loadWishlist = useCallback(async () => {
    if (!currentUser) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const saved = await getDocs(query(collection(db, 'wishlists'), where('customerId', '==', currentUser.uid)));
      const records = await Promise.all(saved.docs.map(async savedDoc => {
        const productId = String(savedDoc.data().productId || '');
        if (!productId) return null;
        try {
          const productSnap = await getDoc(doc(db, 'products', productId));
          if (!productSnap.exists()) return null;
          const product = productSnap.data() as Product;
          if (product.status !== 'published') return null;
          return { ...product, id: productId } as SavedProduct;
        } catch {
          return null;
        }
      }));
      setProducts(records.filter((item): item is SavedProduct => item !== null));
    } catch (err) {
      console.error('Could not load wishlist:', err);
      setError(t('error', language));
    } finally {
      setLoading(false);
    }
  }, [currentUser, language]);

  useEffect(() => {
    void loadWishlist();
  }, [loadWishlist]);

  useEffect(() => {
    let active = true;
    setTranslations({});
    if (language === 'en' || products.length === 0) return () => { active = false; };
    const targetLanguage = language as ProductLanguage;
    const uncached = products
      .filter(product => !product.translations?.[targetLanguage]?.name || !product.translations?.[targetLanguage]?.description)
      .slice(0, 4);
    const loadTranslations = async () => {
      const resolved: Record<string, ProductTranslation> = {};
      await Promise.all(uncached.map(async product => {
        try {
          const response = await fetch(`/api/store/products/${encodeURIComponent(product.id)}/translation?language=${encodeURIComponent(language)}`);
          if (!response.ok) return;
          const result = await response.json() as { language?: string; name?: string; description?: string; variants?: ProductTranslation['variants']; sourceHash?: string; translatedAt?: unknown };
          if (result.language === language && typeof result.name === 'string' && typeof result.description === 'string') {
            resolved[product.id] = {
              name: result.name,
              description: result.description,
              variants: result.variants,
              sourceHash: result.sourceHash || '',
              translatedAt: result.translatedAt,
            };
          }
        } catch {
          // Keep the original product name when translation is unavailable.
        }
      }));
      if (active) setTranslations(resolved);
    };
    void loadTranslations();
    return () => { active = false; };
  }, [products, language]);

  const removeSavedProduct = async (productId: string) => {
    if (!currentUser || removingId) return;
    setRemovingId(productId);
    try {
      await deleteDoc(doc(db, 'wishlists', `${productId}_${currentUser.uid}`));
      setProducts(current => current.filter(product => product.id !== productId));
    } catch (err) {
      console.error('Could not remove saved product:', err);
      setError(t('error', language));
    } finally {
      setRemovingId(null);
    }
  };

  const displayName = (product: SavedProduct) =>
    language === 'en'
      ? product.name
      : translations[product.id]?.name || product.translations?.[language as ProductLanguage]?.name || product.name;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('wishlist', language)}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {language === 'en' ? "Products you've saved for later." : t('favorites', language)}
        </p>
      </header>

      {!currentUser ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <Heart className="mx-auto mb-4 h-10 w-10 text-slate-300" />
          <p className="font-semibold text-slate-900">{t('login', language)}</p>
          <p className="mt-1 text-sm text-slate-500">{language === 'en' ? 'Log in to view your saved products.' : t('login', language)}</p>
          <Link to="/login" className="mt-4 inline-flex rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white">{t('login', language)}</Link>
        </div>
      ) : loading ? (
        <div className="flex justify-center rounded-2xl border border-slate-200 bg-white p-12"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-white p-8 text-center">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => void loadWishlist()} className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">{t('retry', language)}</button>
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50"><Heart className="h-8 w-8 text-rose-300" /></div>
          <h2 className="text-lg font-semibold text-slate-900">{language === 'en' ? 'Your wishlist is empty' : t('noResults', language)}</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{language === 'en' ? 'Browse the Store and save products to find them here.' : t('store', language)}</p>
          <Link to="/store" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"><ShoppingBag className="h-4 w-4" />{t('store', language)}</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {products.map(product => (
            <article key={product.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <Link to={`/store/product/${product.id}`} className="block">
                <div className="aspect-square overflow-hidden bg-slate-100">
                  {product.images?.[0] ? <img src={product.images[0]} alt={displayName(product)} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ShoppingBag className="h-9 w-9 text-slate-300" /></div>}
                </div>
                <div className="p-3">
                  <h2 className="line-clamp-2 min-h-10 text-sm font-semibold text-slate-900">{displayName(product)}</h2>
                  <p className="mt-2 text-base font-bold text-slate-900">{product.currency === 'NGN' ? '₦' : `${product.currency} `}{Number(product.price).toLocaleString()}</p>
                  <p className="mt-1 text-xs capitalize text-slate-500">{String(product.category || '').replace(/_/g, ' ')}</p>
                </div>
              </Link>
              <div className="px-3 pb-3">
                <button type="button" onClick={() => void removeSavedProduct(product.id)} disabled={removingId !== null} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50">
                  {removingId === product.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {t('delete', language)}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
