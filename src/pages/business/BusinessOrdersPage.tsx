import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, MessageSquare, RefreshCw, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

type RestaurantOrder = {
  id: string;
  restaurantId: string;
  branchId: string;
  status: string;
  paymentStatus: string;
  currency: string;
  totalMinor: number;
  customerName: string;
  customerPhone: string;
  mode: string;
  deliveryAddress: string;
  date: string;
  time: string;
  items: Array<{ name: string; quantity: number }>;
  createdAtMs: number;
  refundStatus: string;
};

const nextActions: Record<string, Array<{ status: string; label: string }>> = {
  paid: [{ status: 'accepted', label: 'Accept order' }, { status: 'cancelled', label: 'Cancel & queue refund' }],
  accepted: [{ status: 'preparing', label: 'Start preparing' }, { status: 'cancelled', label: 'Cancel & queue refund' }],
  preparing: [{ status: 'ready', label: 'Mark ready' }, { status: 'cancelled', label: 'Cancel & queue refund' }],
  ready: [{ status: 'completed', label: 'Complete order' }],
};

export default function BusinessOrdersPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadOrders = useCallback(async () => {
    if (!currentUser) { setOrders([]); setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const token = await currentUser.getIdToken();
      const businessSession = localStorage.getItem('unique_business_session') || '';
      if (!businessSession) throw new Error('Open Business Hub and select your business session first.');
      const response = await fetch('/api/business/restaurants/orders', {
        headers: { Authorization: `Bearer ${token}`, 'X-Business-Session': businessSession },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error?.message || data?.error || 'Restaurant orders could not be loaded.');
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (err: any) {
      setError(err?.message || 'Restaurant orders could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!authLoading) void loadOrders();
  }, [authLoading, loadOrders]);

  const updateStatus = async (order: RestaurantOrder, status: string, label: string) => {
    if (!currentUser || updatingId) return;
    if (status === 'cancelled' && !window.confirm('Cancel this paid Restaurant order? A refund obligation will be queued; this does not mean the refund is already complete.')) return;
    setUpdatingId(order.id);
    setError('');
    setNotice('');
    try {
      const token = await currentUser.getIdToken();
      const businessSession = localStorage.getItem('unique_business_session') || '';
      const response = await fetch(`/api/business/restaurants/orders/${encodeURIComponent(order.id)}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Business-Session': businessSession },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error?.message || data?.error || `Could not ${label.toLowerCase()}.`);
      setNotice(status === 'cancelled'
        ? `Order #${order.id} cancelled. Refund queued for processing; completion is not yet confirmed.`
        : `Order #${order.id}: ${label.toLowerCase()} successfully.`);
      await loadOrders();
    } catch (err: any) {
      setError(err?.message || 'Restaurant order status could not be updated.');
    } finally {
      setUpdatingId('');
    }
  };

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((order) =>
      [order.id, order.status, order.paymentStatus, order.customerName, order.customerPhone,
        ...order.items.map((item) => item.name)].join(' ').toLowerCase().includes(term));
  }, [orders, search]);

  if (authLoading || loading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;
  if (!currentUser) return <div className="mx-auto max-w-xl py-16 text-center"><ShoppingBag className="mx-auto mb-4 h-12 w-12 text-slate-300" /><h1 className="text-xl font-semibold text-slate-900">Sign in to view business orders</h1><Link to="/login" className="mt-5 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Sign in</Link></div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><h1 className="text-2xl font-bold tracking-tight text-slate-900">Restaurant Orders</h1><p className="mt-1 text-sm text-slate-500">Paid orders for your active business and assigned branch. Status changes are checked by the server.</p></div>
        <div className="flex gap-2">
          <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Search order, customer, item…" aria-label="Search Restaurant orders" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm sm:w-64" />
          <button onClick={() => void loadOrders()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold" aria-label="Refresh Restaurant orders"><RefreshCw className="h-4 w-4" />Refresh</button>
        </div>
      </div>
      {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {notice && <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}
      {!error && filteredOrders.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center"><ShoppingBag className="mx-auto mb-4 h-12 w-12 text-slate-400" /><h3 className="text-lg font-semibold text-slate-900">{orders.length ? 'No matching orders' : 'No Restaurant orders yet'}</h3><p className="mt-2 text-sm text-slate-500">{orders.length ? 'Try a different order, customer, status, or item.' : 'Paid Restaurant orders for your business will appear here.'}</p></div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-200 bg-white">
          {filteredOrders.map((order) => {
            const actions = order.paymentStatus === 'paid' ? (nextActions[order.status] || []) : [];
            return <article key={order.id} className="p-5 sm:p-6">
              <div className="flex flex-col justify-between gap-4 lg:flex-row">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-900">#{order.id}</span><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold capitalize text-slate-700">{order.status.replace(/_/g, ' ')}</span><span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold capitalize text-blue-700">Payment: {order.paymentStatus}</span></div>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{order.customerName || 'Customer'} {order.customerPhone ? `· ${order.customerPhone}` : ''}</p>
                  <p className="mt-1 text-xs text-slate-500">{order.mode.replace(/-/g, ' ')}{order.date ? ` · ${order.date}` : ''}{order.time ? ` · ${order.time}` : ''}{order.createdAtMs ? ` · ${new Date(order.createdAtMs).toLocaleString()}` : ''}</p>
                  {order.mode === 'delivery' && order.deliveryAddress && <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">Delivery: {order.deliveryAddress}</p>}
                  <div className="mt-3 space-y-1">{order.items.map((item, index) => <p key={order.id + '-' + index} className="text-sm text-slate-600">{item.quantity}× {item.name}</p>)}</div>
                  {order.refundStatus && <p className="mt-2 text-xs text-amber-700">Refund status: {order.refundStatus}</p>}
                </div>
                <div className="shrink-0 lg:text-right">
                  <p className="font-semibold text-slate-900">{order.currency === 'NGN' ? '₦' : order.currency}{(Math.max(0, Number(order.totalMinor) || 0) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <Link to={'/os/messages/new?order=' + encodeURIComponent(order.id)} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"><MessageSquare className="h-4 w-4" />Discuss order</Link>
                  {actions.length > 0 && <div className="mt-3 flex flex-wrap gap-2 lg:justify-end">{actions.map((action) => <button key={action.status} disabled={Boolean(updatingId)} onClick={() => void updateStatus(order, action.status, action.label)} className={action.status === 'cancelled' ? 'rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50' : 'rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50'}>{updatingId === order.id ? 'Updating…' : action.label}</button>)}</div>}
                </div>
              </div>
            </article>;
          })}
        </div>
      )}
      <p className="text-xs text-slate-500">Showing up to 100 recent business Restaurant orders. Customer and delivery details are returned only through the authenticated, permission-checked Business API.</p>
    </div>
  );
}
