import React, { useEffect, useMemo, useState } from 'react';
import { ShoppingCart, Loader2, MessageSquare, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Order } from '../lib/os/types';

type Tab = 'all' | 'pending' | 'completed';
const completedStatuses = new Set(['delivered', 'completed']);

export default function OrdersPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<Tab>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    const loadOrders = async () => {
      if (!currentUser) {
        setOrders([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const ordersRef = collection(db, 'orders');
        const [customerSnapshot, sellerSnapshot] = await Promise.all([
          getDocs(query(ordersRef, where('customerId', '==', currentUser.uid))),
          getDocs(query(ordersRef, where('sellerId', '==', currentUser.uid))),
        ]);
        const merged = new Map<string, Order>();
        [...customerSnapshot.docs, ...sellerSnapshot.docs].forEach((doc) => {
          merged.set(doc.id, { ...(doc.data() as Order), id: doc.id });
        });
        setOrders(Array.from(merged.values()).sort(
          (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
        ));
      } catch (err: any) {
        console.error('Error loading orders:', err);
        setError(err?.message || 'Could not load orders.');
      } finally {
        setLoading(false);
      }
    };
    loadOrders();
  }, [currentUser, authLoading]);

  const filteredOrders = useMemo(() => {
    if (tab === 'pending') {
      return orders.filter((order) => !completedStatuses.has(order.status) && order.status !== 'cancelled' && order.status !== 'refunded');
    }
    if (tab === 'completed') return orders.filter((order) => completedStatuses.has(order.status));
    return orders;
  }, [orders, tab]);

  if (authLoading || loading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  }

  if (!currentUser) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-slate-900">Sign in to view your orders</h1>
        <Link to="/login" className="inline-block mt-5 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Orders</h1>
        <p className="text-sm text-slate-500 mt-1">Track and fulfill real customer orders.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex gap-4">
          {(['all', 'pending', 'completed'] as Tab[]).map((value) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`text-sm font-medium pb-1 capitalize ${tab === value ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
            >
              {value === 'all' ? 'All Orders' : value}
            </button>
          ))}
        </div>

        {error ? (
          <div className="p-12 text-center">
            <p className="font-medium text-slate-900">Could not load orders</p>
            <p className="text-sm text-slate-500 mt-2">{error}</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-4" />
            <p className="font-medium text-slate-900">No orders found</p>
            <p className="text-sm text-slate-500 mt-2">
              {orders.length === 0 ? 'Your real Store orders will appear here after an order is created.' : 'No orders match this status.'}
            </p>
            <Link to="/store" className="inline-block mt-5 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium">Visit Store</Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredOrders.map((order) => (
              <div key={order.id} className="p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">#{order.id}</span>
                      <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-md capitalize">
                        {String(order.status).replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="mt-3 space-y-1">
                      {(order.items || []).map((item, index) => (
                        <p key={`${order.id}-${index}`} className="text-sm text-slate-600">{item.quantity}x {item.name}</p>
                      ))}
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="font-semibold text-slate-900">
                      {order.currency === 'NGN' ? '₦' : order.currency || ''}{Number(order.totalAmount || 0).toLocaleString()}
                    </p>
                    <Link to={`/os/messages/new?order=${encodeURIComponent(order.id)}`} className="mt-2 text-sm font-medium text-blue-600 hover:underline inline-flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" /> Discuss Order
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
