import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Store, ShieldCheck, Heart, ShoppingBag, MessageSquare, Handshake, MapPin, Loader2, AlertCircle } from 'lucide-react';
import { db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Product } from '../../lib/os/types';
import { useAuth } from '../../contexts/AuthContext';
import { useOfflineQueue } from '../../contexts/OfflineQueueContext';

export default function StoreProductPage() {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const { enqueueOperation } = useOfflineQueue();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [savingWishlist, setSavingWishlist] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProduct(docSnap.data() as Product);
          setQuantity(docSnap.data().minOrderQuantity || 1);
        } else {
          setError('Product not found.');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load product.');
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  const handleAddToCart = () => {
    if (!product || !currentUser) return;
    setAddingToCart(true);
    enqueueOperation(`Add ${quantity}x ${product.name} to Cart`, async () => {
      // In a real implementation we would write to a carts subcollection or document
      // For now, we simulate the action and delay.
      await new Promise(resolve => setTimeout(resolve, 800));
    });
    setTimeout(() => setAddingToCart(false), 800);
  };

  const handleSaveWishlist = () => {
    if (!product || !currentUser) return;
    setSavingWishlist(true);
    enqueueOperation(`Save ${product.name} to Wishlist`, async () => {
      // Simulate db write
      await new Promise(resolve => setTimeout(resolve, 800));
    });
    setTimeout(() => setSavingWishlist(false), 800);
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  if (error || !product) return (
    <div className="max-w-7xl mx-auto px-4 py-12 text-center">
      <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-slate-900 mb-2">Error loading product</h2>
      <p className="text-slate-500">{error}</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-20">
      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Images */}
        <div className="space-y-4">
          <div className="aspect-square bg-slate-100 rounded-3xl border border-slate-200 flex items-center justify-center overflow-hidden relative">
            {product.images?.length > 0 ? (
              <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <Store className="w-16 h-16 text-slate-300" />
            )}
            <div className="absolute top-4 left-4 flex gap-2">
              <span className="px-3 py-1 bg-white/90 backdrop-blur text-[10px] font-bold uppercase tracking-wider rounded shadow-sm text-slate-700">
                {product.condition}
              </span>
              {product.wholesalePrice && (
                <span className="px-3 py-1 bg-blue-100 text-[10px] font-bold uppercase tracking-wider rounded shadow-sm text-blue-800">
                  Wholesale Avail
                </span>
              )}
            </div>
          </div>
          {/* Thumbnails placeholder */}
          <div className="flex gap-2">
            {[1,2,3,4].map(i => (
              <div key={i} className="w-20 h-20 bg-slate-100 rounded-xl border border-slate-200" />
            ))}
          </div>
        </div>
        
        {/* Details */}
        <div className="space-y-6">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-2 uppercase tracking-wide">{product.category.replace('_', ' ')}</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-tight">{product.name}</h1>
            <div className="mt-4 flex items-end gap-4">
              <span className="text-3xl font-bold text-slate-900">{product.currency === 'NGN' ? '₦' : '$'}{product.price.toLocaleString()}</span>
              {product.status === 'published' && product.quantity > 0 ? (
                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full mb-1">In Stock ({product.quantity})</span>
              ) : (
                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full mb-1">Out of Stock</span>
              )}
            </div>
            {product.wholesalePrice && (
              <p className="text-sm font-medium text-blue-600 mt-2">Wholesale: {product.currency === 'NGN' ? '₦' : '$'}{product.wholesalePrice.toLocaleString()} (Min qty: {product.minOrderQuantity})</p>
            )}
          </div>
          
          <div className="prose prose-slate max-w-none">
            <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{product.description}</p>
          </div>

          <div className="flex items-center gap-4 text-sm text-slate-500">
             <div className="flex items-center gap-1"><MapPin className="w-4 h-4"/> {product.location.address || 'Location hidden'}</div>
          </div>
          
          <div className="pt-6 border-t border-slate-100 space-y-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-slate-700">Quantity</label>
              <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden w-32">
                <button onClick={() => setQuantity(Math.max(product.minOrderQuantity || 1, quantity - 1))} className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold">-</button>
                <input type="number" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)} className="w-full text-center focus:outline-none" min={product.minOrderQuantity || 1} max={product.quantity} />
                <button onClick={() => setQuantity(Math.min(product.quantity, quantity + 1))} className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold">+</button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={handleAddToCart} 
                disabled={addingToCart || product.quantity === 0}
                className="flex-1 bg-slate-900 text-white px-8 py-4 rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {addingToCart ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShoppingBag className="w-5 h-5" />} 
                Add to Cart
              </button>
              <button 
                onClick={handleSaveWishlist}
                disabled={savingWishlist}
                className="px-6 py-4 rounded-xl border border-slate-200 font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
              >
                {savingWishlist ? <Loader2 className="w-5 h-5 animate-spin" /> : <Heart className="w-5 h-5" />}
              </button>
            </div>
            
            <div className="flex gap-3">
              <button className="flex-1 px-4 py-3 bg-blue-50 text-blue-700 font-medium rounded-xl hover:bg-blue-100 transition-colors flex justify-center items-center gap-2">
                <Handshake className="w-4 h-4" /> Request Quote
              </button>
              <Link to={`/os/messages/new?product=${product.id}&seller=${product.sellerId}`} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors flex justify-center items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Message Seller
              </Link>
            </div>
          </div>
          
          <div className="pt-8 space-y-4">
            <Link to={`/store/seller/${product.sellerId}`} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center">
                <Store className="w-6 h-6 text-slate-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 flex items-center gap-1">Seller Identity <ShieldCheck className="w-4 h-4 text-blue-500" /></h3>
                <p className="text-sm text-slate-500">View profile and other items</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
