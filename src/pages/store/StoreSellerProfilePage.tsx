import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Store, ShieldCheck, MapPin, MessageSquare } from 'lucide-react';
import { db } from '../../lib/firebase';

export default function StoreSellerProfilePage() {
  const { id } = useParams();
  const [business, setBusiness] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('Seller not found.');
      return;
    }
    Promise.all([
      getDocs(query(collection(db, 'businesses'), where('ownerUid', '==', id))),
      getDocs(query(collection(db, 'products'), where('sellerId', '==', id), where('status', '==', 'published'))),
    ]).then(([businessSnap, productSnap]) => {
      setBusiness(businessSnap.docs[0] ? { id: businessSnap.docs[0].id, ...businessSnap.docs[0].data() } : null);
      setProducts(productSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    }).catch(() => setError('Unable to load this seller right now.')).finally(() => setLoading(false));
  }, [id]);

  const sellerName = business?.name || 'Seller';
  const isVerified = business?.verificationStatus === 'verified';
  const location = business?.location?.address || 'Nigeria';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-8">
          <div className="w-24 h-24 md:w-32 md:h-32 bg-slate-100 rounded-full border-4 border-white shadow-lg flex items-center justify-center shrink-0">
            <Store className="w-12 h-12 md:w-16 md:h-16 text-slate-300" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{sellerName}</h1>
              {isVerified && <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Verified Business</span>}
            </div>
            <p className="text-slate-600 max-w-2xl">{business?.description || 'Discover products and services from this seller on Unique Store.'}</p>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-4 text-sm text-slate-500 font-medium">
              <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {location}</span>
            </div>
          </div>
          <div className="w-full md:w-auto flex shrink-0">
            <Link to={id ? `/os/messages/new?seller=${encodeURIComponent(id)}` : '/store'} className="w-full md:w-auto bg-slate-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
              <MessageSquare className="w-5 h-5" /> Contact Seller
            </Link>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-6">Products from this Seller</h2>
        {loading ? (
          <div className="text-center py-12 text-slate-500 bg-white border border-slate-100 rounded-2xl">Loading seller products…</div>
        ) : error ? (
          <div className="text-center py-12 text-red-600 bg-white border border-red-100 rounded-2xl">{error}</div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-slate-500 bg-white border border-slate-100 rounded-2xl">This seller hasn't published any products yet.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {products.map(product => (
              <Link key={product.id} to={`/store/product/${product.id}`} className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                <div className="aspect-square bg-slate-100">
                  {product.images?.[0] ? <img src={product.images[0]} alt={product.name || 'Product'} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Store className="w-10 h-10 text-slate-300" /></div>}
                </div>
                <div className="p-4">
                  <h3 className="font-medium text-slate-900 line-clamp-2">{product.name}</h3>
                  <p className="text-lg font-bold text-slate-900 mt-2">{product.currency === 'NGN' ? '₦' : '$'}{Number(product.price).toLocaleString()}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
