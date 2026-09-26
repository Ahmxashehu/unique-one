import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Store, ShieldCheck, Heart, ShoppingBag, MessageSquare, Handshake, MapPin, Loader2, AlertCircle } from 'lucide-react';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Product } from '../../lib/os/types';
import { useAuth } from '../../contexts/AuthContext';

export default function StoreProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [savingWishlist, setSavingWishlist] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) {
        setError('Product not found.');
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'products', id));
        if (snap.exists()) {
          const data = snap.data() as Product;
          if (data.status !== 'published') {
            setError('Product is not currently available.');
          } else {
            setProduct(data);
            setQuantity(Math.max(1, data.minOrderQuantity || 1));
          }
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

  useEffect(() => {
    if (!currentUser || !id) {
      setIsWishlisted(false);
      return;
    }

    const loadWishlistState = async () => {
      try {
        const snap = await getDoc(doc(db, 'wishlists', id + '_' + currentUser.uid));
        setIsWishlisted(snap.exists());
      } catch (err) {
        console.error('Error loading wishlist state:', err);
      }
    };
    loadWishlistState();
  }, [currentUser, id]);

  const requireAuth = () => {
    if (!currentUser) {
      navigate('/login');
      return false;
    }
    return true;
  };

  const handleAddToCart = async () => {
    if (!product || !id || !requireAuth()) return;
    const safeQuantity = Math.max(product.minOrderQuantity || 1, Math.min(product.quantity, quantity));
    setAddingToCart(true);
    try {
      const cartId = id + '_' + currentUser!.uid;
      await setDoc(doc(db, 'carts', cartId), {
        id: cartId,
        customerId: currentUser!.uid,
        productId: id,
        quantity: safeQuantity,
        updatedAt: serverTimestamp()
      }, { merge: true });
      navigate('/store/cart');
    } catch (err: any) {
      setError(err.message || 'Could not add this product to your cart.');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleSaveWishlist = async () => {
    if (!product || !id || !requireAuth()) return;
    setSavingWishlist(true);
    try {
      const wishlistId = id + '_' + currentUser!.uid;
      if (isWishlisted) {
        await deleteDoc(doc(db, 'wishlists', wishlistId));
        setIsWishlisted(false);
      } else {
        await setDoc(doc(db, 'wishlists', wishlistId), {
          id: wishlistId,
          customerId: currentUser!.uid,
          productId: id,
          updatedAt: serverTimestamp()
        });
        setIsWishlisted(true);
      }
    } catch (err: any) {
      setError(err.message || 'Could not update your wishlist.');
    } finally {
      setSavingWishlist(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  if (error || !product) return (
    <div className="max-w-7xl mx-auto px-4 py-12 text-center">
      <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-slate-900 mb-2">{error || 'Product not found.'}</h2>
      <p className="text-slate-500">Only real, published Store products are shown here.</p>
      <Link to="/store/search" className="inline-block mt-5 px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium">Back to Store</Link>
    </div>
  );

  const minQuantity = Math.max(1, product.minOrderQuantity || 1);
  const maxQuantity = Math.max(minQuantity, product.quantity);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-20">
      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        <div className="space-y-4">
          <div className="aspect-square bg-slate-100 rounded-3xl border border-slate-200 flex items-center justify-center overflow-hidden relative">
            {product.images?.length > 0 ? <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" /> : <Store className="w-16 h-16 text-slate-300" />}
            <div className="absolute top-4 left-4 flex gap-2">
              <span className="px-3 py-1 bg-white/90 backdrop-blur text-[10px] font-bold uppercase tracking-wider rounded shadow-sm text-slate-700">{product.condition}</span>
              {product.wholesalePrice && <span className="px-3 py-1 bg-blue-100 text-[10px] font-bold uppercase tracking-wider rounded shadow-sm text-blue-800">Wholesale Avail</span>}
            </div>
          </div>
          <div className="flex gap-2">{product.images?.slice(1, 5).map((image, index) => <img key={image + index} src={image} alt={product.name + ' ' + (index + 2)} className="w-20 h-20 object-cover rounded-xl border border-slate-200" />)}</div>
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-2 uppercase tracking-wide">{product.category.replace('_', ' ')}</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-tight">{product.name}</h1>
            <div className="mt-4 flex items-end gap-4">
              <span className="text-3xl font-bold text-slate-900">{product.currency === 'NGN' ? '₦' : '$'}{product.price.toLocaleString()}</span>
              {product.quantity > 0 ? <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full mb-1">In Stock ({product.quantity})</span> : <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full mb-1">Out of Stock</span>}
            </div>
            {product.wholesalePrice && <p className="text-sm font-medium text-blue-600 mt-2">Wholesale: {product.currency === 'NGN' ? '₦' : '$'}{product.wholesalePrice.toLocaleString()} (Min qty: {product.minOrderQuantity})</p>}
          </div>
          <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{product.description}</p>
          {product.location?.address && <div className="flex items-center gap-1 text-sm text-slate-500"><MapPin className="w-4 h-4" /> {product.location.address}</div>}
          <div className="pt-6 border-t border-slate-100 space-y-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-slate-700">Quantity</label>
              <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden w-32">
                <button onClick={() => setQuantity(Math.max(minQuantity, quantity - 1))} className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold">-</button>
                <input type="number" value={quantity} onChange={e => setQuantity(Math.max(minQuantity, Math.min(maxQuantity, parseInt(e.target.value) || minQuantity)))} className="w-full text-center focus:outline-none" min={minQuantity} max={maxQuantity} />
                <button onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))} className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold">+</button>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={handleAddToCart} disabled={addingToCart || product.quantity === 0} className="flex-1 bg-slate-900 text-white px-8 py-4 rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">{addingToCart ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShoppingBag className="w-5 h-5" />} Add to Cart</button>
              <button onClick={handleSaveWishlist} disabled={savingWishlist} className={`px-6 py-4 rounded-xl border font-medium transition-colors flex items-center justify-center gap-2 ${isWishlisted ? 'border-red-200 bg-red-50 text-red-600' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>{savingWishlist ? <Loader2 className="w-5 h-5 animate-spin" /> : <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-current' : ''}`} />} {isWishlisted ? 'Saved' : 'Save'}</button>
            </div>
            <div className="flex gap-3">
              <button className="flex-1 px-4 py-3 bg-blue-50 text-blue-700 font-medium rounded-xl hover:bg-blue-100 transition-colors flex justify-center items-center gap-2"><Handshake className="w-4 h-4" /> Request Quote</button>
              <Link to={`/os/messages/new?product=${product.id}&seller=${product.sellerId}`} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors flex justify-center items-center gap-2"><MessageSquare className="w-4 h-4" /> Message Seller</Link>
            </div>
          </div>
          <Link to={`/store/seller/${product.sellerId}`} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200 hover:bg-slate-50 transition-colors">
            <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center"><Store className="w-6 h-6 text-slate-400" /></div>
            <div className="flex-1"><h3 className="font-semibold text-slate-900 flex items-center gap-1">Seller Identity <ShieldCheck className="w-4 h-4 text-blue-500" /></h3><p className="text-sm text-slate-500">View profile and other items</p></div>
          </Link>
        </div>
      </div>
    </div>
  );
}
