import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Trash2, ArrowRight, Loader2, Minus, Plus, ChevronLeft, ShieldCheck, MapPin } from 'lucide-react';
import { createBiometricAssertion, type BiometricAssertion } from '../../components/security/PasskeySecurityCard';
import { collection, deleteDoc, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Product, CartItem } from '../../lib/os/types';
import { useAuth } from '../../contexts/AuthContext';

type CartRow = CartItem & { product: Product };

export default function StoreCartPage() {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<CartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  const [transactionPin, setTransactionPin] = useState('');
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentStep, setPaymentStep] = useState(false);
  const [pendingOrderIds, setPendingOrderIds] = useState<string[]>([]);
  const [pendingPaymentKey, setPendingPaymentKey] = useState('');
  const [selectedShippingAddressId, setSelectedShippingAddressId] = useState('');

  const loadCart = async () => {
    if (!currentUser) { setItems([]); setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const snap = await getDocs(query(collection(db, 'carts'), where('customerId', '==', currentUser.uid)));
      const rows: CartRow[] = [];

      for (const cartDoc of snap.docs) {
        const cart = cartDoc.data() as CartItem;
        // Product IDs are the Firestore document IDs created by Add Product.
        // A direct document read also respects the Store product security rule.
        const productSnap = await getDoc(doc(db, 'products', cart.productId));
        if (productSnap.exists()) {
          const product = productSnap.data() as Product;
          if (product.status === 'published') {
            rows.push({ ...cart, id: cartDoc.id, product });
          }
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

  useEffect(() => {
    const addresses = userData?.shippingAddresses || [];
    const defaultAddress = addresses.find(address => address.isDefault) || addresses[0];
    setSelectedShippingAddressId(defaultAddress?.id || '');
  }, [userData?.uid, userData?.shippingAddresses]);

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

  const handleCheckout = async () => {
    if (!currentUser || items.length === 0 || checkingOut) return;
    setCheckingOut(true);
    setError('');
    try {
      const token = await currentUser.getIdToken();
      const idempotencyKey = `store-${currentUser.uid}-${Date.now()}-${crypto.randomUUID()}`;
      const response = await fetch('/api/store/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotencyKey, shippingAddressId: selectedShippingAddressId || undefined }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error?.message || 'Could not create your order.');
      const orderIds = Array.isArray(payload?.orderIds) ? payload.orderIds.filter((id: unknown): id is string => typeof id === 'string') : [];
      if (orderIds.length === 0) throw new Error('Your order was created without a payment reference. Please contact support before retrying.');
      setPendingOrderIds(orderIds);
      setPendingPaymentKey(idempotencyKey);
      setPaymentStep(true);
      await payOrders(orderIds, idempotencyKey);

    } catch (err: any) {
      setError(err?.message || 'Could not create your order. Your cart is still available.');
    } finally {
      setCheckingOut(false);
    }
  };

  const payOrders = async (orderIds: string[], checkoutIdempotencyKey: string) => {
    if (!currentUser || paymentBusy) return;
    if (!/^\d{4}$/.test(transactionPin)) {
      setError('Enter your 4-digit Transaction PIN to pay for this order.');
      setPaymentStep(true);
      return;
    }
    setPaymentBusy(true);
    setError('');
    try {
      const token = await currentUser.getIdToken();
      const paymentIdempotencyKey = `store-pay-${checkoutIdempotencyKey}`;
      let biometricAssertion: BiometricAssertion | undefined;
      const requestPayment = async () => {
        const response = await fetch('/api/store/pay', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderIds, idempotencyKey: paymentIdempotencyKey, transactionPin, ...(biometricAssertion ? { biometricAssertion } : {}) }),
        });
        const body = await response.json().catch(() => ({}));
        return { response, body };
      };
      let result = await requestPayment();
      if (result.response.status === 403 && result.body?.error?.code === 'BIOMETRIC_REQUIRED') {
        setError(null);
        setPaymentBusy(true);
        biometricAssertion = await createBiometricAssertion(currentUser);
        result = await requestPayment();
      }
      if (!result.response.ok) throw new Error(result.body?.error?.message || 'UniquePay payment could not be completed.');
      navigate('/os/orders');
    } catch (err: any) {
      setError(err?.message || 'UniquePay payment could not be completed. Your order remains unpaid.');
      setPaymentStep(true);
    } finally {
      setPaymentBusy(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 pb-28">
      <div className="flex items-center justify-between gap-3"><div><Link to="/store/search" className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 mb-2"><ChevronLeft className="w-4 h-4" /> Continue shopping</Link><h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">Your Cart</h1><p className="text-sm text-slate-500 mt-1">Review your real Store items before checkout.</p></div></div>
      {error && <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
      {!currentUser ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center"><h3 className="text-xl font-semibold text-slate-900">Sign in to view your cart</h3><Link to="/login" className="inline-block mt-6 bg-emerald-600 text-white px-6 py-3 rounded-xl text-sm font-bold">Sign In</Link></div>
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
              <div key={item.id} className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex gap-3 sm:gap-4">
                <Link to={`/store/product/${item.product.id}`} className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-slate-100 overflow-hidden shrink-0">
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
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 h-fit lg:sticky lg:top-24">
            <div className="flex items-center justify-between"><h2 className="font-bold text-slate-900">Order Summary</h2><ShieldCheck className="w-5 h-5 text-emerald-600" /></div>
            <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2 mb-2"><MapPin className="w-4 h-4 text-slate-500"/><h3 className="font-semibold text-slate-900">Delivery address</h3></div>
              {(userData?.shippingAddresses?.length || 0) > 0 ? (
                <>
                  <select value={selectedShippingAddressId} onChange={e=>setSelectedShippingAddressId(e.target.value)} disabled={checkingOut || paymentBusy} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm">
                    {(userData?.shippingAddresses || []).map(address => <option key={address.id} value={address.id}>{address.label}{address.isDefault ? ' — Default' : ''}</option>)}
                  </select>
                  {(() => {
                    const address = (userData?.shippingAddresses || []).find(item => item.id === selectedShippingAddressId) || (userData?.shippingAddresses || []).find(item => item.isDefault) || userData?.shippingAddresses?.[0];
                    return address ? <p className="text-xs text-slate-500 mt-2">{address.recipientName} · {address.phone}<br/>{address.fullAddress}, {address.area}, {address.town}, {address.lga}, {address.state}</p> : null;
                  })()}
                </>
              ) : (
                <div className="text-xs text-slate-500">Add a shipping address in your Profile before checkout.</div>
              )}
            </div>
            <div className="flex justify-between mt-4 text-sm text-slate-600"><span>Subtotal</span><span>{items[0]?.product.currency === 'NGN' ? '₦' : '$'}{total.toLocaleString()}</span></div>
            <div className="flex justify-between mt-3 pt-3 border-t font-bold text-slate-900"><span>Total</span><span>{items[0]?.product.currency === 'NGN' ? '₦' : '$'}{total.toLocaleString()}</span></div>
            {paymentStep && (
              <div className="mt-5 p-4 rounded-xl bg-emerald-50 border border-emerald-100 space-y-3">
                <div>
                  <h3 className="font-bold text-slate-900">Pay with UniquePay</h3>
                  <p className="text-xs text-slate-600 mt-1">Enter your 4-digit Transaction PIN. Biometric verification may be requested for your first transaction or higher-value payments.</p>
                </div>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={transactionPin}
                  onChange={e => setTransactionPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="4-digit Transaction PIN"
                  className="w-full px-3 py-3 bg-white border border-emerald-200 rounded-xl text-center tracking-[0.35em] font-bold"
                  disabled={paymentBusy}
                />
                <button
                  onClick={() => {
                    if (pendingOrderIds.length > 0 && pendingPaymentKey) payOrders(pendingOrderIds, pendingPaymentKey);
                  }}
                  disabled={paymentBusy}
                  className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {paymentBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  {paymentBusy ? 'Processing UniquePay…' : 'Pay with UniquePay'}
                </button>
              </div>
            )}
            {!paymentStep && (
              <button
                onClick={handleCheckout}
                disabled={checkingOut || !selectedShippingAddressId}
                className="w-full mt-6 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {checkingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {checkingOut ? 'Creating order…' : selectedShippingAddressId ? 'Continue to UniquePay' : 'Add a delivery address'}
              </button>
            )}
            <p className="text-xs text-slate-500 mt-3">Orders are created from your real cart, then settled through the UniquePay wallet.</p>
          </div>
        </div>
      )}
    </div>
  );
}
