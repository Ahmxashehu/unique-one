import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Trash2, ArrowRight, Loader2, Minus, Plus } from 'lucide-react';
import { collection, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Product, CartItem } from '../../lib/os/types';
import { useAuth } from '../../contexts/AuthContext';

type CartRow = CartItem & { product: Product };

export default function StoreCartPage() {
  const { currentUser } = useAuth();
  const [items, setItems] = useState<CartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCart = async () => {
    if (!currentUser) { setItems([]); setLoading(false); return; }
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'carts'), where('customerId', '==', currentUser.uid)));
      const rows: CartRow[] = [];
      for (const cartDoc of snap.docs) {
        const cart = cartDoc.data() as CartItem;
        const productSnap = await getDocs(query(collection(db, 'products'), where('id', '==', cart.productId)));
        if (!productSnap.empty) {
          rows.push({ ...cart, id: cartDoc.id, product: productSnap.docs[0].data() as Product });
        }
      }
      setItems(rows);
    } catch (err: any) {
      setError(err.message || 'Could not load your cart.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCart(); }, [currentUser]);

  const removeItem = async (item: CartRow) => {
    try {
      await deleteDoc(doc(db, 'carts', item.id));
      setItems(current => current.filter(row => row.id !== item.id));
    } catch (err: any) { setError(err.message || 'Could not remove item.'); }
  };

  const changeQuantity = async (item: CartRow, quantity: number) => {
    const min = Math.max(1, item.product.minOrderQuantity || 1);
    const max = Math.max(min, item.product.quantity);
    const next = Math.max(min, Math.min(max, quantity));
    try {
      await updateDoc(doc(db, 'carts', item.id), { quantity: next, updatedAt: new Date().toISOString() });
      setItems(current => current.map(row => row.id === item.id ? { ...row, quantity: next } : row));
    } catch (err: any) { setError(err.message || 'Could not update quantity.'); }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight text-slate-900">Your Cart</h1><p className="text-sm text-slate-500 mt-1">Review your items before checkout.</p></div>
      {error && <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
      {!currentUser ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center"><h3 className="text-xl font-semibold text-slate-900">Sign in to view your cart</h3><Link to="/login" className="inline-block mt-6 bg-slate-900 text-white px-6 py-3 rounded-xl text-sm font-medium">Sign In</Link></div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4"><ShoppingBag className="w-10 h-10 text-blue-600" /></div>
          <h3 className="text-xl font-semibold text-slate-900">Your cart is empty</h3>
          <p className="text-slate-500 mt-2 max-w-sm mx-auto">Looks like you haven't added any products or services to your cart yet.</p>
          <Link to="/store/search" className="inline-block mt-6 bg-slate-900 text-white px-6 py-3 rounded-xl text-sm font-medium">Start Shopping</Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {items.map(item => (
              <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-4">
                <Link to={`/store/product/${item.product.id}`} className="w-24 h-24 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                  {item.product.images?.[0] ? <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover" /> : <ShoppingBag className="w-8 h-8 m-8 text-slate-300" />}
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/store/product/${item.product.id}`} className="font-semibold text-slate-900 hover:text-blue-600">{item.product.name}</Link>
                  <p className="text-sm text-slate-500 mt-1">{item.product.currency === 'NGN' ? '₦' : '$'}{item.product.price.toLocaleString()} each</p>
                  <div className="flex items-center justify-between gap-3 mt-3">
                    <div className="flex items-center border rounded-lg overflow-hidden">
                      <button onClick={() => changeQuantity(item, item.quantity - 1)} className="p-2 bg-slate-50"><Minus className="w-4 h-4" /></button>
                      <span className="px-4 text-sm font-medium">{item.quantity}</span>
                      <button onClick={() => changeQuantity(item, item.quantity + 1)} className="p-2 bg-slate-50"><Plus className="w-4 h-4" /></button>
                    </div>
                    <button onClick={() => removeItem(item)} className="text-slate-400 hover:text-red-600 p-2" aria-label="Remove item"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="font-bold text-slate-900 whitespace-nowrap">{item.product.currency === 'NGN' ? '₦' : '$'}{(item.product.price * item.quantity).toLocaleString()}</div>
              </div>
            ))}
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 h-fit">
            <h2 className="font-semibold text-slate-900">Order Summary</h2>
            <div className="flex justify-between mt-4 text-sm text-slate-600"><span>Subtotal</span><span>{items[0]?.product.currency === 'NGN' ? '₦' : '$'}{total.toLocaleString()}</span></div>
            <div className="flex justify-between mt-3 pt-3 border-t font-bold text-slate-900"><span>Total</span><span>{items[0]?.product.currency === 'NGN' ? '₦' : '$'}{total.toLocaleString()}</span></div>
            <button disabled className="w-full mt-6 bg-slate-900 text-white py-3 rounded-xl font-medium opacity-50 cursor-not-allowed flex items-center justify-center gap-2">Checkout <ArrowRight className="w-4 h-4" /></button>
            <p className="text-xs text-slate-500 mt-3">Checkout and payment will be connected after the order workflow is implemented.</p>
          </div>
        </div>
      )}
    </div>
  );
}