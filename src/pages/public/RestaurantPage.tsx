import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  ArrowLeft, CalendarDays, ChevronDown, Clock3, MapPin, Search, Star,
  Utensils, Users, X, Navigation, Heart, SlidersHorizontal, CreditCard, Landmark
} from 'lucide-react';

type MenuItem = { id: string; restaurantId: string; businessId: string; branchId: string; name: string; category: string; description: string; priceMinor: number; currency: 'NGN'; available: boolean; };

type Restaurant = {
  id: string;
  name: string;
  cuisine: string;
  city: string;
  area: string;
  rating: number;
  price: string;
  time: string;
  tags: string[];
  description: string;
};

const cuisineFilters = ['All', 'Nigerian', 'Grill', 'Fast Food', 'Healthy', 'Pizza', 'Continental', 'Asian'];
const KEY = 'uniqueplatform:guest-restaurant-draft';

type Draft = {
  restaurantId: string;
  date: string;
  time: string;
  guests: number;
  seating: string;
  notes: string;
  mode: 'dine-in' | 'delivery' | 'pickup';
  paymentMethod: 'uniquepay' | 'bank-transfer';
  deliveryAddress: string;
  customerName: string;
  customerPhone: string;
  cart: Record<string, number>;
};

const emptyDraft: Draft = {
  restaurantId: '',
  date: '',
  time: '',
  guests: 2,
  seating: 'Standard table',
  notes: '',
  mode: 'dine-in',
  paymentMethod: 'uniquepay',
  deliveryAddress: '',
  customerName: '',
  customerPhone: '',
  cart: {},
};

export default function RestaurantPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantLoading, setRestaurantLoading] = useState(true);
  const [restaurantError, setRestaurantError] = useState('');
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('Abuja');
  const [cuisine, setCuisine] = useState('All');
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const saved = sessionStorage.getItem(KEY);
      return saved ? { ...emptyDraft, ...JSON.parse(saved) } : emptyDraft;
    } catch { return emptyDraft; }
  });
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selected, setSelected] = useState<Restaurant | null>(null);
  const [stage, setStage] = useState<'browse' | 'menu' | 'reservation' | 'review' | 'ready'>('browse');
  const [cart, setCart] = useState<Record<string, number>>(() => { try { return JSON.parse(sessionStorage.getItem(KEY) || '{}').cart || {}; } catch { return {}; } });
  const [customerName, setCustomerName] = useState(() => { try { return JSON.parse(sessionStorage.getItem(KEY) || '{}').customerName || ''; } catch { return ''; } });
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [transactionPin, setTransactionPin] = useState('');
  const [customerPhone, setCustomerPhone] = useState(() => { try { return JSON.parse(sessionStorage.getItem(KEY) || '{}').customerPhone || ''; } catch { return ''; } });

  useEffect(() => {
    let cancelled = false;
    setRestaurantLoading(true);
    fetch('/api/restaurants')
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error?.message || 'Restaurants are temporarily unavailable.');
        if (!cancelled) setRestaurants(Array.isArray(data?.restaurants) ? data.restaurants : []);
      })
      .catch((error) => {
        if (!cancelled) { setRestaurants([]); setRestaurantError(error instanceof Error ? error.message : 'Restaurants are temporarily unavailable.'); }
      })
      .finally(() => { if (!cancelled) setRestaurantLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const saveDraft = (next: Draft) => { setDraft(next); try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch {} };
  const persistCheckout = (nextCart = cart, nextName = customerName, nextPhone = customerPhone) => { try { sessionStorage.setItem(KEY, JSON.stringify({ ...draft, cart: nextCart, customerName: nextName, customerPhone: nextPhone })); } catch {} };
  const updateCart = (nextCart: Record<string, number>) => { setCart(nextCart); persistCheckout(nextCart); };
  const updateCustomerName = (value: string) => { setCustomerName(value); persistCheckout(cart, value, customerPhone); };
  const updateCustomerPhone = (value: string) => { setCustomerPhone(value); persistCheckout(cart, customerName, value); };

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState('');
  useEffect(() => {
    if (!selected) { setMenuItems([]); return; }
    let cancelled = false;
    setMenuLoading(true); setMenuError('');
    fetch(`/api/restaurants/${encodeURIComponent(selected.id)}/menu`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error?.message || 'Restaurant menu is unavailable.');
        if (!cancelled) setMenuItems(Array.isArray(data?.items) ? data.items : []);
      })
      .catch((error) => { if (!cancelled) { setMenuItems([]); setMenuError(error instanceof Error ? error.message : 'Restaurant menu is unavailable.'); } })
      .finally(() => { if (!cancelled) setMenuLoading(false); });
    return () => { cancelled = true; };
  }, [selected?.id]);
  const cartCount = Object.values(cart).reduce((a,b) => a+b, 0);
  const cartTotalMinor = menuItems.reduce((sum, item) => sum + item.priceMinor * (cart[item.id] || 0), 0);
  const cartTotal = cartTotalMinor / 100;
  const deliveryFee = draft.mode === 'delivery' ? 1500 : 0;
  const serviceFee = cartTotalMinor ? Math.max(300, Math.round(cartTotalMinor * 0.03)) : 0;
  const finalTotalMinor = cartTotalMinor + deliveryFee + serviceFee;
  const finalTotal = finalTotalMinor / 100;
  const checkoutReady = Boolean(customerName.trim() && customerPhone.trim() && (draft.paymentMethod !== 'uniquepay' || /^\d{4}$/.test(transactionPin)) && (draft.mode !== 'delivery' || draft.deliveryAddress.trim()) && (draft.mode !== 'dine-in' || (draft.date && draft.time)) && (draft.mode !== 'pickup' || (draft.date && draft.time)));

  const openBooking = (restaurant: Restaurant) => { setSelected(restaurant); saveDraft({ ...draft, restaurantId: restaurant.id, cart, customerName, customerPhone }); setBookingOpen(true); setStage('menu'); };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return restaurants.filter((r) => {
      const matchesCity = city === 'All' || r.city === city;
      const matchesCuisine = cuisine === 'All' || r.cuisine.toLowerCase().includes(cuisine.toLowerCase());
      const matchesQuery = !q || [r.name, r.cuisine, r.city, r.area, r.description].join(' ').toLowerCase().includes(q);
      return matchesCity && matchesCuisine && matchesQuery;
    });
  }, [city, cuisine, query]);

  const continueBooking = () => {
    if (!selected) return;
    if (draft.mode === 'dine-in' && (!draft.date || !draft.time || draft.guests < 1)) return;
    if (draft.mode === 'delivery' && !draft.deliveryAddress.trim()) return;
    if (draft.mode === 'pickup' && (!draft.date || !draft.time)) return;
    setBookingOpen(false);
    setStage('review');
  };

  const confirmBooking = async () => {
    if (!currentUser || !selected || submitting) {
      if (!currentUser) navigate('/login', { state: { from: location, message: 'Sign in to confirm your restaurant reservation. Your details will be preserved.' } });
      return;
    }
    setSubmitting(true);
    setOrderError('');
    try {
      const idempotencyKey = `restaurant_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/restaurant/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          idempotencyKey, restaurantId: selected.id, mode: draft.mode, paymentMethod: draft.paymentMethod,
          customerName, customerPhone, deliveryAddress: draft.deliveryAddress, date: draft.date, time: draft.time,
          guests: draft.guests, seating: draft.seating, notes: draft.notes, cart,

        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error?.message || 'We could not create your restaurant order.');
      if (draft.paymentMethod === 'uniquepay') {
        let paymentResponse = await fetch('/api/restaurant/pay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            orderId: data.orderId,
            idempotencyKey: `restaurant_pay_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
            transactionPin,
          }),
        });
        let paymentData = await paymentResponse.json().catch(() => ({}));
        if (!paymentResponse.ok && paymentData?.error?.code === 'BIOMETRIC_REQUIRED') {
          const { createBiometricAssertion } = await import('../../components/security/PasskeySecurityCard');
          const biometricAssertion = await createBiometricAssertion(currentUser, `restaurant_payment|${currentUser.uid}|${data.orderId}|${data.totalMinor}|NGN`);
          const retryResponse = await fetch('/api/restaurant/pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              orderId: data.orderId,
              idempotencyKey: `restaurant_pay_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
              transactionPin,
              biometricAssertion,
            }),
          });
          paymentData = await retryResponse.json().catch(() => ({}));
          if (retryResponse.ok) {
            setOrderError('Payment confirmed. Your restaurant order has been recorded.');
            setStage('ready');
            return;
          }
          paymentResponse = retryResponse;
        }
        if (!paymentResponse.ok) {
          if (paymentResponse.status === 503 || paymentData?.error?.code === 'UNAVAILABLE') {
            setOrderError('Order created securely, but this restaurant is not yet connected to a verified UniquePay merchant wallet. No money was debited.');
            setStage('ready');
            return;
          }
          throw new Error(paymentData?.error?.message || 'UniquePay payment could not be completed. No money was debited.');
        }
        setOrderError('Payment confirmed. Your restaurant order has been recorded.');
      } else {
        setOrderError('Order created securely. A dedicated bank-transfer account will appear when the payment provider is connected.');
      }
      setStage('ready');
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : 'We could not create your restaurant order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-full overflow-y-auto bg-slate-50 pb-24">
      <main className="mx-auto w-full max-w-6xl px-3 pb-10 pt-20 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600" aria-label="Go back"><ArrowLeft className="h-4 w-4" /></button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-600">Unique Restaurant</p>
            <h1 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">Find a place to eat</h1>
          </div>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search restaurant, cuisine or area" className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none" />
            <button onClick={() => setFilterOpen((v) => !v)} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600" aria-label="Filters"><SlidersHorizontal className="h-4 w-4" /></button>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {['Abuja', 'Lagos', 'Kano', 'All'].map((item) => (
              <button key={item} onClick={() => setCity(item)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${city === item ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{item}</button>
            ))}
          </div>
          {filterOpen && (
            <div className="mt-3 flex gap-2 overflow-x-auto border-t border-slate-100 pt-3">
              {cuisineFilters.map((item) => (
                <button key={item} onClick={() => { setCuisine(item); setFilterOpen(false); }} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${cuisine === item ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'}`}>{item}</button>
              ))}
            </div>
          )}
        </section>

        <div className="mt-5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-slate-900">Available restaurants</h2>
            <p className="text-xs text-slate-500">{filtered.length} prototype options · availability will become live when providers are connected</p>
          </div>
          <span className="hidden rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 sm:block">Guest browsing</span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((restaurant) => (
            <article key={restaurant.id} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="relative flex h-24 items-end bg-gradient-to-br from-emerald-100 via-amber-50 to-slate-100 p-3 sm:h-28">
                <div className="rounded-xl bg-white/85 p-2 backdrop-blur"><Utensils className="h-5 w-5 text-emerald-700" /></div>
                <button className="absolute right-2 top-2 rounded-full bg-white/85 p-1.5 text-slate-500" aria-label={`Save ${restaurant.name}`}><Heart className="h-3.5 w-3.5" /></button>
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-1 text-xs font-black text-slate-900 sm:text-sm">{restaurant.name}</h3>
                  <span className="flex shrink-0 items-center gap-0.5 text-[10px] font-bold text-amber-600"><Star className="h-3 w-3 fill-current" />{restaurant.rating}</span>
                </div>
                <p className="mt-1 line-clamp-1 text-[10px] text-slate-500">{restaurant.cuisine}</p>
                <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-500"><MapPin className="h-3 w-3" />{restaurant.area}</p>
                <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-slate-600"><span>{restaurant.price}</span><span>{restaurant.time}</span></div>
                <button onClick={() => openBooking(restaurant)} className="mt-3 w-full rounded-xl bg-slate-950 px-2 py-2 text-[11px] font-black text-white active:scale-[0.98]">View & Reserve</button>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 text-xs text-emerald-900">
          <strong>How Unique Restaurant works:</strong> browse and compare freely. Build your reservation as a guest, then sign in only when you are ready to confirm it.
        </div>
      </main>


      {bookingOpen && selected && stage === 'menu' && (
        <div className="fixed inset-0 z-[82] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
          <section className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur">
              <div><p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Menu</p><h2 className="text-base font-black text-slate-950">{selected.name}</h2></div>
              <button onClick={() => setBookingOpen(false)} className="rounded-full bg-slate-100 p-2"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2 p-4">
              {menuItems.map(item => <div key={item.id} className="flex items-center justify-between rounded-2xl border border-slate-200 p-3"><div><p className="text-sm font-black">{item.name}</p><p className="text-xs text-slate-500">{item.description || item.category} · ₦{(item.priceMinor / 100).toLocaleString()}</p></div><div className="flex items-center gap-2"><button onClick={() => updateCart({...cart,[item.id]:Math.max(0,(cart[item.id]||0)-1)})} className="h-8 w-8 rounded-full border">−</button><span className="w-4 text-center text-xs font-black">{cart[item.id]||0}</span><button onClick={() => updateCart({...cart,[item.id]:(cart[item.id]||0)+1})} className="h-8 w-8 rounded-full bg-slate-950 text-white">+</button></div></div>)}
              {menuLoading && <p className="py-4 text-center text-xs text-slate-500">Loading live menu…</p>}
              {!menuLoading && menuError && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">{menuError}</p>}
              {!menuLoading && !menuError && !menuItems.length && <p className="py-4 text-center text-xs text-slate-500">No menu items are currently available.</p>}
              <button disabled={!cartCount || menuLoading} onClick={() => { setStage('reservation'); setBookingOpen(true); }} className="mt-3 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-40">Review order · ₦{cartTotal.toLocaleString()}</button>
              <p className="text-center text-[10px] text-slate-500">Prices shown are live Restaurant menu prices.</p>
            </div>
          </section>
        </div>
      )}
      {bookingOpen && selected && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Restaurant reservation">
          <section className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Reservation</p>
                <h2 className="text-base font-black text-slate-950">{selected.name}</h2>
              </div>
              <button onClick={() => setBookingOpen(false)} className="rounded-full bg-slate-100 p-2 text-slate-600" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4 p-4">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-900">{selected.cuisine} · {selected.area}, {selected.city}</p>
                <p className="mt-1 text-xs text-slate-500">{selected.description}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['dine-in', 'delivery', 'pickup'] as const).map((mode) => (
                  <button key={mode} type="button" onClick={() => saveDraft({ ...draft, mode })} className={`rounded-2xl border px-2.5 py-2.5 text-left text-[11px] font-black ${draft.mode === mode ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'}`}>
                    {mode === 'dine-in' ? 'Dine-in' : mode === 'delivery' ? 'Delivery' : 'Pickup'}
                  </button>
                ))}
              </div>
              {draft.mode === 'dine-in' && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="rounded-2xl border border-slate-200 p-3"><span className="flex items-center gap-1 text-[10px] font-bold text-slate-500"><CalendarDays className="h-3 w-3" />Date</span><input type="date" value={draft.date} onChange={(e) => saveDraft({ ...draft, date: e.target.value })} className="mt-2 w-full text-sm font-bold outline-none" /></label>
                  <label className="rounded-2xl border border-slate-200 p-3"><span className="flex items-center gap-1 text-[10px] font-bold text-slate-500"><Clock3 className="h-3 w-3" />Time</span><input type="time" value={draft.time} onChange={(e) => saveDraft({ ...draft, time: e.target.value })} className="mt-2 w-full text-sm font-bold outline-none" /></label>
                  <label className="rounded-2xl border border-slate-200 p-3"><span className="flex items-center gap-1 text-[10px] font-bold text-slate-500"><Users className="h-3 w-3" />Guests</span><input type="number" min="1" max="20" value={draft.guests} onChange={(e) => saveDraft({ ...draft, guests: Math.max(1, Number(e.target.value) || 1) })} className="mt-2 w-full text-sm font-bold outline-none" /></label>
                  <label className="rounded-2xl border border-slate-200 p-3"><span className="text-[10px] font-bold text-slate-500">Seating</span><select value={draft.seating} onChange={(e) => saveDraft({ ...draft, seating: e.target.value })} className="mt-2 w-full bg-transparent text-sm font-bold outline-none"><option>Standard table</option><option>Outdoor</option><option>Quiet area</option><option>Accessible seating</option></select></label>
                </div>
              )}
              {draft.mode === 'delivery' && (
                <label className="block rounded-2xl border border-slate-200 p-3"><span className="flex items-center gap-1 text-[10px] font-bold text-slate-500"><MapPin className="h-3 w-3" />Delivery address</span><textarea value={draft.deliveryAddress} onChange={(e) => saveDraft({ ...draft, deliveryAddress: e.target.value })} rows={2} placeholder="House number, street, area, city" className="mt-2 w-full resize-none text-sm outline-none" /></label>
              )}
              {draft.mode === 'pickup' && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="rounded-2xl border border-slate-200 p-3"><span className="flex items-center gap-1 text-[10px] font-bold text-slate-500"><CalendarDays className="h-3 w-3" />Pickup date</span><input type="date" value={draft.date} onChange={(e) => saveDraft({ ...draft, date: e.target.value })} className="mt-2 w-full text-sm font-bold outline-none" /></label>
                  <label className="rounded-2xl border border-slate-200 p-3"><span className="flex items-center gap-1 text-[10px] font-bold text-slate-500"><Clock3 className="h-3 w-3" />Pickup time</span><input type="time" value={draft.time} onChange={(e) => saveDraft({ ...draft, time: e.target.value })} className="mt-2 w-full text-sm font-bold outline-none" /></label>
                </div>
              )}
              <label className="block rounded-2xl border border-slate-200 p-3"><span className="text-[10px] font-bold text-slate-500">Special request</span><textarea value={draft.notes} onChange={(e) => saveDraft({ ...draft, notes: e.target.value })} rows={3} placeholder="Birthday, accessibility, children, dietary needs…" className="mt-2 w-full resize-none text-sm outline-none" /></label>
              <button disabled={(draft.mode === 'dine-in' && (!draft.date || !draft.time)) || (draft.mode === 'delivery' && !draft.deliveryAddress.trim()) || (draft.mode === 'pickup' && (!draft.date || !draft.time))} onClick={continueBooking} className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Review reservation</button>
              <p className="text-center text-[10px] text-slate-500">Prototype reservations do not claim live table availability.</p>
            </div>
          </section>
        </div>
      )}

      {stage === 'review' && selected && (
        <div className="fixed inset-0 z-[85] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
          <section className="w-full max-w-xl rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Review</p><h2 className="text-lg font-black text-slate-950">Ready to confirm?</h2></div><button onClick={() => setStage('browse')} className="rounded-full bg-slate-100 p-2"><X className="h-4 w-4" /></button></div>
            <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm"><p className="font-black">{selected.name}</p><p>{draft.mode === 'dine-in' ? `Dine-in · ${draft.date} · ${draft.time} · ${draft.guests} guest${draft.guests === 1 ? '' : 's'}` : draft.mode === 'pickup' ? `Pickup · ${draft.date} · ${draft.time}` : `Delivery · ${draft.deliveryAddress}`}</p>{draft.mode === 'dine-in' && <p>{draft.seating}</p>}{draft.notes && <p className="text-slate-500">{draft.notes}</p>}</div>
            <div className="mt-4 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Customer details</p>
              <input value={customerName} onChange={e => updateCustomerName(e.target.value)} placeholder="Full name" className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm outline-none" />
              <input value={customerPhone} onChange={e => updateCustomerPhone(e.target.value)} placeholder="Phone number" inputMode="tel" className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm outline-none" />
              <div className="rounded-2xl border border-slate-200 p-3 text-sm">
                <div className="flex justify-between"><span>Food</span><b>₦{cartTotal.toLocaleString()}</b></div>
                <div className="mt-2 flex justify-between"><span>Delivery</span><b>{deliveryFee ? '₦' + deliveryFee.toLocaleString() : 'Free'}</b></div>
                <div className="mt-2 flex justify-between"><span>Service fee</span><b>₦{serviceFee.toLocaleString()}</b></div>
                <div className="mt-3 flex justify-between border-t pt-3 text-base font-black"><span>Total</span><span>₦{finalTotal.toLocaleString()}</span></div>
              </div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Payment</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { setTransactionPin(''); saveDraft({...draft, paymentMethod:'uniquepay'}); }} className={`rounded-2xl border p-3 text-left ${draft.paymentMethod === 'uniquepay' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}><CreditCard className="h-4 w-4 text-emerald-600"/><p className="mt-2 text-xs font-black">UniquePay</p><p className="text-[10px] text-slate-500">Pay directly</p></button>
                <button onClick={() => saveDraft({...draft, paymentMethod:'bank-transfer'})} className={`rounded-2xl border p-3 text-left ${draft.paymentMethod === 'bank-transfer' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}><Landmark className="h-4 w-4 text-emerald-600"/><p className="mt-2 text-xs font-black">Bank transfer</p><p className="text-[10px] text-slate-500">Generate account number</p></button>
              </div>
              {draft.paymentMethod === 'uniquepay' && currentUser && (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">Transaction PIN</label>
                  <input value={transactionPin} onChange={e => setTransactionPin(e.target.value.replace(/\D/g, '').slice(0, 4))} type="password" inputMode="numeric" maxLength={4} placeholder="4-digit PIN" className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-bold outline-none focus:border-emerald-500" />
                  <p className="mt-1 text-[10px] text-slate-500">Your PIN is verified securely and is never stored with the order.</p>
                </div>
              )}
              <button disabled={!checkoutReady} onClick={confirmBooking} className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-40">{currentUser ? (draft.paymentMethod === 'uniquepay' ? 'Continue to UniquePay' : 'Generate account number') : 'Sign in to continue'}</button>
              {!currentUser && <p className="text-center text-[10px] text-slate-500">Your details and payment choice will remain saved while you sign in.</p>}
            </div>
            {!currentUser && <p className="mt-2 text-center text-[10px] text-slate-500">Your reservation details stay preserved while you sign in.</p>}
          </section>
        </div>
      )}

      {stage === 'ready' && selected && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]">
          <section className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Navigation className="h-5 w-5" /></div>
            <h2 className="mt-4 text-xl font-black text-slate-950">Reservation prepared</h2>
            <p className="mt-2 text-sm text-slate-500">Your request for {selected.name} has been securely recorded. Live restaurant confirmation and payment settlement activate when the provider is connected.</p>{orderError && <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-xs text-amber-800">{orderError}</p>}
            <button onClick={() => setStage('browse')} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Back to restaurants</button>
          </section>
        </div>
      )}
    </div>
  );
}
