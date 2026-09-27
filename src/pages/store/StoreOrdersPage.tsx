import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Package, Search, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Order } from '../../lib/os/types';

const terminalStatuses = new Set(['delivered', 'completed', 'cancelled', 'refunded']);

export default function StoreOrdersPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      setOrders([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const loadOrders = async () => {
      setLoading(true);
      setError('');
      try {
        const snapshot = await getDocs(
          query(collection(db, 'orders'), where('customerId', '==', currentUser.uid))
        );
        if (cancelled) return;
        const next = snapshot.docs
          .map((orderDoc) => ({ ...(orderDoc.data() as Order), id: orderDoc.id }))
          .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        setOrders(next);
      } catch (err: any) {
        if (!cancelled) {
          console.error('Error loading Store orders:', err);
          setError(err?.message || 'Could not load your orders.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadOrders();
    return () => { cancelled = true; };
  }, [currentUser, authLoading]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((order) => {
      const items = (order.items || []).map((item) => item.name).join(' ');
      return order.id.toLowerCase().includes(term)
        || String(order.status || '').toLowerCase().includes(term)
        || items.toLowerCase().includes(term);
    });
  }, [orders, search]);

  if (authLoading || loading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  }

  if (!currentUser) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-slate-900">Sign in to view your orders</h1>
        <Link to="/login" className="inline-block mt-5 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Your Orders</h1>
          <p className="text-sm text-slate-500 mt-1">Track and manage your marketplace purchases.</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            type="search"
            placeholder="Search orders..."
            aria-label="Search orders"
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      </div>

      {error ? (
        <div className="bg-white border border-red-200 rounded-2xl p-8 text-center">
          <p className="font-medium text-slate-900">Could not load orders</p>
          <p className="text-sm text-slate-500 mt-2">{error}</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-10 h-10 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900">{orders.length ? 'No matching orders' : 'No orders yet'}</h3>
          <p className="text-slate-500 mt-2 max-w-sm mx-auto">
            {orders.length ? 'Try a different order ID, status, or product name.' : "You haven't placed any orders in the Unique Store."}
          </p>
          <Link to="/store" className="inline-block mt-6 bg-slate-900 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors">
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
          {filteredOrders.map((order) => (
            <div key={order.id} className="p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">#{order.id}</span>
                    <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-md capitalize">
                      {String(order.status || 'pending').replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1">
                    {(order.items || []).map((item, index) => (
                      <p key={order.id + '-' + index} className="text-sm text-slate-600">{item.quantity}× {item.name}</p>
                    ))}
                  </div>
                </div>
                <div className="text-left sm:text-right shrink-0">
                  <p className="font-semibold text-slate-900">
                    {order.currency === 'NGN' ? '₦' : order.currency || ''}{Number(order.totalAmount || 0).toLocaleString()}
                  </p>
                  <Link to={'/os/messages/new?order=' + encodeURIComponent(order.id)} className="mt-2 text-sm font-medium text-blue-600 hover:underline inline-flex items-center gap-1">
                    <MessageSquare className="w-4 h-4" /> Discuss Order
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
